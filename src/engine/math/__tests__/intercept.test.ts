import { describe, expect, it } from 'vitest';
import { type Chaser, createPlan, foldIntoRange, planIntercept } from '../intercept';
import { launchVelocity, predictPosition, type Projectile } from '../ballistics';
import { vec2 } from '../vec2';

const G = 1400;
const FLOOR = 330;
const bounds = { floorY: FLOOR, minX: 8, maxX: 592 };
const FRICTION = 1.6;

const chaser = (x: number, overrides: Partial<Chaser> = {}): Chaser => ({
  x,
  minX: 70,
  maxX: 530,
  maxSpeed: 300,
  reactionTime: 0.15,
  reachOffset: 100,
  reachSlack: 20,
  standReach: 140,
  jumpReach: 240,
  jumpPatience: 0.25,
  ...overrides,
});

/** A throw from `from` that lands on the floor at `landX` after `t` seconds. */
const thrown = (from: { x: number; y: number }, landX: number, t: number): Projectile => {
  const p: Projectile = { pos: vec2(from.x, from.y), vel: vec2() };
  launchVelocity(p.vel, p.pos, vec2(landX, FLOOR), G, t);
  return p;
};

/** Checks the plan against the two reachability rules it claims to satisfy. */
const expectFeasible = (c: Chaser, plan: ReturnType<typeof createPlan>) => {
  const run = Math.max(Math.abs(plan.anchorX - c.x) - c.reachSlack, 0) / c.maxSpeed;
  expect(run + c.reactionTime).toBeLessThanOrEqual(plan.time + 1e-9);
  expect(plan.height).toBeLessThanOrEqual(c.jumpReach);
};

describe('foldIntoRange', () => {
  it('leaves inside values alone and mirrors off both walls', () => {
    expect(foldIntoRange(50, 0, 100)).toBe(50);
    expect(foldIntoRange(120, 0, 100)).toBe(80);
    expect(foldIntoRange(-30, 0, 100)).toBe(30);
    expect(foldIntoRange(230, 0, 100)).toBe(30);
  });
});

describe('planIntercept', () => {
  it('catches a ball dropping just in front of the dog without jumping', () => {
    const c = chaser(200, { jumpPatience: 1 });
    const ball = thrown({ x: 520, y: 200 }, 310, 1);
    const plan = planIntercept(createPlan(), ball, G, bounds, FRICTION, c);

    expect(plan.found).toBe(true);
    expect(plan.jumpHeight).toBe(0);
    expect(plan.height).toBeLessThanOrEqual(c.standReach);
    expect(plan.time).toBeLessThan(1);
    expectFeasible(c, plan);
  });

  it('returns the earliest catchable moment, not just any', () => {
    const c = chaser(200, { jumpPatience: 1 });
    const ball = thrown({ x: 520, y: 200 }, 310, 1);
    const plan = planIntercept(createPlan(), ball, G, bounds, FRICTION, c, 200);

    // Slightly earlier the ball is still above standing reach.
    const before = predictPosition(vec2(), ball, G, plan.time - 0.03);
    expect(FLOOR - before.y).toBeGreaterThan(c.standReach);
  });

  it('plans a jump for a ball passing overhead out of standing reach', () => {
    const c = chaser(300, { reactionTime: 0.05, jumpPatience: 0.1 });
    // Fast, high pass straight over the dog's head.
    const ball: Projectile = { pos: vec2(20, FLOOR - 200), vel: vec2(600, -350) };
    const plan = planIntercept(createPlan(), ball, G, bounds, FRICTION, c);

    expect(plan.found).toBe(true);
    expect(plan.jumpHeight).toBeGreaterThan(0);
    expect(plan.height).toBeGreaterThan(c.standReach);
    expect(Math.sqrt((2 * plan.jumpHeight) / G)).toBeLessThanOrEqual(plan.time);
    expectFeasible(c, plan);
  });

  it('jumps for an earlier catch only if standing would mean waiting too long', () => {
    const ball = thrown({ x: 520, y: 200 }, 310, 1);
    const eager = planIntercept(createPlan(), ball, G, bounds, FRICTION, chaser(200, { jumpPatience: 0 }));
    expect(eager.jumpHeight).toBeGreaterThan(0);
    const patient = planIntercept(createPlan(), ball, G, bounds, FRICTION, chaser(200, { jumpPatience: 0.4 }));
    expect(patient.jumpHeight).toBe(0);
    expect(patient.time).toBeGreaterThan(eager.time);
  });

  it('falls back to the landing spot when the ball is out of reach for the whole flight', () => {
    const c = chaser(300, { maxSpeed: 60, standReach: 60, jumpReach: 100 });
    const ball = thrown({ x: 20, y: 250 }, 560, 0.9);
    const plan = planIntercept(createPlan(), ball, G, bounds, FRICTION, c);

    expect(plan.found).toBe(false);
    expect(plan.time).toBeCloseTo(0.9, 6);
    expect(plan.x).toBeCloseTo(560, 6);
    expect(plan.anchorX).toBeCloseTo(460, 6);
  });

  it('a faster dog never catches later', () => {
    const ball = thrown({ x: 20, y: 250 }, 480, 1.1);
    const slow = planIntercept(createPlan(), ball, G, bounds, FRICTION, chaser(150, { maxSpeed: 200 }));
    const fast = planIntercept(createPlan(), ball, G, bounds, FRICTION, chaser(150, { maxSpeed: 400 }));
    expect(fast.found).toBe(true);
    expect(fast.time).toBeLessThanOrEqual(slow.time);
  });

  it('follows a rolling ball along its friction-decayed path', () => {
    const c = chaser(100);
    const ball: Projectile = { pos: vec2(300, FLOOR), vel: vec2(250, 0) };
    const plan = planIntercept(createPlan(), ball, G, bounds, FRICTION, c, 200);

    expect(plan.found).toBe(true);
    expect(plan.height).toBe(0);
    const expected = 300 + (250 * (1 - Math.exp(-FRICTION * plan.time))) / FRICTION;
    expect(plan.x).toBeCloseTo(expected, 6);
    expectFeasible(c, plan);
  });

  it('accounts for bouncing off a wall', () => {
    const c = chaser(450);
    const ball: Projectile = { pos: vec2(560, FLOOR), vel: vec2(300, 0) };
    const plan = planIntercept(createPlan(), ball, G, bounds, FRICTION, c, 200);
    expect(plan.found).toBe(true);
    expect(plan.x).toBeLessThanOrEqual(bounds.maxX);
  });

  it('handles a ball lying still without producing NaN', () => {
    const ball: Projectile = { pos: vec2(400, FLOOR), vel: vec2(0, 0) };
    const plan = planIntercept(createPlan(), ball, G, bounds, FRICTION, chaser(200));
    expect(plan.found).toBe(true);
    expect(plan.x).toBe(400);
    expect(Number.isFinite(plan.time)).toBe(true);
    expect(plan.anchorX).toBe(300);
  });
});
