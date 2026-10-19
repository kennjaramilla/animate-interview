import type { Ball } from '../core/Ball';
import { PALETTE } from '../config';

const TAU = Math.PI * 2;
/** Seam arcs: circles centred just outside the ball, so only a curved sliver crosses it. */
const SEAM_OFFSET = 1.3;
const SEAM_RADIUS = 0.95;
const SEAM_SPAN = 0.85;

/**
 * Tennis ball painter. The shading gradient is built once in ball-local
 * coordinates and reused by translating the context, so drawing allocates
 * nothing per frame.
 */
export class BallPainter {
  private readonly felt: CanvasGradient;

  constructor(ctx: CanvasRenderingContext2D, radius: number) {
    // Lit from the top-left; stays fixed while the seam spins underneath.
    this.felt = ctx.createRadialGradient(-radius * 0.35, -radius * 0.4, radius * 0.1, 0, 0, radius);
    this.felt.addColorStop(0, PALETTE.ballFelt);
    this.felt.addColorStop(0.7, PALETTE.ballFelt);
    this.felt.addColorStop(1, PALETTE.ballShade);
  }

  /** Ground shadow; drawn before the pet so the pet can stand over it. */
  drawShadow(ctx: CanvasRenderingContext2D, ball: Ball, groundY: number): void {
    if (!ball.visible) return;
    const k = Math.min(Math.max(ball.height, 0) / 220, 1);
    ctx.globalAlpha = 1 - k * 0.75;
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(ball.pos.x, groundY + 2, ball.radius * (1.3 - k * 0.6), 3 - k, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  draw(ctx: CanvasRenderingContext2D, ball: Ball): void {
    if (!ball.visible) return;
    const r = ball.radius;
    const s = Math.min(Math.max(ball.squash.value, -0.25), 0.4);

    ctx.save();
    // Squash about the contact point while touching the floor, else about the centre.
    const pivot = ball.onFloor && ball.state === 'free' ? r : 0;
    ctx.translate(ball.pos.x, ball.pos.y + pivot);
    ctx.scale(1 + s * 0.7, 1 - s);
    ctx.translate(0, -pivot);

    ctx.fillStyle = this.felt;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    ctx.rotate(ball.spin);
    ctx.strokeStyle = PALETTE.ballSeam;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-r * SEAM_OFFSET, 0, r * SEAM_RADIUS, -SEAM_SPAN, SEAM_SPAN);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * SEAM_OFFSET, 0, r * SEAM_RADIUS, Math.PI - SEAM_SPAN, Math.PI + SEAM_SPAN);
    ctx.stroke();
    ctx.restore();
  }
}
