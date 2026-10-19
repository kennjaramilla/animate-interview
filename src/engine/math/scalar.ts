/**
 * Scalar helpers: clamping, angle wrapping, frame-rate independent smoothing
 * and easing curves.
 */

export const TAU = Math.PI * 2;

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Wraps an angle into [-PI, PI). */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Signed shortest rotation from `from` to `to`. */
export const angleDelta = (from: number, to: number): number => wrapAngle(to - from);

/**
 * Exponential smoothing that converges at the same rate regardless of frame
 * time: after one second the remaining gap is exp(-rate) of where it started.
 * `lerp(a, b, 0.1)` per frame would instead move twice as fast at 120Hz.
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

/** `damp` for angles, always turning the short way round. */
export function dampAngle(current: number, target: number, rate: number, dt: number): number {
  return current + angleDelta(current, target) * (1 - Math.exp(-rate * dt));
}

/** 0 → 1 → 0 hermite step between two edges. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

/** Overshoots slightly past 1 before settling, for a springy pop. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
