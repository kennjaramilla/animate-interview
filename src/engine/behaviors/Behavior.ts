import type { PetSimulation } from '../core/PetSimulation';
import type { PetBehavior } from '../core/types';

/** A behavior writes `sim.controls` each step; it never moves joints itself. */
export interface Behavior {
  readonly name: PetBehavior;
  enter(sim: PetSimulation): void;
  update(sim: PetSimulation, dt: number): void;
  exit(sim: PetSimulation): void;
}
