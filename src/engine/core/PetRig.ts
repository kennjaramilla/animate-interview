import { type Vec2, vec2, set } from '../math/vec2';
import { clamp, damp } from '../math/scalar';
import { WORLD } from '../config';
import type { Facing, RigControls } from './types';

/**
 * Pose solver: turns high-level controls into joint positions.
 * Placeholder primitive rig (body + head node) until the skeleton lands.
 */
export class PetRig {
  readonly hips: Vec2;
  readonly head = vec2();
  facing: Facing = 1;
  velocityX = 0;

  private readonly minX: number;
  private readonly maxX: number;
  private readonly headLean = vec2();

  constructor(x: number, groundY: number, width: number) {
    this.hips = vec2(x, groundY - 50);
    this.minX = WORLD.edgeMargin;
    this.maxX = width - WORLD.edgeMargin;
  }

  update(c: RigControls, dt: number): void {
    this.facing = c.facing;

    // Steer towards the target with a speed cap, easing velocity so starts and stops aren't instant.
    const desired = clamp((c.moveTargetX - this.hips.x) * 3, -c.maxSpeed, c.maxSpeed);
    this.velocityX = damp(this.velocityX, desired, 6, dt);
    this.hips.x = clamp(this.hips.x + this.velocityX * dt, this.minX, this.maxX);

    let leanX = 0;
    let leanY = 0;
    if (c.lookAt) {
      const dx = c.lookAt.x - this.hips.x;
      const dy = c.lookAt.y - (this.hips.y - 40);
      const d = Math.hypot(dx, dy) || 1;
      leanX = (dx / d) * 8;
      leanY = (dy / d) * 8;
    }
    this.headLean.x = damp(this.headLean.x, leanX, 10, dt);
    this.headLean.y = damp(this.headLean.y, leanY, 10, dt);
    set(this.head, this.hips.x + this.headLean.x, this.hips.y - 40 + this.headLean.y);
  }
}
