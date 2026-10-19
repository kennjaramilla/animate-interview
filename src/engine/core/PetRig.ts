import { type Vec2, vec2, set, copy } from '../math/vec2';
import { type IkChain, createChain, solveFabrik, solveTwoBone } from '../math/ik';
import { clamp, damp, dampAngle, lerp, smoothstep, TAU } from '../math/scalar';
import { type Spring1, type Spring2, stepSpring1, stepSpring2 } from '../math/spring';
import { RIG, WORLD } from '../config';
import { Gait } from './gait';
import { MESH_COLS, MESH_FRONT_CAP, MESH_HALF_HEIGHT, MESH_REAR_CAP, MESH_ROWS, SPINE_SAMPLES } from './bodyMesh';
import type { Facing, RigControls } from './types';

const TURN_SPRING = { frequency: 2.4, dampingRatio: 0.9 };
const CROUCH_SPRING = { frequency: 3, dampingRatio: 0.55 };
const STRETCH_SPRING = { frequency: 4, dampingRatio: 0.6 };
const EAR_SPRING = { frequency: 2.4, dampingRatio: 0.22 };
const PUPIL_SPRING = { frequency: 7, dampingRatio: 0.75 };


export interface Leg {
  readonly hind: boolean;
  /** Far-side legs are drawn behind the body in a darker shade. */
  readonly far: boolean;
  readonly upper: number;
  readonly lower: number;
  /** Socket position along the body, forward of the hip / chest joint. */
  readonly socketForward: number;
  readonly socket: Vec2;
  readonly knee: Vec2;
  /** Solved foot position (what gets drawn). */
  readonly foot: Vec2;
  /** Where the foot wants to be: planted on the ground or mid-step. */
  readonly target: Vec2;
}

/**
 * Procedural skeleton for a side-view dog.
 *
 *   hips ──spine (FABRIK)── chest ──neck (FABRIK)── head
 *    │                        │
 *   hind legs (2-bone IK)   front legs (2-bone IK)
 *   tail (lagging angle chain)
 *
 * All joints live in simulation space. Rest offsets are written in a local
 * frame where +x is "forward" and multiplied by `facing`, so turning around
 * is a mirror of the pose about the hips; the renderer then animates that
 * flip with `displayScaleX` so it reads as a turn instead of a snap.
 */
export class PetRig {
  readonly hips: Vec2;
  readonly spine: IkChain;
  readonly neck: IkChain;
  readonly head = vec2();
  readonly mouth = vec2();
  readonly legs: Leg[];
  readonly tail: Vec2[];
  /** Closed outline around the spine, deformed every step (breathing, stretch). */
  readonly bodyRing: Vec2[];
  /** Grid that carries the body texture (row-major, see bodyMesh.ts); deformed with the ring. */
  readonly bodyMesh: Vec2[];
  /** Pupil offset inside the eye, head-local. */
  readonly pupil: Spring2 = { pos: vec2(1, 0), vel: vec2() };
  readonly ear: Spring1 = { value: 0, velocity: 0 };

  facing: Facing = 1;
  velocityX = 0;
  /** Head pitch in the local frame: 0 = level, negative = up. */
  headAngle = RIG.headRestPitch;
  /** 0..1 chest expansion. */
  breath = 0;
  /** 0 = eyes open, 1 = closed. */
  blink = 0;
  /** Smoothed excitement, drives tail, panting and tongue. */
  excitement = 0;
  airborne = false;

  /** Diagonal pairs trot together: far-hind + near-front, far-front + near-hind. */
  private readonly gait = new Gait([1, 0, 0, 1]);
  private readonly turn: Spring1 = { value: 1, velocity: 0 };
  private readonly crouch: Spring1 = { value: 0, velocity: 0 };
  private readonly stretch: Spring1 = { value: 1, velocity: 0 };
  private readonly neckRestLengths: number[];
  private readonly tailAngles: number[];
  private readonly spineSamples: Vec2[];
  private readonly groundY: number;
  private readonly minX: number;
  private readonly maxX: number;
  private readonly chestTarget = vec2();
  private readonly neckTarget = vec2();
  private readonly tmp = vec2();
  private lift = 0;
  private vy = 0;
  private breathPhase = 0;
  private wagPhase = 0;
  private headAngVel = 0;
  private blinkIn = 2;
  private blinkT = -1;
  private tx = 0;
  private ty = 0;
  private nx = 0;
  private ny = 0;

  constructor(x: number, groundY: number, width: number) {
    this.groundY = groundY;
    this.minX = WORLD.edgeMargin;
    this.maxX = width - WORLD.edgeMargin;
    this.hips = vec2(x, groundY - RIG.hipHeight);

    // Rest poses are seeded with a slight arch so FABRIK keeps bending the same way.
    const spinePts: Vec2[] = [];
    for (let i = 0; i <= 3; i++) {
      spinePts.push(
        vec2(
          x + (RIG.bodyLength * i) / 3,
          this.hips.y - (RIG.chestRise * i) / 3 - Math.sin((Math.PI * i) / 3) * 3,
        ),
      );
    }
    this.spine = createChain(spinePts);

    const chest = spinePts[3];
    const neckPts: Vec2[] = [];
    for (let i = 0; i <= RIG.neckSegments; i++) {
      const t = i / RIG.neckSegments;
      neckPts.push(vec2(chest.x + RIG.neckRest.x * t + Math.sin(Math.PI * t) * 4, chest.y + RIG.neckRest.y * t));
    }
    this.neck = createChain(neckPts);
    for (let i = 0; i < this.neck.lengths.length; i++) this.neck.lengths[i] = RIG.neckSegmentLength;
    this.neck.reach = RIG.neckSegmentLength * RIG.neckSegments;
    this.neckRestLengths = this.neck.lengths.slice();

    const leg = (hind: boolean, far: boolean, socketForward: number): Leg => ({
      hind,
      far,
      upper: hind ? RIG.hindLeg.upper : RIG.frontLeg.upper,
      lower: hind ? RIG.hindLeg.lower : RIG.frontLeg.lower,
      socketForward,
      socket: vec2(),
      knee: vec2(),
      foot: vec2(),
      target: vec2(),
    });
    this.legs = [leg(true, true, 6), leg(false, true, 4), leg(true, false, -2), leg(false, false, -5)];

    this.tail = [];
    this.tailAngles = [];
    for (let i = 0; i <= RIG.tailSegments; i++) this.tail.push(vec2());
    for (let i = 0; i < RIG.tailSegments; i++) this.tailAngles.push(-2.5);

    this.spineSamples = [];
    for (let i = 0; i < SPINE_SAMPLES; i++) this.spineSamples.push(vec2());
    this.bodyRing = [];
    for (let i = 0; i < SPINE_SAMPLES * 2 + 2; i++) this.bodyRing.push(vec2());
    this.bodyMesh = [];
    for (let i = 0; i < MESH_COLS * MESH_ROWS; i++) this.bodyMesh.push(vec2());

    this.solveLegs(0);
    for (const l of this.legs) this.legHome(l, l.target);
  }

  /** Horizontal scale the renderer applies about the hips; sweeps -1 → 1 during a turn. */
  get displayScaleX(): number {
    return this.turn.value * this.facing;
  }

  /** Maps a rig-space point to where it appears on screen mid-turn. */
  toDisplay(out: Vec2, p: Vec2): Vec2 {
    return set(out, this.hips.x + (p.x - this.hips.x) * this.displayScaleX, p.y);
  }

  /** Where the spine IK is pulling the chest this step (read-only, for debug views). */
  get chestIkTarget(): Readonly<Vec2> {
    return this.chestTarget;
  }

  /** Where the neck IK is pulling the head this step (read-only, for debug views). */
  get neckIkTarget(): Readonly<Vec2> {
    return this.neckTarget;
  }

  /** Launches the body upwards; gravity and landing are handled in update. */
  jump(speed: number): void {
    if (this.airborne) return;
    this.airborne = true;
    this.vy = -speed;
    this.gait.reset();
  }

  get height(): number {
    return -this.lift;
  }

  update(c: RigControls, dt: number): void {
    if (c.facing !== this.facing) this.mirror(c.facing);
    stepSpring1(this.turn, this.facing, TURN_SPRING, dt);
    this.excitement = damp(this.excitement, c.excitement, 3, dt);

    this.updateLocomotion(c, dt);
    this.updateBreathAndBlink(dt);
    this.updateSpineAndNeck(c, dt);
    this.updateHead(c, dt);
    this.solveLegs(dt);
    this.updateTail(dt);
    this.updateBodyRing();
  }

  /** Mirrors every joint about the hips so the pose faces the other way. */
  private mirror(facing: Facing): void {
    this.facing = facing;
    const cx = this.hips.x;
    for (const p of this.spine.joints) p.x = 2 * cx - p.x;
    for (const p of this.neck.joints) p.x = 2 * cx - p.x;
    for (const p of this.tail) p.x = 2 * cx - p.x;
    for (const l of this.legs) {
      l.target.x = 2 * cx - l.target.x;
      l.knee.x = 2 * cx - l.knee.x;
      l.foot.x = 2 * cx - l.foot.x;
    }
    this.head.x = 2 * cx - this.head.x;
    this.gait.reset();
  }

  private updateLocomotion(c: RigControls, dt: number): void {
    if (c.jump > 0) this.jump(c.jump);
    // Steer towards the target with a speed cap; in the air momentum is kept.
    const desired = this.airborne
      ? this.velocityX
      : clamp((c.moveTargetX - this.hips.x) * 3, -c.maxSpeed, c.maxSpeed);
    this.velocityX = damp(this.velocityX, desired, 6, dt);
    this.hips.x = clamp(this.hips.x + this.velocityX * dt, this.minX, this.maxX);

    stepSpring1(this.crouch, c.crouch, CROUCH_SPRING, dt);

    if (this.airborne) {
      this.vy += WORLD.gravity * dt;
      this.lift += this.vy * dt;
      if (this.lift >= 0) {
        // Landing: hand the impact to the crouch spring for a squash.
        this.lift = 0;
        this.airborne = false;
        this.crouch.velocity += this.vy * 0.008;
        this.vy = 0;
        for (const l of this.legs) set(l.target, l.foot.x, this.groundY);
      }
    }

    this.hips.y = this.groundY - RIG.hipHeight + this.crouch.value * 14 + this.lift + this.gait.bob;
  }

  private updateBreathAndBlink(dt: number): void {
    // Calm: slow deep breaths. Excited: quick shallow panting.
    const period = lerp(3.2, 0.42, this.excitement * this.excitement);
    this.breathPhase = (this.breathPhase + (dt * TAU) / period) % TAU;
    this.breath = (0.5 + 0.5 * Math.sin(this.breathPhase)) * lerp(1, 0.55, this.excitement);

    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkT = 0;
      this.blinkIn = 1.8 + Math.random() * 3.5;
    }
    if (this.blinkT >= 0) {
      this.blinkT += dt / 0.16;
      this.blink = this.blinkT < 1 ? Math.sin(Math.PI * this.blinkT) : 0;
      if (this.blinkT >= 1) this.blinkT = -1;
    }
  }

  private updateSpineAndNeck(c: RigControls, dt: number): void {
    const f = this.facing;
    const spine = this.spine.joints;
    const chest = spine[spine.length - 1];
    const restReach = RIG.neckSegmentLength * RIG.neckSegments;

    let stretchTarget = 1;
    let lean = 0;
    let leanX = 0;
    let leanY = 0;
    if (c.reachFor) {
      // Head base sits one mouth-length short of the reach point, on the chest → target line.
      const dx = c.reachFor.x - chest.x;
      const dy = c.reachFor.y - chest.y;
      const d = Math.hypot(dx, dy) || 1;
      const needed = Math.max(d - RIG.mouth.x, 4) / restReach;
      stretchTarget = clamp(needed, 1, RIG.maxNeckStretch);
      // Whatever the neck can't cover, the spine covers by leaning the chest out.
      lean = clamp((needed - RIG.maxNeckStretch) * restReach, 0, RIG.maxLean);
      leanX = dx / d;
      leanY = dy / d;
    }
    stepSpring1(this.stretch, stretchTarget, STRETCH_SPRING, dt);

    set(
      this.chestTarget,
      this.hips.x + f * RIG.bodyLength * 0.97 + leanX * lean,
      this.hips.y - RIG.chestRise - this.breath * 1.2 + leanY * lean,
    );
    // Nudge the interior joints up so the solve keeps an upward arch, never a sag.
    for (let i = 1; i < spine.length - 1; i++) spine[i].y -= 0.6;
    solveFabrik(this.spine, this.hips, this.chestTarget, 6);

    for (let i = 0; i < this.neck.lengths.length; i++) {
      this.neck.lengths[i] = this.neckRestLengths[i] * this.stretch.value;
    }
    this.neck.reach = restReach * this.stretch.value;

    if (c.reachFor) {
      const dx = c.reachFor.x - chest.x;
      const dy = c.reachFor.y - chest.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.max(d - RIG.mouth.x, 4) / d;
      set(this.neckTarget, chest.x + dx * k, chest.y + dy * k);
    } else {
      set(this.neckTarget, chest.x + f * RIG.neckRest.x, chest.y + RIG.neckRest.y);
      if (c.lookAt) {
        // Lean the head a few pixels towards whatever it's looking at.
        const dx = c.lookAt.x - this.neckTarget.x;
        const dy = c.lookAt.y - this.neckTarget.y;
        const d = Math.hypot(dx, dy) || 1;
        this.neckTarget.x += (dx / d) * 7;
        this.neckTarget.y += (dy / d) * 5;
      }
    }

    const neck = this.neck.joints;
    for (let i = 1; i < neck.length - 1; i++) neck[i].x += f * 0.4;
    solveFabrik(this.neck, chest, this.neckTarget, 8);
    copy(this.head, neck[neck.length - 1]);
  }

  private updateHead(c: RigControls, dt: number): void {
    const f = this.facing;
    const target = c.reachFor ?? c.lookAt;

    let pitch = RIG.headRestPitch;
    if (target) {
      // Mirror into the local frame, then clamp so the neck never over-rotates.
      pitch = clamp(
        Math.atan2(target.y - this.head.y, (target.x - this.head.x) * f),
        RIG.headPitchUp,
        RIG.headPitchDown,
      );
    }
    const prev = this.headAngle;
    this.headAngle = dampAngle(this.headAngle, pitch, 10, dt);
    this.headAngVel = dt > 0 ? (this.headAngle - prev) / dt : 0;

    const cos = Math.cos(this.headAngle);
    const sin = Math.sin(this.headAngle);
    set(
      this.mouth,
      this.head.x + f * (RIG.mouth.x * cos - RIG.mouth.y * sin),
      this.head.y + RIG.mouth.x * sin + RIG.mouth.y * cos,
    );

    // Pupils: direction to the target expressed in head-local space.
    if (target) {
      const lx = (target.x - this.head.x) * f;
      const ly = target.y - this.head.y;
      const rx = lx * cos + ly * sin;
      const ry = -lx * sin + ly * cos;
      const d = Math.hypot(rx, ry) || 1;
      set(this.tmp, (rx / d) * RIG.pupilRange, (ry / d) * RIG.pupilRange);
    } else {
      set(this.tmp, RIG.pupilRange * 0.4, 0);
    }
    stepSpring2(this.pupil, this.tmp, PUPIL_SPRING, dt);

    // Floppy ears lag behind body motion and head turns.
    const earTarget = clamp(
      this.velocityX * f * 0.004 + this.headAngVel * 0.05 - this.vy * 0.0006,
      -0.9,
      0.9,
    );
    stepSpring1(this.ear, earTarget, EAR_SPRING, dt);
  }

  /** Where a leg's foot rests when standing still. */
  private legHome(l: Leg, out: Vec2): Vec2 {
    return set(out, l.socket.x + this.facing * 2, this.groundY);
  }

  private solveLegs(dt: number): void {
    const f = this.facing;
    const spine = this.spine.joints;
    for (const l of this.legs) {
      const base = l.hind ? spine[0] : spine[spine.length - 1];
      set(l.socket, base.x + f * l.socketForward, base.y + (l.hind ? 9 : 11));
    }

    if (this.airborne) {
      for (const l of this.legs) {
        // Tuck the legs while flying: hind legs back, front legs forward.
        l.target.x = damp(l.target.x, l.socket.x + f * (l.hind ? -12 : 14), 14, dt);
        l.target.y = damp(l.target.y, l.socket.y + 32, 14, dt);
      }
    } else {
      this.gait.update(this.legs, f * 2, this.velocityX, this.groundY, dt);
    }

    for (const l of this.legs) {
      // Both joints fold backwards: the hock on hind legs, the elbow on front legs.
      solveTwoBone(l.socket, l.target, l.upper, l.lower, -f as Facing, l.knee, l.foot);
    }
  }


  private updateTail(dt: number): void {
    const f = this.facing;
    const e = this.excitement;
    const wagHz = lerp(1.1, 4.2, e);
    const wagAmp = lerp(0.2, 0.75, e);
    // Accumulate phase so changing the wag speed never makes the tail jump.
    this.wagPhase = (this.wagPhase + dt * wagHz * TAU) % TAU;
    const base = lerp(-2.75, -2.05, e);

    const root = this.spine.joints[0];
    set(this.tail[0], root.x - f * 13, root.y - 7);
    const n = this.tailAngles.length;
    for (let i = 0; i < n; i++) {
      const wag = wagAmp * Math.sin(this.wagPhase - i * 0.55) * (0.35 + (0.65 * i) / n);
      // Tips follow more loosely than the root, which gives the whip-like lag.
      this.tailAngles[i] = dampAngle(this.tailAngles[i], base + i * 0.12 + wag, 24 - i * 3, dt);
      const a = this.tailAngles[i];
      set(
        this.tail[i + 1],
        this.tail[i].x + f * Math.cos(a) * RIG.tailSegmentLength,
        this.tail[i].y + Math.sin(a) * RIG.tailSegmentLength,
      );
    }
  }

  /**
   * Skins a closed outline onto the spine: sample a Catmull-Rom curve through
   * the spine joints, then push each sample out along its normal by a radius
   * profile (narrow hips, deep chest). Breathing scales the chest radii, so
   * the deformation follows the bones however the spine bends or stretches.
   */
  private updateBodyRing(): void {
    const s = this.spineSamples;
    const j = this.spine.joints;
    const segs = j.length - 1;
    for (let k = 0; k < SPINE_SAMPLES; k++) {
      const u = (k / (SPINE_SAMPLES - 1)) * segs;
      const seg = Math.min(Math.floor(u), segs - 1);
      catmullRom(
        s[k],
        j[Math.max(seg - 1, 0)],
        j[seg],
        j[seg + 1],
        j[Math.min(seg + 2, segs)],
        u - seg,
      );
    }

    const ring = this.bodyRing;
    const last = SPINE_SAMPLES - 1;
    let idx = 1;

    for (let k = 0; k <= last; k++) {
      const t = k / last;
      this.sampleFrame(k);
      const { nx, ny } = this;
      const top = lerp(14, 17.5, t) * (1 + this.breath * 0.05 * smoothstep(0.35, 1, t));
      set(ring[idx++], s[k].x + nx * top, s[k].y + ny * top);
    }
    this.sampleFrame(last);
    set(ring[idx++], s[last].x + this.tx * 13 - this.nx, s[last].y + this.ty * 13 - this.ny);
    for (let k = last; k >= 0; k--) {
      const t = k / last;
      this.sampleFrame(k);
      const { nx, ny } = this;
      const belly = lerp(10, 19, smoothstep(0, 0.85, t)) * (1 + this.breath * 0.08 * smoothstep(0.3, 1, t));
      set(ring[idx++], s[k].x - nx * belly, s[k].y - ny * belly);
    }
    this.sampleFrame(0);
    set(ring[0], s[0].x - this.tx * 14 + this.nx * 2, s[0].y - this.ty * 14 + this.ny * 2);

    this.updateBodyMesh();
  }

  /**
   * Same skinning for the texture grid: each column sits on a spine sample
   * (plus a cap column at each end) and its rows are pushed along the normal.
   * Breathing scales the rows exactly like the outline radii, so the image
   * swells with the chest.
   */
  private updateBodyMesh(): void {
    const s = this.spineSamples;
    const last = SPINE_SAMPLES - 1;
    for (let col = 0; col < MESH_COLS; col++) {
      const k = clamp(col - 1, 0, last);
      this.sampleFrame(k);
      const t = k / last;
      const ext = col === 0 ? -MESH_REAR_CAP : col === MESH_COLS - 1 ? MESH_FRONT_CAP : 0;
      const cx = s[k].x + this.tx * ext;
      const cy = s[k].y + this.ty * ext;
      const up = MESH_HALF_HEIGHT * (1 + this.breath * 0.05 * smoothstep(0.35, 1, t));
      const down = MESH_HALF_HEIGHT * (1 + this.breath * 0.08 * smoothstep(0.3, 1, t));
      set(this.bodyMesh[col], cx + this.nx * up, cy + this.ny * up);
      set(this.bodyMesh[MESH_COLS + col], cx, cy);
      set(this.bodyMesh[2 * MESH_COLS + col], cx - this.nx * down, cy - this.ny * down);
    }
  }

  /** Tangent and upward normal of the spine curve at sample k. */
  private sampleFrame(k: number): void {
    const s = this.spineSamples;
    const a = s[Math.max(k - 1, 0)];
    const b = s[Math.min(k + 1, SPINE_SAMPLES - 1)];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    this.tx = (b.x - a.x) / d;
    this.ty = (b.y - a.y) / d;
    // Of the two normals, pick the one pointing up the screen.
    const flip = this.tx < 0 ? -1 : 1;
    this.nx = this.ty * flip;
    this.ny = -this.tx * flip;
  }
}

/** Uniform Catmull-Rom interpolation between p1 and p2. */
function catmullRom(out: Vec2, p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  return set(out, catmullRom1(p0.x, p1.x, p2.x, p3.x, t), catmullRom1(p0.y, p1.y, p2.y, p3.y, t));
}

function catmullRom1(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t2 * t);
}
