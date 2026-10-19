import { type Vec2, set } from '../math/vec2';
import { clamp, easeInOutSine } from '../math/scalar';

export interface GaitLeg {
  readonly socket: Vec2;
  /** Foot target the leg IK reaches for; owned by the gait while grounded. */
  readonly target: Vec2;
}

/**
 * Procedural trot. Feet stay planted in world space while the body moves
 * over them; once a foot trails its home spot by more than a stride
 * threshold, its diagonal pair lifts and swings to a spot ahead of the body
 * (home + velocity lead). Only one pair swings at a time, which is what
 * makes it read as a trot rather than four independent sliders.
 *
 * Swing: x eases from lift-off to landing, y follows a sine arc.
 * Speed shortens the swing and lengthens the stride, so walking and running
 * use the same code.
 */
export class Gait {
  /** Vertical body offset from the current step cycle (negative = up). */
  bob = 0;

  private readonly groups: readonly (0 | 1)[];
  private readonly fromX: number[];
  private readonly toX: number[];
  /** Swing progress per leg, 0..1, or -1 while planted. */
  private readonly t: number[];

  constructor(groups: readonly (0 | 1)[]) {
    this.groups = groups;
    this.fromX = groups.map(() => 0);
    this.toX = groups.map(() => 0);
    this.t = groups.map(() => -1);
  }

  /** Drops any swing in progress, e.g. when leaving the ground. */
  reset(): void {
    for (let i = 0; i < this.t.length; i++) this.t[i] = -1;
    this.bob = 0;
  }

  update(legs: readonly GaitLeg[], homeOffset: number, velocityX: number, groundY: number, dt: number): void {
    const speed = Math.abs(velocityX);
    const moving = speed > 8;
    const duration = clamp(0.26 - speed * 0.0005, 0.12, 0.26);
    // Land ahead of the body by about one swing's worth of travel.
    const lead = velocityX * duration;
    const threshold = moving ? 10 + speed * 0.05 : 4;
    const lift = 4 + Math.min(speed * 0.03, 8);

    let bob = 0;
    let swinging0 = 1;
    let swinging1 = 1;
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const home = leg.socket.x + homeOffset + lead;
      if (this.t[i] < 0) continue;

      this.t[i] = Math.min(this.t[i] + dt / duration, 1);
      // Keep aiming at the moving home so speed changes mid-swing still land well.
      this.toX[i] = home;
      const p = this.t[i];
      const arc = Math.sin(Math.PI * p);
      set(leg.target, this.fromX[i] + (this.toX[i] - this.fromX[i]) * easeInOutSine(p), groundY - lift * arc);
      bob = Math.min(bob, -arc * (moving ? 1.6 : 0.6));

      if (p >= 1) {
        this.t[i] = -1;
        leg.target.y = groundY;
      } else if (this.groups[i] === 0) {
        swinging0 = Math.min(swinging0, p);
      } else {
        swinging1 = Math.min(swinging1, p);
      }
    }
    this.bob = bob;

    // Pick which diagonal pair may lift: it must not be mid-swing already and
    // the other pair must be mostly down.
    let worst0 = 0;
    let worst1 = 0;
    for (let i = 0; i < legs.length; i++) {
      if (this.t[i] >= 0) continue;
      const off = Math.abs(legs[i].target.x - (legs[i].socket.x + homeOffset + lead));
      if (this.groups[i] === 0) worst0 = Math.max(worst0, off);
      else worst1 = Math.max(worst1, off);
    }
    const can0 = swinging0 === 1 && swinging1 > 0.6;
    const can1 = swinging1 === 1 && swinging0 > 0.6;
    if (worst0 > threshold && can0 && (worst0 >= worst1 || !can1)) this.lift(0, legs, groundY);
    else if (worst1 > threshold && can1) this.lift(1, legs, groundY);
  }

  private lift(group: 0 | 1, legs: readonly GaitLeg[], groundY: number): void {
    for (let i = 0; i < legs.length; i++) {
      if (this.groups[i] !== group || this.t[i] >= 0) continue;
      this.fromX[i] = legs[i].target.x;
      this.t[i] = 0;
      legs[i].target.y = groundY;
    }
  }
}
