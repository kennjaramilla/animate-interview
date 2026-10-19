import type { Vec2 } from './vec2';
import { set } from './vec2';

/** A point mass under constant gravity (pixels, seconds, +y is down). */
export interface Projectile {
  pos: Vec2;
  vel: Vec2;
}

/** Position after `t` seconds of free flight: p + v·t + ½·g·t². */
export function predictPosition(out: Vec2, p: Projectile, gravity: number, t: number): Vec2 {
  return set(out, p.pos.x + p.vel.x * t, p.pos.y + p.vel.y * t + 0.5 * gravity * t * t);
}

/**
 * Seconds until the projectile next descends through height `y`, or null if
 * its arc never reaches it. Solves ½g·t² + vy·t + (py - y) = 0 and keeps the
 * later root, which is the crossing on the way down.
 */
export function timeToDescendTo(p: Projectile, gravity: number, y: number): number | null {
  const a = 0.5 * gravity;
  const b = p.vel.y;
  const c = p.pos.y - y;
  if (Math.abs(a) < 1e-9) return b > 0 && c < 0 ? -c / b : null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b + Math.sqrt(disc)) / (2 * a);
  return t >= 0 ? t : null;
}

/**
 * Launch velocity that lands a projectile from `from` on `to` after exactly
 * `flightTime` seconds. Inverts the kinematics per axis:
 *   vx = dx / t,   vy = dy / t - ½·g·t
 */
export function launchVelocity(
  out: Vec2,
  from: Vec2,
  to: Vec2,
  gravity: number,
  flightTime: number,
): Vec2 {
  return set(
    out,
    (to.x - from.x) / flightTime,
    (to.y - from.y) / flightTime - 0.5 * gravity * flightTime,
  );
}

export interface GroundBounds {
  floorY: number;
  minX: number;
  maxX: number;
}

/**
 * Semi-implicit Euler step with floor and wall bounces. Each bounce keeps
 * `restitution` of the normal speed; rolling on the floor bleeds speed with
 * exponential `friction` so the ball settles the same way at any frame rate.
 * Returns true while the ball is resting on the floor.
 */
export function stepProjectile(
  p: Projectile,
  gravity: number,
  bounds: GroundBounds,
  restitution: number,
  friction: number,
  dt: number,
): boolean {
  p.vel.y += gravity * dt;
  p.pos.x += p.vel.x * dt;
  p.pos.y += p.vel.y * dt;

  if (p.pos.x < bounds.minX) {
    p.pos.x = bounds.minX;
    p.vel.x = Math.abs(p.vel.x) * restitution;
  } else if (p.pos.x > bounds.maxX) {
    p.pos.x = bounds.maxX;
    p.vel.x = -Math.abs(p.vel.x) * restitution;
  }

  if (p.pos.y >= bounds.floorY) {
    p.pos.y = bounds.floorY;
    p.vel.y = -Math.abs(p.vel.y) * restitution;
    p.vel.x *= Math.exp(-friction * dt);
    if (Math.abs(p.vel.y) < 30) {
      p.vel.y = 0;
      return true;
    }
  }
  return false;
}
