import { describe, expect, it } from 'vitest';
import { solveTriangleAffine } from '../affine';

const apply = (m: number[], u: number, v: number) => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]];

describe('solveTriangleAffine', () => {
  it('maps each source corner onto its destination corner', () => {
    const m: number[] = [];
    const src = [10, 5, 60, 8, 20, 40];
    const dst = [100, 200, 150, 190, 95, 260];
    expect(solveTriangleAffine(m, ...(src as [number, number, number, number, number, number]),
      ...(dst as [number, number, number, number, number, number]))).toBe(true);
    for (let i = 0; i < 3; i++) {
      const [x, y] = apply(m, src[i * 2], src[i * 2 + 1]);
      expect(x).toBeCloseTo(dst[i * 2], 9);
      expect(y).toBeCloseTo(dst[i * 2 + 1], 9);
    }
  });

  it('recovers a pure rotation + translation', () => {
    const m: number[] = [];
    const r = Math.PI / 6;
    const rot = (u: number, v: number) => [u * Math.cos(r) - v * Math.sin(r) + 7, u * Math.sin(r) + v * Math.cos(r) - 3];
    const [a, b, c] = [rot(0, 0), rot(10, 0), rot(0, 10)];
    solveTriangleAffine(m, 0, 0, 10, 0, 0, 10, a[0], a[1], b[0], b[1], c[0], c[1]);
    expect(m[0]).toBeCloseTo(Math.cos(r), 9);
    expect(m[1]).toBeCloseTo(Math.sin(r), 9);
    expect(m[4]).toBeCloseTo(7, 9);
    expect(m[5]).toBeCloseTo(-3, 9);
  });

  it('rejects a degenerate source triangle', () => {
    expect(solveTriangleAffine([], 0, 0, 1, 1, 2, 2, 0, 0, 1, 0, 0, 1)).toBe(false);
  });
});
