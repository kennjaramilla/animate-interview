import type { PetBehavior } from '../core/types';
import type { Behavior } from './Behavior';
import { FetchBehavior } from './FetchBehavior';
import { IdleBehavior } from './IdleBehavior';
import { WalkBehavior } from './WalkBehavior';

export function createBehaviors(): Record<PetBehavior, Behavior> {
  return {
    idle: new IdleBehavior(),
    walk: new WalkBehavior(),
    fetch: new FetchBehavior(),
  };
}
