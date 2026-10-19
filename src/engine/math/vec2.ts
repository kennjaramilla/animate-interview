/**
 * Minimal 2D vector helpers.
 *
 * Every operation writes into an `out` vector instead of returning a new one,
 * so the per-frame update path can run without allocating. `out` may alias
 * any of the inputs.
 */
export interface Vec2 {
  x: number;
  y: number;
}

export const vec2 = (x = 0, y = 0): Vec2 => ({ x, y });

export function set(out: Vec2, x: number, y: number): Vec2 {
  out.x = x;
  out.y = y;
  return out;
}

export function copy(out: Vec2, a: Vec2): Vec2 {
  out.x = a.x;
  out.y = a.y;
  return out;
}

export function add(out: Vec2, a: Vec2, b: Vec2): Vec2 {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  return out;
}

export function sub(out: Vec2, a: Vec2, b: Vec2): Vec2 {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  return out;
}

export function scale(out: Vec2, a: Vec2, s: number): Vec2 {
  out.x = a.x * s;
  out.y = a.y * s;
  return out;
}

/** out = a + b * s */
export function addScaled(out: Vec2, a: Vec2, b: Vec2, s: number): Vec2 {
  out.x = a.x + b.x * s;
  out.y = a.y + b.y * s;
  return out;
}

export function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Unit vector in the direction of `a`; a zero vector stays zero. */
export function normalize(out: Vec2, a: Vec2): Vec2 {
  const len = Math.hypot(a.x, a.y);
  if (len < 1e-9) return set(out, 0, 0);
  return set(out, a.x / len, a.y / len);
}

export function lerp(out: Vec2, a: Vec2, b: Vec2, t: number): Vec2 {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  return out;
}

/** Angle of `a` in radians, measured from +x towards +y (canvas y points down). */
export function angleOf(a: Vec2): number {
  return Math.atan2(a.y, a.x);
}

/** Angle of the vector from `a` to `b`. */
export function angleBetween(a: Vec2, b: Vec2): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function fromAngle(out: Vec2, radians: number, len = 1): Vec2 {
  return set(out, Math.cos(radians) * len, Math.sin(radians) * len);
}

export function rotate(out: Vec2, a: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return set(out, a.x * c - a.y * s, a.x * s + a.y * c);
}

/** Shortens `a` to at most `max` while keeping its direction. */
export function clampLength(out: Vec2, a: Vec2, max: number): Vec2 {
  const len = Math.hypot(a.x, a.y);
  if (len <= max || len < 1e-9) return copy(out, a);
  return scale(out, a, max / len);
}
