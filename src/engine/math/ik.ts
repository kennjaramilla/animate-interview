import { type Vec2, vec2, distance, set } from './vec2';

/**
 * A chain of joints joined by rigid bones. joints[0] is the root, the last
 * joint is the end effector. lengths[i] is the bone from joint i to i + 1.
 */
export interface IkChain {
  joints: Vec2[];
  lengths: number[];
  reach: number;
}

export function createChain(points: Vec2[]): IkChain {
  const joints = points.map((p) => vec2(p.x, p.y));
  const lengths: number[] = [];
  for (let i = 0; i < joints.length - 1; i++) lengths.push(distance(joints[i], joints[i + 1]));
  return { joints, lengths, reach: lengths.reduce((a, b) => a + b, 0) };
}

/** Places `out` on the line from `anchor` towards `toward`, `len` away from `anchor`. */
function placeAlong(out: Vec2, anchor: Vec2, toward: Vec2, len: number): void {
  const dx = toward.x - anchor.x;
  const dy = toward.y - anchor.y;
  const d = Math.hypot(dx, dy) || 1e-9;
  set(out, anchor.x + (dx / d) * len, anchor.y + (dy / d) * len);
}

/**
 * FABRIK (Forward And Backward Reaching Inverse Kinematics, Aristidou &
 * Lasenby 2011).
 *
 * Backward pass: pin the end effector on the target and walk to the root,
 * pulling each joint along the line to its child so every bone keeps its
 * length. Forward pass: pin the root back on `root` and walk out again.
 * Repeating converges in a few iterations, and because each solve starts from
 * last frame's pose the chain moves continuously instead of snapping between
 * solutions.
 *
 * When the target is out of reach the chain is laid out straight towards it.
 * Works in place and allocates nothing. Returns the remaining distance from
 * the end effector to the target.
 */
export function solveFabrik(
  chain: IkChain,
  root: Vec2,
  target: Vec2,
  iterations = 10,
  tolerance = 0.25,
): number {
  const { joints, lengths } = chain;
  const last = joints.length - 1;

  if (distance(root, target) >= chain.reach) {
    set(joints[0], root.x, root.y);
    for (let i = 0; i < last; i++) placeAlong(joints[i + 1], joints[i], target, lengths[i]);
    return distance(joints[last], target);
  }

  for (let iter = 0; iter < iterations; iter++) {
    set(joints[last], target.x, target.y);
    for (let i = last - 1; i >= 0; i--) placeAlong(joints[i], joints[i + 1], joints[i], lengths[i]);

    set(joints[0], root.x, root.y);
    for (let i = 0; i < last; i++) placeAlong(joints[i + 1], joints[i], joints[i + 1], lengths[i]);

    if (distance(joints[last], target) <= tolerance) break;
  }
  return distance(joints[last], target);
}

/**
 * Analytic two-bone IK (hip → knee → foot) via the law of cosines.
 *
 * The angle at the hip between the hip→target line and the thigh is
 *   acos((a² + d² - b²) / (2·a·d))
 * with a = upper length, b = lower length, d = clamped distance to target.
 * `bend` (+1 / -1) picks which side the knee folds to, so legs never flip.
 * Writes the knee and foot positions into `outKnee` / `outFoot`.
 */
export function solveTwoBone(
  root: Vec2,
  target: Vec2,
  upper: number,
  lower: number,
  bend: 1 | -1,
  outKnee: Vec2,
  outFoot: Vec2,
): void {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const rawDist = Math.hypot(dx, dy);
  const minDist = Math.abs(upper - lower) + 1e-3;
  const dist = Math.min(Math.max(rawDist, minDist), upper + lower - 1e-3);
  const baseAngle = rawDist < 1e-9 ? Math.PI / 2 : Math.atan2(dy, dx);

  const cosHip = (upper * upper + dist * dist - lower * lower) / (2 * upper * dist);
  const hipAngle = baseAngle - bend * Math.acos(Math.min(1, Math.max(-1, cosHip)));

  set(outKnee, root.x + Math.cos(hipAngle) * upper, root.y + Math.sin(hipAngle) * upper);
  set(outFoot, root.x + Math.cos(baseAngle) * dist, root.y + Math.sin(baseAngle) * dist);
}
