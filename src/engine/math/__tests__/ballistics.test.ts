import { describe, expect, it } from 'vitest';
import {
  launchVelocity,
  predictPosition,
  stepProjectile,
  timeToDescendTo,
  type Projectile,
} from '../ballistics';
import { vec2 } from '../vec2';

const G = 1200;

describe('launchVelocity + predictPosition', () => {
  it('lands exactly on the target after the requested flight time', () => {
    const from = vec2(50, 300);
    const to = vec2(450, 320);
    const p: Projectile = { pos: vec2(from.x, from.y), vel: vec2() };
    launchVelocity(p.vel, from, to, G, 0.9);

    const landed = predictPosition(vec2(), p, G, 0.9);
    expect(landed.x).toBeCloseTo(to.x, 6);
    expect(landed.y).toBeCloseTo(to.y, 6);
  });
});

describe('timeToDescendTo', () => {
  it('returns the downward crossing, not the upward one', () => {
    const p: Projectile = { pos: vec2(0, 300), vel: vec2(0, -600) };
    const t = timeToDescendTo(p, G, 300)!;
    expect(t).toBeCloseTo(1, 6);
  });

  it('returns null when the arc never reaches the height', () => {
    const p: Projectile = { pos: vec2(0, 300), vel: vec2(0, -100) };
    expect(timeToDescendTo(p, G, 0)).toBeNull();
  });
});

describe('stepProjectile', () => {
  it('matches the analytic arc closely at 120Hz before touching the floor', () => {
    const p: Projectile = { pos: vec2(0, 300), vel: vec2(200, -500) };
    const bounds = { floorY: 1000, minX: -1e6, maxX: 1e6 };
    for (let i = 0; i < 60; i++) stepProjectile(p, G, bounds, 0.5, 2, 1 / 120);

    const expected = predictPosition(vec2(), { pos: vec2(0, 300), vel: vec2(200, -500) }, G, 0.5);
    expect(p.pos.x).toBeCloseTo(expected.x, 6);
    expect(Math.abs(p.pos.y - expected.y)).toBeLessThan(3);
  });

  it('bounces and eventually comes to rest on the floor', () => {
    const p: Projectile = { pos: vec2(100, 0), vel: vec2(150, 0) };
    const bounds = { floorY: 300, minX: 0, maxX: 600 };
    let resting = false;
    for (let i = 0; i < 600 && !resting; i++) resting = stepProjectile(p, G, bounds, 0.5, 3, 1 / 60);

    expect(resting).toBe(true);
    expect(p.pos.y).toBe(300);
  });
});
