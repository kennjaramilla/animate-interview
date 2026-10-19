import { vec2, set } from '../math/vec2';
import { WORLD } from '../config';
import { createBehaviors } from '../behaviors';
import type { Behavior } from '../behaviors/Behavior';
import { Ball } from './Ball';
import { PetRig } from './PetRig';
import type { PetBehavior, PointerState, RigControls } from './types';

export type BehaviorListener = (behavior: PetBehavior) => void;

/**
 * The whole pet world as plain data + math. No DOM, canvas or timers: the
 * host feeds it pointer positions and delta time, and reads state back to
 * draw. That keeps it portable (React Native, worker, tests).
 */
export class PetSimulation {
  readonly width: number;
  readonly height: number;
  readonly groundY: number;
  readonly pointer: PointerState = { active: false, pos: vec2() };
  readonly rig: PetRig;
  readonly controls: RigControls;
  readonly ball: Ball;
  time = 0;

  private readonly behaviors: Record<PetBehavior, Behavior>;
  private current: Behavior;
  private readonly behaviorListeners: BehaviorListener[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.groundY = height - WORLD.groundInset;
    this.rig = new PetRig(width / 2, this.groundY, width);
    this.controls = {
      moveTargetX: width / 2,
      maxSpeed: 0,
      facing: 1,
      excitement: 0,
      lookAt: null,
      reachFor: null,
      crouch: 0,
      jump: 0,
    };
    this.ball = new Ball(width, this.groundY);
    this.behaviors = createBehaviors();
    this.current = this.behaviors.idle;
    this.current.enter(this);
  }

  get behavior(): PetBehavior {
    return this.current.name;
  }

  /** Switches behavior. Re-selecting the active one restarts it (e.g. another throw). */
  setBehavior(name: PetBehavior): void {
    this.current.exit(this);
    this.current = this.behaviors[name];
    this.current.enter(this);
    // Snapshot so a listener may unsubscribe while being notified.
    for (const listener of this.behaviorListeners.slice()) listener(name);
  }

  /** Called after every setBehavior, including switches a behavior makes itself. Returns an unsubscribe. */
  onBehaviorChange(listener: BehaviorListener): () => void {
    this.behaviorListeners.push(listener);
    return () => {
      const i = this.behaviorListeners.indexOf(listener);
      if (i >= 0) this.behaviorListeners.splice(i, 1);
    };
  }

  clearBehaviorListeners(): void {
    this.behaviorListeners.length = 0;
  }

  setPointer(x: number, y: number): void {
    this.pointer.active = true;
    set(this.pointer.pos, x, y);
  }

  clearPointer(): void {
    this.pointer.active = false;
  }

  update(dt: number): void {
    this.time += dt;
    this.controls.lookAt = null;
    this.controls.reachFor = null;
    this.controls.jump = 0;
    this.current.update(this, dt);
    this.rig.update(this.controls, dt);
    // After the rig, so a held ball sits on this step's mouth position.
    this.ball.update(this.rig, dt);
  }
}
