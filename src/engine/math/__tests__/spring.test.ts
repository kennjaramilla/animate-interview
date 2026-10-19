import { describe, expect, it } from 'vitest';
import { stepSpring1, type Spring1 } from '../spring';
import { angleDelta, damp, wrapAngle } from '../scalar';

const run = (hz: number, seconds: number, cfg = { frequency: 2, dampingRatio: 1 }) => {
  const s: Spring1 = { value: 0, velocity: 0 };
  const dt = 1 / hz;
  for (let t = 0; t < seconds - 1e-9; t += dt) stepSpring1(s, 100, cfg, dt);
  return s.value;
};

describe('stepSpring1', () => {
  it('settles on the target', () => {
    expect(run(60, 3)).toBeCloseTo(100, 1);
  });

  it('behaves nearly the same at 60Hz and 120Hz', () => {
    expect(Math.abs(run(60, 0.25) - run(120, 0.25))).toBeLessThan(3);
  });

  it('stays stable with a huge time step', () => {
    const s: Spring1 = { value: 0, velocity: 0 };
    stepSpring1(s, 100, { frequency: 8, dampingRatio: 0.2 }, 2);
    expect(Number.isFinite(s.value)).toBe(true);
    expect(Math.abs(s.value)).toBeLessThan(200);
  });

  it('overshoots when under-damped', () => {
    const cfg = { frequency: 2, dampingRatio: 0.2 };
    const s: Spring1 = { value: 0, velocity: 0 };
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      stepSpring1(s, 100, cfg, 1 / 120);
      peak = Math.max(peak, s.value);
    }
    expect(peak).toBeGreaterThan(100);
  });
});

describe('scalar helpers', () => {
  it('damp converges identically regardless of step size', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 1, 5, 1 / 60);
    for (let i = 0; i < 120; i++) b = damp(b, 1, 5, 1 / 120);
    expect(a).toBeCloseTo(b, 10);
  });

  it('wraps angles and picks the short way round', () => {
    expect(wrapAngle(3 * Math.PI + 0.5)).toBeCloseTo(-Math.PI + 0.5, 10);
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2, 10);
  });
});
