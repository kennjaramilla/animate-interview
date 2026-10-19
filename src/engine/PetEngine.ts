import { LOOP } from './config';
import { PetSimulation } from './core/PetSimulation';
import type { PetBehavior } from './core/types';
import { PointerInput } from './input/PointerInput';
import { CanvasRenderer } from './render/CanvasRenderer';

export type { PetBehavior } from './core/types';

/**
 * Host for the pet: owns the frame loop and wires DOM input and the canvas
 * renderer to the platform-agnostic simulation.
 */
export class PetAnimationEngine {
  private readonly sim: PetSimulation;
  private readonly renderer: CanvasRenderer;
  private readonly input: PointerInput;
  private animationFrameId: number | null = null;
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    // The canvas attributes define the simulation's coordinate space.
    const { width, height } = canvas;
    this.sim = new PetSimulation(width, height);
    this.renderer = new CanvasRenderer(canvas, width, height);
    this.input = new PointerInput(canvas, width, height, this.sim);
    this.startLoop();
  }

  get behavior(): PetBehavior {
    return this.sim.behavior;
  }

  public setBehavior(behavior: PetBehavior) {
    this.sim.setBehavior(behavior);
  }

  private startLoop() {
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.renderStep);
  }

  private readonly renderStep = (timestamp: number): void => {
    // Clamp so a backgrounded tab doesn't come back with one giant step.
    let remaining = Math.min(Math.max((timestamp - this.lastTime) / 1000, 0), LOOP.maxFrameTime);
    this.lastTime = timestamp;

    // Sub-step long frames so springs and ball physics behave the same at 30, 60 or 144Hz.
    while (remaining > 1e-6) {
      const step = Math.min(remaining, LOOP.maxStep);
      this.sim.update(step);
      remaining -= step;
    }

    this.renderer.draw(this.sim);
    this.animationFrameId = requestAnimationFrame(this.renderStep);
  };

  public destroy() {
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.input.dispose();
    this.renderer.dispose();
  }
}
