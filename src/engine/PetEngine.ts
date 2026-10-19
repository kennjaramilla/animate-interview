import { LOOP } from './config';
import { type BehaviorListener, PetSimulation } from './core/PetSimulation';
import type { PetBehavior } from './core/types';
import { PointerInput } from './input/PointerInput';
import { CanvasRenderer } from './render/CanvasRenderer';

export type { PetBehavior } from './core/types';
export type { BehaviorListener } from './core/PetSimulation';

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

  /** Notifies on every behavior switch, including ones the simulation makes itself. Returns an unsubscribe. */
  public onBehaviorChange(listener: BehaviorListener): () => void {
    return this.sim.onBehaviorChange(listener);
  }

  get debug(): boolean {
    return this.renderer.debug;
  }

  /** Shows or hides the skeleton / IK overlay and perf HUD. */
  public setDebug(enabled: boolean): void {
    this.renderer.debug = enabled;
  }

  /** Flips the debug overlay and returns the new state. */
  public toggleDebug(): boolean {
    this.renderer.debug = !this.renderer.debug;
    return this.renderer.debug;
  }

  get textured(): boolean {
    return this.renderer.textured;
  }

  /** Switches the body between the warped image (textured) and the vector outline. */
  public setTextured(enabled: boolean): void {
    this.renderer.textured = enabled;
  }

  public toggleTextured(): boolean {
    this.renderer.textured = !this.renderer.textured;
    return this.renderer.textured;
  }

  private startLoop() {
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.renderStep);
  }

  private readonly renderStep = (timestamp: number): void => {
    const frameSeconds = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    // Clamp so a backgrounded tab doesn't come back with one giant step.
    let remaining = Math.min(Math.max(frameSeconds, 0), LOOP.maxFrameTime);

    // Sub-step long frames so springs and ball physics behave the same at 30, 60 or 144Hz.
    while (remaining > 1e-6) {
      const step = Math.min(remaining, LOOP.maxStep);
      this.sim.update(step);
      remaining -= step;
    }

    this.renderer.draw(this.sim, frameSeconds);
    this.animationFrameId = requestAnimationFrame(this.renderStep);
  };

  public destroy() {
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.sim.clearBehaviorListeners();
    this.input.dispose();
    this.renderer.dispose();
  }
}
