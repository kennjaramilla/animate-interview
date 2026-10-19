import type { Vec2 } from '../math/vec2';
import { solveTriangleAffine } from '../math/affine';
import {
  MESH_COLS,
  MESH_HALF_HEIGHT,
  MESH_REAR_CAP,
  MESH_ROWS,
  meshRestX,
  meshRestY,
} from '../core/bodyMesh';
import bodyTextureUrl from './assets/dog-body.svg?url';

/** Texture pixels per mesh unit; 4 keeps the fur crisp at 2x DPR plus some stretch. */
const TEXEL_SCALE = 4;
/** Clip triangles are grown by this much (px) so anti-aliased edges don't leave seams. */
const SEAM_BLEED = 0.7;

/**
 * Draws the body image onto the deformed body mesh, Spine-style: the grid is
 * split into triangles and each one is drawn with its own affine transform
 * (rest/texture triangle → deformed triangle), clipped to the triangle.
 * Canvas 2D has no textured triangles, so affine-per-triangle is the
 * standard way to warp an image by a mesh.
 */
export class TexturedBody {
  private texture: HTMLCanvasElement | null = null;
  private readonly image = new Image();
  private readonly indices: number[] = [];
  /** Texture-space pixel coordinates per mesh vertex, interleaved u, v. */
  private readonly uv: number[] = [];
  private readonly m: number[] = [0, 0, 0, 0, 0, 0];

  constructor() {
    for (let row = 0; row < MESH_ROWS; row++) {
      for (let col = 0; col < MESH_COLS; col++) {
        this.uv.push((meshRestX(col) + MESH_REAR_CAP) * TEXEL_SCALE, (meshRestY(row) + MESH_HALF_HEIGHT) * TEXEL_SCALE);
      }
    }
    for (let row = 0; row < MESH_ROWS - 1; row++) {
      for (let col = 0; col < MESH_COLS - 1; col++) {
        const a = row * MESH_COLS + col;
        const b = a + 1;
        const c = a + MESH_COLS;
        const d = c + 1;
        this.indices.push(a, b, d, a, d, c);
      }
    }

    // Rasterise the SVG once into a canvas so per-frame draws never re-render vector data.
    this.image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round((meshRestX(MESH_COLS - 1) + MESH_REAR_CAP) * TEXEL_SCALE);
      canvas.height = MESH_HALF_HEIGHT * 2 * TEXEL_SCALE;
      canvas.getContext('2d')?.drawImage(this.image, 0, 0, canvas.width, canvas.height);
      this.texture = canvas;
    };
    this.image.src = bodyTextureUrl;
  }

  get ready(): boolean {
    return this.texture !== null;
  }

  dispose(): void {
    this.image.onload = null;
  }

  draw(ctx: CanvasRenderingContext2D, mesh: readonly Vec2[]): void {
    const tex = this.texture;
    if (!tex) return;
    const { indices, uv, m } = this;

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];
      const p0 = mesh[i0];
      const p1 = mesh[i1];
      const p2 = mesh[i2];
      const u0 = uv[i0 * 2];
      const v0 = uv[i0 * 2 + 1];
      const u1 = uv[i1 * 2];
      const v1 = uv[i1 * 2 + 1];
      const u2 = uv[i2 * 2];
      const v2 = uv[i2 * 2 + 1];
      if (!solveTriangleAffine(m, u0, v0, u1, v1, u2, v2, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y)) continue;

      ctx.save();
      ctx.beginPath();
      const cx = (p0.x + p1.x + p2.x) / 3;
      const cy = (p0.y + p1.y + p2.y) / 3;
      bleedTo(ctx, p0, cx, cy, true);
      bleedTo(ctx, p1, cx, cy, false);
      bleedTo(ctx, p2, cx, cy, false);
      ctx.closePath();
      ctx.clip();

      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      // Only copy the texels under this triangle, padded for the bleed.
      const sx = Math.max(Math.min(u0, u1, u2) - 2, 0);
      const sy = Math.max(Math.min(v0, v1, v2) - 2, 0);
      const sw = Math.min(Math.max(u0, u1, u2) + 2, tex.width) - sx;
      const sh = Math.min(Math.max(v0, v1, v2) + 2, tex.height) - sy;
      ctx.drawImage(tex, sx, sy, sw, sh, sx, sy, sw, sh);
      ctx.restore();
    }
  }
}

/** Path vertex pushed away from the triangle centroid by SEAM_BLEED. */
function bleedTo(ctx: CanvasRenderingContext2D, p: Vec2, cx: number, cy: number, first: boolean): void {
  const dx = p.x - cx;
  const dy = p.y - cy;
  const k = SEAM_BLEED / (Math.hypot(dx, dy) || 1);
  const x = p.x + dx * k;
  const y = p.y + dy * k;
  if (first) ctx.moveTo(x, y);
  else ctx.lineTo(x, y);
}
