import { describe, expect, it } from 'vitest';
import { Gait, type GaitLeg } from '../gait';
import { vec2 } from '../../math/vec2';

const GROUND = 300;
const OFFSETS = [6, 80, -2, 75];

function makeLegs(x: number): GaitLeg[] {
  return OFFSETS.map((o) => ({ socket: vec2(x + o, 250), target: vec2(x + o, GROUND) }));
}

function walk(gait: Gait, legs: GaitLeg[], speed: number, seconds: number, onStep?: () => void) {
  const dt = 1 / 120;
  let x = 0;
  for (let t = 0; t < seconds; t += dt) {
    x += speed * dt;
    legs.forEach((l, i) => (l.socket.x = x + OFFSETS[i]));
    gait.update(legs, 0, speed, GROUND, dt);
    onStep?.();
  }
  return x;
}

describe('Gait', () => {
  it('keeps every foot within a stride of its socket while walking', () => {
    const gait = new Gait([1, 0, 0, 1]);
    const legs = makeLegs(0);
    let worst = 0;
    walk(gait, legs, 90, 4, () =>
      legs.forEach((l) => (worst = Math.max(worst, Math.abs(l.target.x - l.socket.x)))),
    );
    expect(worst).toBeLessThan(40);
  });

  it('alternates the diagonal pairs', () => {
    const gait = new Gait([1, 0, 0, 1]);
    const legs = makeLegs(0);
    const order: number[] = [];
    const wasUp = [false, false];
    walk(gait, legs, 120, 3, () => {
      [legs[1], legs[0]].forEach((l, group) => {
        const up = l.target.y < GROUND - 0.5;
        if (up && !wasUp[group]) order.push(group);
        wasUp[group] = up;
      });
    });
    expect(order.length).toBeGreaterThan(6);
    for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
  });

  it('settles every foot back under its socket after stopping', () => {
    const gait = new Gait([1, 0, 0, 1]);
    const legs = makeLegs(0);
    walk(gait, legs, 90, 2);
    const dt = 1 / 120;
    for (let t = 0; t < 2; t += dt) gait.update(legs, 0, 0, GROUND, dt);
    legs.forEach((l) => {
      expect(Math.abs(l.target.x - l.socket.x)).toBeLessThanOrEqual(4);
      expect(l.target.y).toBe(GROUND);
    });
  });
});
