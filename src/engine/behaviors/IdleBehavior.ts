import { vec2, set } from '../math/vec2';
import type { PetSimulation } from '../core/PetSimulation';
import type { Behavior } from './Behavior';

/** Hold position, follow the cursor, and turn around if it stays behind us. */
export class IdleBehavior implements Behavior {
  readonly name = 'idle' as const;

  private behindFor = 0;
  private glanceIn = 0;
  private readonly glance = vec2();

  enter(sim: PetSimulation): void {
    this.behindFor = 0;
    this.glanceIn = 0;
    sim.controls.moveTargetX = sim.rig.hips.x;
  }

  update(sim: PetSimulation, dt: number): void {
    const c = sim.controls;
    const rig = sim.rig;
    c.moveTargetX = rig.hips.x;
    c.maxSpeed = 60;
    c.excitement = 0.15;

    if (sim.pointer.active) {
      c.lookAt = sim.pointer.pos;
      // Hysteresis: only turn once the cursor has been clearly behind for a moment.
      const forward = (sim.pointer.pos.x - rig.hips.x) * c.facing;
      this.behindFor = forward < -30 ? this.behindFor + dt : 0;
      if (this.behindFor > 0.35) {
        c.facing = c.facing === 1 ? -1 : 1;
        this.behindFor = 0;
      }
      return;
    }

    // No cursor: glance around now and then so the idle pose never looks frozen.
    this.glanceIn -= dt;
    if (this.glanceIn <= 0) {
      this.glanceIn = 2 + Math.random() * 3;
      set(
        this.glance,
        rig.hips.x + c.facing * (60 + Math.random() * 160),
        sim.groundY - 40 - Math.random() * 180,
      );
    }
    c.lookAt = this.glance;
  }

  exit(): void {}
}
