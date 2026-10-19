import type { PetSimulation } from '../core/PetSimulation';
import type { Behavior } from './Behavior';

/** Placeholder until the ball and intercept logic land: sit up and look expectant. */
export class FetchBehavior implements Behavior {
  readonly name = 'fetch' as const;

  enter(): void {}

  update(sim: PetSimulation): void {
    const c = sim.controls;
    c.moveTargetX = sim.rig.hips.x;
    c.maxSpeed = 0;
    c.excitement = 1;
    c.lookAt = sim.pointer.active ? sim.pointer.pos : null;
  }

  exit(): void {}
}
