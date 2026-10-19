/**
 * Affine map taking a source triangle (u, v) onto a destination triangle
 * (x, y), in canvas `transform(a, b, c, d, e, f)` order:
 *   x = a·u + c·v + e
 *   y = b·u + d·v + f
 * Solved from the two edge vectors of each triangle (Cramer's rule). This is
 * how a textured mesh is drawn on a 2D canvas: one affine per triangle.
 * Writes into `out` (length ≥ 6) and returns false for a degenerate source.
 */
export function solveTriangleAffine(
  out: number[],
  u0: number, v0: number, u1: number, v1: number, u2: number, v2: number,
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
): boolean {
  const du1 = u1 - u0;
  const dv1 = v1 - v0;
  const du2 = u2 - u0;
  const dv2 = v2 - v0;
  const det = du1 * dv2 - du2 * dv1;
  if (Math.abs(det) < 1e-9) return false;

  const dx1 = x1 - x0;
  const dy1 = y1 - y0;
  const dx2 = x2 - x0;
  const dy2 = y2 - y0;
  const a = (dx1 * dv2 - dx2 * dv1) / det;
  const b = (dy1 * dv2 - dy2 * dv1) / det;
  const c = (dx2 * du1 - dx1 * du2) / det;
  const d = (dy2 * du1 - dy1 * du2) / det;
  out[0] = a;
  out[1] = b;
  out[2] = c;
  out[3] = d;
  out[4] = x0 - a * u0 - c * v0;
  out[5] = y0 - b * u0 - d * v0;
  return true;
}
