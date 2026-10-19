import { vec2, set } from '../math/vec2';
import { type GroundBounds, type Projectile, stepProjectile } from '../math/ballistics';
import { damp, TAU } from '../math/scalar';
import { type Spring1, stepSpring1 } from '../math/spring';
import { BALL, WORLD } from '../config';
import type { PetRig } from './PetRig';

/**
 * hidden: not in the world yet.
 * posed:  placed by a behavior (e.g. in the thrower's hand), no physics.
 * free:   flying, bouncing or rolling under gravity.
 * held:   in the pet's mouth.
 */
export type BallState = 'hidden' | 'posed' | 'free' | 'held';

const SQUASH_SPRING = { frequency: 9, dampingRatio: 0.35 };

/**
 * The fetch ball. Owned by the simulation so it keeps falling and settles
 * however behaviors switch; behaviors only pose, launch, grab or release it.
 */
export class Ball implements Projectile {
  readonly pos = vec2();
  readonly vel = vec2();
  readonly radius = BALL.radius;
  readonly bounds: GroundBounds;
  state: BallState = 'hidden';
  /** Seam rotation in radians. */
  spin = 0;
  /** Touching the floor this step (bouncing, rolling or settled). */
  onFloor = false;
  /** On the floor with no speed left. */
  settled = false;
  /** Impact squash: 0 = round, positive = flattened against the floor. */
  readonly squash: Spring1 = { value: 0, velocity: 0 };

  private spinRate = 0;
  /** Offset from the mouth at the moment of a catch, eased to zero so the ball slides in. */
  private readonly hold = vec2();

  constructor(width: number, groundY: number) {
    this.bounds = { floorY: groundY - this.radius, minX: this.radius, maxX: width - this.radius };
  }

  get visible(): boolean {
    return this.state !== 'hidden';
  }

  /** Height of the ball's centre above its resting height on the floor. */
  get height(): number {
    return this.bounds.floorY - this.pos.y;
  }

  /** Free and rolling or lying on the floor (no vertical motion left). */
  get grounded(): boolean {
    return this.state === 'free' && this.onFloor && this.vel.y === 0;
  }

  pose(x: number, y: number): void {
    this.state = 'posed';
    set(this.pos, x, y);
    set(this.vel, 0, 0);
    this.settled = false;
  }

  hide(): void {
    this.state = 'hidden';
    set(this.vel, 0, 0);
    this.settled = false;
  }

  launch(vx: number, vy: number): void {
    this.state = 'free';
    set(this.vel, vx, vy);
    // Thrown balls tumble forwards, slower than they would roll.
    this.spinRate = (vx / this.radius) * 0.5;
    this.settled = false;
    this.onFloor = false;
  }

  grab(rig: PetRig): void {
    rig.toDisplay(this.hold, rig.mouth);
    set(this.hold, this.pos.x - this.hold.x, this.pos.y - this.hold.y);
    this.state = 'held';
    this.settled = false;
  }

  /** Lets go of a posed or held ball; it inherits the given velocity. */
  release(vx: number, vy: number): void {
    if (this.state === 'posed' || this.state === 'held') this.launch(vx, vy);
  }

  update(rig: PetRig, dt: number): void {
    if (this.state === 'held') this.followMouth(rig, dt);
    else if (this.state === 'free') this.stepFree(dt);
    stepSpring1(this.squash, 0, SQUASH_SPRING, dt);
  }

  private followMouth(rig: PetRig, dt: number): void {
    // Mid-turn the renderer scales x about the hips, so track the mouth as displayed.
    rig.toDisplay(this.pos, rig.mouth);
    this.hold.x = damp(this.hold.x, 0, 16, dt);
    this.hold.y = damp(this.hold.y, 0, 16, dt);
    this.pos.x += this.hold.x;
    this.pos.y += this.hold.y;
    this.spin = damp(this.spin, 0, 4, dt);
  }

  private stepFree(dt: number): void {
    const impactSpeed = this.vel.y + WORLD.gravity * dt;
    const resting = stepProjectile(this, WORLD.gravity, this.bounds, BALL.restitution, BALL.friction, dt);
    const wasOnFloor = this.onFloor;
    this.onFloor = this.pos.y >= this.bounds.floorY - 0.01;

    if (this.onFloor) {
      if (!wasOnFloor && impactSpeed > 120) this.squash.velocity += impactSpeed * 0.012;
      // Rolling without slipping: angular speed = ground speed / radius.
      this.spinRate = this.vel.x / this.radius;
    }
    if (resting && Math.abs(this.vel.x) < BALL.restSpeed) {
      this.vel.x = 0;
      this.settled = true;
    } else {
      this.settled = false;
    }
    this.spin = (this.spin + this.spinRate * dt) % TAU;
  }
}
