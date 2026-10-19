import { type GroundBounds, type Projectile, timeToDescendTo } from './ballistics';
import { clamp } from './scalar';

/** What the chaser can do. Heights are ball-centre heights above its floor rest height. */
export interface Chaser {
  /** Current x of the chaser's body anchor (the dog's hips). */
  x: number;
  minX: number;
  maxX: number;
  /** Top running speed in px/s. */
  maxSpeed: number;
  /** Seconds lost to turning and accelerating before reaching top speed. */
  reactionTime: number;
  /** Horizontal distance from the anchor to where the mouth naturally meets the ball. */
  reachOffset: number;
  /** Extra horizontal reach from stretching the neck and leaning, so the anchor needn't be exact. */
  reachSlack: number;
  /** Highest ball the mouth reaches standing (with neck stretch). */
  standReach: number;
  /** Highest ball the mouth reaches at the apex of a full jump. */
  jumpReach: number;
  /** A jump catch is skipped if a standing catch is possible within this many seconds after it. */
  jumpPatience: number;
}

export interface InterceptPlan {
  /** True if the ball can be caught before it lands (or, if already rolling, before it stops). */
  found: boolean;
  /** Seconds from now until the catch, or until landing when not found. */
  time: number;
  /** Ball position at `time`. */
  x: number;
  height: number;
  /** Where the chaser's anchor should be at `time`. */
  anchorX: number;
  /** Mouth has to be lifted above standing reach by this many px (0 = no jump). */
  jumpHeight: number;
}

export const createPlan = (): InterceptPlan => ({
  found: false,
  time: 0,
  x: 0,
  height: 0,
  anchorX: 0,
  jumpHeight: 0,
});

/** Mirrors x back into [min, max] as many times as needed, modelling wall bounces. */
export function foldIntoRange(x: number, min: number, max: number): number {
  const w = max - min;
  if (w <= 0) return min;
  let u = (x - min) % (2 * w);
  if (u < 0) u += 2 * w;
  return min + (u > w ? 2 * w - u : u);
}

/**
 * Earliest point on the ball's future path that the chaser can get its mouth to.
 *
 * The future is sampled at a fixed number of times (no allocation, bounded
 * cost, cheap enough to re-run every step as the ball bounces). A sample at
 * time t is reachable when:
 *   1. running there fits: (|anchor − x| − slack) / maxSpeed + reaction ≤ t,
 *   2. the height fits: h ≤ standReach, or h ≤ jumpReach and a jump started
 *      now could already be at that height: rise time √(2·Δh/g) ≤ t.
 *
 * A jump is only chosen when no standing catch follows within `jumpPatience`,
 * so the dog leaps when it has to, not whenever it could.
 *
 * In flight the path is p + v·t + ½·g·t² up to the landing time. A ball
 * already rolling decays as v·e^(−k·t) under the exponential friction, so its
 * position is x + v·(1 − e^(−k·t)) / k. Wall bounces are folded in by mirroring.
 * If nothing in flight is reachable the plan points at the landing spot.
 */
export function planIntercept(
  out: InterceptPlan,
  ball: Projectile,
  gravity: number,
  bounds: GroundBounds,
  friction: number,
  chaser: Chaser,
  samples = 48,
  rollHorizon = 4,
): InterceptPlan {
  const rolling = ball.pos.y >= bounds.floorY - 0.5 && Math.abs(ball.vel.y) < 1;
  const tEnd = rolling ? rollHorizon : timeToDescendTo(ball, gravity, bounds.floorY) ?? 0;

  let jumpFound = false;
  for (let i = 1; i <= samples; i++) {
    const t = (tEnd * i) / samples;
    if (jumpFound && t > out.time + chaser.jumpPatience) return out;
    const x = pathX(ball, bounds, rolling, friction, t);
    const h = rolling ? 0 : bounds.floorY - (ball.pos.y + ball.vel.y * t + 0.5 * gravity * t * t);
    if (h <= chaser.standReach) {
      if (reachable(out, chaser, gravity, t, x, h)) return out;
    } else if (!jumpFound) {
      jumpFound = reachable(out, chaser, gravity, t, x, h);
    }
  }
  if (jumpFound) return out;

  // Nothing catchable: head for where it touches down (or rolls to).
  const x = pathX(ball, bounds, rolling, friction, tEnd);
  fill(out, false, tEnd, x, 0, anchorFor(chaser, x), 0);
  return out;
}

function pathX(ball: Projectile, bounds: GroundBounds, rolling: boolean, friction: number, t: number): number {
  const travel = rolling && friction > 1e-6 ? (1 - Math.exp(-friction * t)) / friction : t;
  return foldIntoRange(ball.pos.x + ball.vel.x * travel, bounds.minX, bounds.maxX);
}

function anchorFor(c: Chaser, x: number): number {
  // Stand behind the ball on the side we're coming from, mouth towards it.
  const dir = x >= c.x ? 1 : -1;
  return clamp(x - dir * c.reachOffset, c.minX, c.maxX);
}

function reachable(out: InterceptPlan, c: Chaser, g: number, t: number, x: number, h: number): boolean {
  if (h > c.jumpReach) return false;
  const anchorX = anchorFor(c, x);
  // Clamped against a wall, the mouth may not stretch far enough to the ball.
  if (Math.abs(x - anchorX) > c.reachOffset + c.reachSlack) return false;

  const run = Math.max(Math.abs(anchorX - c.x) - c.reachSlack, 0) / c.maxSpeed;
  if (run + c.reactionTime > t) return false;

  const lift = Math.max(h - c.standReach, 0);
  if (lift > 0 && Math.sqrt((2 * lift) / g) > t) return false;

  fill(out, true, t, x, h, anchorX, lift);
  return true;
}

function fill(
  out: InterceptPlan,
  found: boolean,
  time: number,
  x: number,
  height: number,
  anchorX: number,
  jumpHeight: number,
): void {
  out.found = found;
  out.time = time;
  out.x = x;
  out.height = height;
  out.anchorX = anchorX;
  out.jumpHeight = jumpHeight;
}
