import { vec2, set } from '../math/vec2';
import { WORLD } from '../config';
import type { PetSimulation } from '../core/PetSimulation';
import type { Behavior } from './Behavior';

/** Patrol between random waypoints on alternating sides, pausing to sniff. */
export class WalkBehavior implements Behavior {
  readonly name = 'walk' as const;

  private waypoint = 0;
  private pause = 0;
  private readonly sniff = vec2();

  enter(sim: PetSimulation): void {
    this.pause = 0;
    this.pickWaypoint(sim);
  }

  update(sim: PetSimulation, dt: number): void {
    const c = sim.controls;
    const x = sim.rig.hips.x;
    c.maxSpeed = 85;
    c.excitement = 0.45;

    if (this.pause > 0) {
      this.pause -= dt;
      c.moveTargetX = x;
      if (this.pause <= 0) this.pickWaypoint(sim);
    } else {
      c.moveTargetX = this.waypoint;
      const dx = this.waypoint - x;
      if (Math.abs(dx) > 6) c.facing = dx > 0 ? 1 : -1;
      else this.pause = 0.6 + Math.random() * 1.2;
    }

    if (sim.pointer.active) {
      c.lookAt = sim.pointer.pos;
    } else {
      // Nose down towards the ground a little ahead of the paws.
      set(this.sniff, x + c.facing * 120, sim.groundY);
      c.lookAt = this.sniff;
    }
  }

  exit(): void {}

  private pickWaypoint(sim: PetSimulation): void {
    const min = WORLD.edgeMargin + 40;
    const max = sim.width - WORLD.edgeMargin - 40;
    const onLeft = sim.rig.hips.x < sim.width / 2;
    const span = (max - min) * 0.4;
    this.waypoint = onLeft ? max - Math.random() * span : min + Math.random() * span;
  }
}
