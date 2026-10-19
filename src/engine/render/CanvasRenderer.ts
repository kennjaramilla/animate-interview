import type { PetSimulation } from '../core/PetSimulation';

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

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
  }

  /** Sizes the backing store to the device pixel ratio so lines stay crisp on HiDPI screens. */
  private readonly resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
  };

  draw(sim: PetSimulation): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    this.drawGround(sim.groundY);
    this.drawPet(sim);
    if (sim.pointer.active) this.drawPointer(sim.pointer.pos.x, sim.pointer.pos.y);
    this.drawHud(sim);
  }

  private drawGround(groundY: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, groundY, this.width, this.height - groundY);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(this.width, groundY);
    ctx.stroke();
  }

  private drawPet(sim: PetSimulation): void {
    const ctx = this.ctx;
    const { hips, head } = sim.rig;

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#94a3b8';

    ctx.beginPath();
    ctx.arc(hips.x, hips.y, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#475569';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(head.x, head.y, 17.5, 0, Math.PI * 2);
    ctx.fillStyle = '#64748b';
    ctx.fill();
    ctx.stroke();
  }

  private drawPointer(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawHud(sim: PetSimulation): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#64748b';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(`State: ${sim.behavior.toUpperCase()}`, 15, 25);
  }
}
