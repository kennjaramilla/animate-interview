# Architecture notes

A short tour of how the pet works and why it's built this way.

## Layers

```
src/engine/
  math/       pure math: vectors, smoothing, springs, IK, ballistics, intercept planning
  core/       the simulation: rig (skeleton), gait, ball, PetSimulation
  behaviors/  idle, walk, fetch — decide what the pet wants to do
  render/     canvas drawing + skeleton debug overlay
  input/      pointer/touch → simulation coordinates
  PetEngine.ts  frame loop that wires it all together
```

`math/`, `core/` and `behaviors/` never touch the DOM or the canvas. The engine feeds the
simulation pointer positions and a delta time, and the renderer reads the state back to draw
it. To move this to React Native you would replace `render/` and `input/` (e.g. with Skia and
gesture handlers) and keep everything else.

Behaviors only write a small `RigControls` object: where to walk, what to look at, what to
reach for, how excited the pet is. The rig turns that into joint positions. That split keeps
behaviors short and means walking, tracking and fetching all share the same body logic.

## The rig

The dog is a side-view skeleton, built and drawn in code (no sprites):

- **Spine and neck** are FABRIK chains. FABRIK alternates two passes: pin the end on the target
  and pull each joint back along the line to its neighbour (keeping bone lengths), then pin the
  root and push back out. Starting each solve from last frame's pose keeps the motion
  continuous. When reaching for the ball the neck bones can stretch up to 1.35×, and whatever
  that can't cover is covered by leaning the chest.
- **Legs** use analytic two-bone IK. With thigh length `a`, shin length `b` and distance `d` to
  the foot target, the angle at the hip is `acos((a² + d² − b²) / 2ad)` (law of cosines). A
  bend sign keeps hind knees pointing forward and front elbows pointing back, so legs never flip.
- **Body** is a mesh wrapped around the spine: a Catmull-Rom curve through the spine joints,
  with each sample pushed out along its normal by a radius profile. Breathing scales the chest
  radii, so the deformation follows the spine however it bends.
- **Head** pitch eases toward the cursor within limits. The pupils move inside the eye using the
  target direction converted into head-local space, on a spring.
- **Ears and tail** are secondary motion: the ear is an under-damped spring driven by body and
  head movement, and the tail is an angle chain where each segment follows the one before it
  a little more loosely.
- **Turning** mirrors the pose around the hips. The renderer then animates the scale from −1 to 1
  so it reads as a turn instead of a snap.

## Textured body (image mesh)

The body can also be drawn from an image asset (`render/assets/dog-body.svg`) warped over a
mesh, which is how tools like Spine or DragonBones skin a sprite. It's on by default; press `T`
to switch to the vector outline.

- The mesh is a 3 × 11 grid in "spine space": one column per spine sample plus a cap at each
  end, with rows above, on and below the spine. The image is authored in the same space, so
  each vertex's rest position is also its texture coordinate.
- Every step the rig moves the grid with the spine (same normals, same breathing scale as the
  outline), so the image bends, stretches and breathes with the bones.
- Canvas 2D can't draw textured triangles, so each of the 40 triangles is drawn with its own
  affine transform (solved from the two edge vectors of the rest and deformed triangles),
  clipped to the triangle. Clip edges are grown by under a pixel to hide anti-aliasing seams.
- The SVG is rasterised once at load, and each triangle only copies the texels under it.

The skeleton view (`D`) shows the triangle wireframe while textured mode is on.

## Gait

Feet stay planted in world space while the body moves over them. When a foot trails its home
spot by more than a threshold, it and its diagonal partner swing forward to a spot ahead of the
body. Only one pair swings at a time, which gives a trot. Speed shortens the swing and lengthens
the stride, so walking and running use the same code.

## Fetch

The ball is a projectile (`p + v·t + ½·g·t²`) with bounces and rolling friction. Each step the
dog re-plans an intercept: it samples the ball's future path and picks the earliest moment it
can both run to the right spot and reach the ball's height, standing or with a jump. Jump speed
comes from `v = √(2·g·h)`, timed so the top of the jump meets the ball. If nothing is reachable
in the air, it goes for the landing spot and picks the ball up off the ground. Then it carries
the ball back and drops it.

## Smooth animation

- **Frame-rate independent.** Smoothing uses `1 − e^(−rate·dt)` instead of a fixed lerp per frame,
  and springs are integrated with implicit Euler, which stays stable even on a long frame. Frame
  time is clamped to 100ms and split into steps of at most 1/120s, so 60Hz and 120Hz screens
  behave the same.
- **No per-frame allocations.** Vector helpers write into existing objects, and all scratch
  vectors, rings and chains are created once. That keeps the garbage collector out of the loop.
- **Sharp on HiDPI.** The canvas backing store is sized to `devicePixelRatio`; the simulation
  always works in the 600×400 logical space.
- **Clean teardown.** `destroy()` cancels the frame loop and removes every listener.

## Debugging and tests

Press `D` (or the Skeleton button) to see the bones, IK targets, body mesh vertices and the
gaze line, plus an FPS readout. `npm test` runs the unit tests for the math, gait and intercept
planner.
