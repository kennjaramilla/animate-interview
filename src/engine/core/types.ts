import type { Vec2 } from '../math/vec2';

export type PetBehavior = 'idle' | 'walk' | 'fetch';

export type Facing = 1 | -1;

export interface PointerState {
  active: boolean;
  pos: Vec2;
}

/**
 * The only channel from behaviors to the rig. A behavior decides *what* the
 * pet wants (go there, look at that); the rig decides *how* the body gets
 * there (springs, IK, gait). Transient fields are reset every step.
 */
export interface RigControls {
  /** World x the pet walks towards. */
  moveTargetX: number;
  /** Locomotion speed cap in px/s. */
  maxSpeed: number;
  facing: Facing;
  /** 0 = calm, 1 = very excited. Drives tail wag and ear bounce. */
  excitement: number;
  /** Point the head and eyes track this step, or null for a resting gaze. */
  lookAt: Vec2 | null;
  /** Point the mouth should reach for (stretching neck and spine), or null. Wins over lookAt. */
  reachFor: Vec2 | null;
  /** 0 = standing tall, 1 = crouched low. */
  crouch: number;
  /** One-shot jump request: upward launch speed in px/s, 0 for none. Reset every step. */
  jump: number;
}
