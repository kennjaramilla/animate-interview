import type { PetSimulation } from '../core/PetSimulation';
import type { PetBehavior } from '../core/types';
import { BALL, PALETTE } from '../config';
import { BallPainter } from './drawBall';
import { drawPet } from './drawPet';
import { DebugOverlay } from './DebugOverlay';
import { TexturedBody } from './TexturedBody';

/** Pet opacity under the skeleton overlay, so bones stay readable. */
const DEBUG_PET_ALPHA = 0.45;
/** Weight of the newest frame in the frame-time moving average. */
const FRAME_EMA = 0.1;
/** Seconds between perf text rebuilds; building strings every frame would allocate. */
const HUD_INTERVAL = 0.25;

/**
 * Draws a simulation snapshot. Read-only with respect to the simulation, so
 * swapping this for a Skia / React Native renderer wouldn't touch the math.
 */
export class CanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly width: number;
  private readonly height: number;
  private dpr = 0;
  private readonly sky: CanvasGradient;
  private readonly overlay = new DebugOverlay();
  /** Draws the skeleton / IK overlay on top of the pet. */
  debug = false;
  /** Warps the body texture over the mesh instead of drawing the vector body. */
  textured = true;
  private readonly texturedBody = new TexturedBody();
  private frameMs = 0;
  private hudTimer = HUD_INTERVAL;
  private perfText = '';
  private stateText = '';
  private stateFor: PetBehavior | null = null;
  private readonly ball: BallPainter;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not acquire 2D canvas context');
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = width;
    this.height = height;

    // Fluid CSS size, fixed simulation size; touch-action lets touch drags steer the gaze.
    canvas.style.width = '100%';
    canvas.style.maxWidth = `${width}px`;
    canvas.style.height = 'auto';
    canvas.style.touchAction = 'none';

    // Built once; gradients are reusable objects, so the frame loop allocates none.
    this.sky = ctx.createLinearGradient(0, 0, 0, height);
    this.sky.addColorStop(0, PALETTE.skyTop);
    this.sky.addColorStop(1, PALETTE.skyBottom);
    this.ball = new BallPainter(ctx, BALL.radius);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.texturedBody.dispose();
  }

  /** Sizes the backing store to the device pixel ratio so lines stay crisp on HiDPI screens. */
  private readonly resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
  };

  /** `frameSeconds` is the real (unclamped) time since the last frame, used for the perf HUD. */
  draw(sim: PetSimulation, frameSeconds = 0): void {
    this.trackFrameTime(frameSeconds);
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.sky;
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawGround(sim.groundY);
    this.ball.drawShadow(this.ctx, sim.ball, sim.groundY);
    this.drawPet(sim);
    // After the pet, so a held ball reads as gripped in the mouth.
    this.ball.draw(this.ctx, sim.ball);
    if (this.debug) this.overlay.draw(ctx, sim, this.textured);
    if (sim.pointer.active) this.drawPointer(sim.pointer.pos.x, sim.pointer.pos.y);
    this.drawHud(sim);
  }

  private drawGround(groundY: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, groundY, this.width, this.height - groundY);
    ctx.strokeStyle = PALETTE.groundLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(this.width, groundY);
    ctx.stroke();
  }

  private drawPet(sim: PetSimulation): void {
    const ctx = this.ctx;
    const rig = sim.rig;
    const sx = rig.displayScaleX;

    // Contact shadow shrinks and fades as the pet leaves the ground.
    const lift = Math.min(rig.height / 120, 1);
    ctx.fillStyle = PALETTE.shadow;
    ctx.globalAlpha = 1 - lift * 0.6;
    ctx.beginPath();
    ctx.ellipse(
      rig.hips.x + rig.facing * sx * 38,
      sim.groundY + 3,
      Math.max(60 * Math.abs(sx), 30) * (1 - lift * 0.4),
      6,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.globalAlpha = 1;

    // Turning: scale x about the hips from -1 to 1 so the mirror reads as a turn.
    ctx.save();
    ctx.translate(rig.hips.x, 0);
    ctx.scale(sx, 1);
    ctx.translate(-rig.hips.x, 0);
    ctx.globalAlpha = this.debug ? DEBUG_PET_ALPHA : 1;
    drawPet(ctx, rig, this.textured ? this.texturedBody : null);
    ctx.restore();
  }

  private drawPointer(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private trackFrameTime(seconds: number): void {
    // Skip the first frame and stalls (tab switches) so one outlier doesn't skew the average.
    if (seconds <= 0 || seconds > 1) return;
    const ms = seconds * 1000;
    this.frameMs = this.frameMs === 0 ? ms : this.frameMs + (ms - this.frameMs) * FRAME_EMA;
    this.hudTimer += seconds;
    if (this.hudTimer >= HUD_INTERVAL) {
      this.hudTimer = 0;
      this.perfText = `${Math.round(1000 / this.frameMs)} fps  ${this.frameMs.toFixed(1)} ms`;
    }
  }

  private drawHud(sim: PetSimulation): void {
    const ctx = this.ctx;
    // Rebuilt only when the behavior changes, not every frame.
    if (sim.behavior !== this.stateFor) {
      this.stateFor = sim.behavior;
      this.stateText = `State: ${sim.behavior.toUpperCase()}`;
    }
    ctx.fillStyle = '#64748b';
    ctx.font = '12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(this.stateText, 15, 25);
    if (this.debug && this.perfText) {
      ctx.fillStyle = '#22d3ee';
      ctx.fillText(this.perfText, 15, 42);
    }
  }
}
