import { describe, expect, it } from 'vitest';
import { createChain, solveFabrik, solveTwoBone } from '../ik';
import { distance, vec2 } from '../vec2';

const straightChain = () =>
  createChain([vec2(0, 0), vec2(20, 0), vec2(40, 0), vec2(60, 0)]);

describe('solveFabrik', () => {
  it('reaches a target inside the chain reach and keeps bone lengths', () => {
    const chain = straightChain();
    const target = vec2(30, 25);
    const error = solveFabrik(chain, vec2(0, 0), target);

    expect(error).toBeLessThan(0.5);
    chain.lengths.forEach((len, i) =>
      expect(distance(chain.joints[i], chain.joints[i + 1])).toBeCloseTo(len, 5),
    );
  });

  it('keeps the root pinned', () => {
    const chain = straightChain();
    solveFabrik(chain, vec2(5, 5), vec2(20, 30));
    expect(chain.joints[0]).toEqual({ x: 5, y: 5 });
  });

  it('stretches straight towards an unreachable target', () => {
    const chain = straightChain();
    const error = solveFabrik(chain, vec2(0, 0), vec2(0, 200));

    expect(error).toBeCloseTo(140, 5);
    chain.joints.forEach((j) => expect(j.x).toBeCloseTo(0, 5));
    expect(chain.joints[3].y).toBeCloseTo(60, 5);
  });
});

describe('solveTwoBone', () => {
  it('places knee and foot at the bone lengths when reachable', () => {
    const knee = vec2();
    const foot = vec2();
    solveTwoBone(vec2(0, 0), vec2(10, 30), 20, 20, 1, knee, foot);

    expect(distance(vec2(0, 0), knee)).toBeCloseTo(20, 5);
    expect(distance(knee, foot)).toBeCloseTo(20, 5);
    expect(foot.x).toBeCloseTo(10, 5);
    expect(foot.y).toBeCloseTo(30, 5);
  });

  it('bends the knee to opposite sides for opposite bend signs', () => {
    const kneeA = vec2();
    const kneeB = vec2();
    const foot = vec2();
    solveTwoBone(vec2(0, 0), vec2(0, 30), 20, 20, 1, kneeA, foot);
    solveTwoBone(vec2(0, 0), vec2(0, 30), 20, 20, -1, kneeB, foot);
    expect(Math.sign(kneeA.x)).toBe(-Math.sign(kneeB.x));
  });

  it('clamps an out-of-reach target to full extension', () => {
    const knee = vec2();
    const foot = vec2();
    solveTwoBone(vec2(0, 0), vec2(0, 100), 20, 20, 1, knee, foot);
    expect(foot.y).toBeCloseTo(40, 2);
    expect(Number.isFinite(knee.x)).toBe(true);
  });
});
