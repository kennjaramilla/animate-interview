import { vec2, set, distance } from '../math/vec2';
import { clamp, smoothstep } from '../math/scalar';
import { launchVelocity, predictPosition } from '../math/ballistics';
import { type Chaser, createPlan, planIntercept } from '../math/intercept';
import { BALL, FETCH, WORLD } from '../config';
import type { PetSimulation } from '../core/PetSimulation';
import type { Facing } from '../core/types';
import type { Behavior } from './Behavior';

type Phase = 'windup' | 'chase' | 'carry' | 'present' | 'celebrate';

/**
 * Throw → chase → catch → bring it back.
 *
 * The chase re-runs the intercept planner every step: it returns the
 * earliest moment the mouth can meet the ball and where the hips must be by
 * then. The behavior only turns that into intents (run there, look at the
 * ball, reach for it, jump now); the rig's IK does the stretching.
 */
export class FetchBehavior implements Behavior {
  readonly name = 'fetch' as const;

  private phase: Phase = 'windup';
  private t = 0;
  private elapsed = 0;
  private flightTime = 1;
  private throwDir: Facing = 1;
  private homeX = 0;
  /** Seconds since the last chase jump; gates re-jumping until we've landed. */
  private sinceJump = 0;
  private hopped = false;
  private readonly from = vec2();
  private readonly to = vec2();
  private readonly vel = vec2();
  private readonly mouth = vec2();
  private readonly reach = vec2();
  private readonly gaze = vec2();
  private readonly plan = createPlan();
  private readonly chaser: Chaser = {
    x: 0,
    minX: WORLD.edgeMargin,
    maxX: WORLD.edgeMargin,
    maxSpeed: FETCH.runSpeed,
    reactionTime: FETCH.reactionTime,
    reachOffset: FETCH.reachOffset,
    reachSlack: FETCH.reachSlack,
    standReach: FETCH.standReach,
    jumpReach: FETCH.jumpReach,
    jumpPatience: FETCH.jumpPatience,
  };

  enter(sim: PetSimulation): void {
    this.chaser.maxX = sim.width - WORLD.edgeMargin;
    this.homeX = sim.rig.hips.x;
    this.elapsed = 0;
    this.pickThrow(sim);
    sim.ball.pose(this.from.x, this.from.y);
    this.setPhase('windup');
  }

  exit(sim: PetSimulation): void {
    const ball = sim.ball;
    // Never leave the ball stuck mid-air: a held ball drops, an unthrown one goes back in the pocket.
    if (ball.state === 'held') ball.release(sim.rig.velocityX, 0);
    else if (ball.state === 'posed') ball.hide();
  }

  update(sim: PetSimulation, dt: number): void {
    this.t += dt;
    this.elapsed += dt;
    const c = sim.controls;
    c.excitement = 1;
    c.crouch = 0;
    c.maxSpeed = FETCH.runSpeed;
    c.moveTargetX = sim.rig.hips.x;

    switch (this.phase) {
      case 'windup':
        return this.windup(sim);
      case 'chase':
        return this.chase(sim, dt);
      case 'carry':
        return this.carry(sim);
      case 'present':
        return this.present(sim);
      case 'celebrate':
        return this.celebrate(sim);
    }
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.t = 0;
  }

  /** Play bow facing the thrower while the ball is pumped back, then the release. */
  private windup(sim: PetSimulation): void {
    const c = sim.controls;
    const ball = sim.ball;
    const u = clamp(this.t / FETCH.windup, 0, 1);
    c.facing = this.from.x < sim.rig.hips.x ? -1 : 1;
    c.crouch = 0.55 * smoothstep(0, 0.35, u);
    c.lookAt = ball.pos;

    // Backswing: ease away from the throw direction, then whip through.
    const s = Math.sin(Math.PI * u) ** 2;
    set(ball.pos, this.from.x - this.throwDir * 14 * s, this.from.y + 10 * s);

    if (u >= 1) {
      launchVelocity(this.vel, ball.pos, this.to, WORLD.gravity, this.flightTime);
      ball.launch(this.vel.x, this.vel.y);
      this.sinceJump = Infinity;
      this.setPhase('chase');
    }
  }

  private chase(sim: PetSimulation, dt: number): void {
    const c = sim.controls;
    const rig = sim.rig;
    const ball = sim.ball;
    if (ball.state !== 'free') return sim.setBehavior('idle');

    rig.toDisplay(this.mouth, rig.mouth);
    const gap = distance(this.mouth, ball.pos);
    if (gap < ball.radius + FETCH.catchSlop) {
      ball.grab(rig);
      this.setPhase('carry');
      return;
    }
    if (this.elapsed > FETCH.giveUpAfter) return sim.setBehavior('idle');

    // Mid-jump the trajectory is committed; keep the last plan until we land.
    if (!rig.airborne) {
      this.chaser.x = rig.hips.x;
      planIntercept(this.plan, ball, WORLD.gravity, ball.bounds, BALL.friction, this.chaser);
    }
    this.sinceJump += dt;
    const plan = this.plan;
    c.moveTargetX = plan.anchorX;

    // Face where the ball will be, with a dead zone so passing overhead doesn't flicker.
    const dx = plan.x - rig.hips.x;
    if (Math.abs(dx) > 24) c.facing = dx > 0 ? 1 : -1;
    c.lookAt = ball.pos;

    // The neck springs need a head start: stretch to the planned catch point
    // before the ball gets there, then track the ball itself for the last bit.
    const soon = plan.found ? plan.time < FETCH.reachLead : gap < 150;
    if (soon) {
      if (gap < 45 || !plan.found) {
        predictPosition(this.reach, ball, WORLD.gravity, 0.05);
        this.reach.y = Math.min(this.reach.y, ball.bounds.floorY);
      } else {
        set(this.reach, plan.x, ball.bounds.floorY - plan.height);
      }
      c.reachFor = this.reach;
      // Ball on (or nearly on) the ground: get down to it.
      c.crouch = 0.9 * (1 - smoothstep(10, 40, ball.height)) * (1 - smoothstep(90, 150, gap));
    }

    // Leap so the apex lands on the catch: v = √(2·g·h), takeoff when time left = v / g.
    // A few px of headroom so the mouth is still rising, not stalled, at contact.
    if (plan.found && plan.jumpHeight > 0 && !rig.airborne && this.sinceJump > 0.3) {
      const v = Math.sqrt(2 * WORLD.gravity * (plan.jumpHeight + 12));
      if (plan.time <= v / WORLD.gravity + 0.02) {
        c.jump = v;
        this.sinceJump = 0;
      }
    }
  }

  private carry(sim: PetSimulation): void {
    const c = sim.controls;
    const rig = sim.rig;
    if (sim.ball.state !== 'held') return this.setPhase('celebrate');
    // A short "got it!" beat before turning for home.
    if (this.t < FETCH.gotItBeat) {
      c.crouch = 0.3 * Math.sin((Math.PI * this.t) / FETCH.gotItBeat);
      return;
    }
    const target = sim.pointer.active ? clamp(sim.pointer.pos.x, this.chaser.minX, this.chaser.maxX) : this.homeX;
    c.moveTargetX = target;
    c.maxSpeed = FETCH.carrySpeed;
    const dx = target - rig.hips.x;
    if (Math.abs(dx) > 8) c.facing = dx > 0 ? 1 : -1;
    // Proud trot: head up, looking ahead.
    set(this.gaze, rig.hips.x + c.facing * 260, sim.groundY - 140);
    c.lookAt = this.gaze;
    if (this.t > 0.4 && Math.abs(dx) < 14 && Math.abs(rig.velocityX) < 40) this.setPhase('present');
  }

  /** Turn to the cursor (or the middle), dip the head and let go. */
  private present(sim: PetSimulation): void {
    const c = sim.controls;
    const rig = sim.rig;
    const toward = sim.pointer.active ? sim.pointer.pos.x : sim.width / 2;
    if (Math.abs(toward - rig.hips.x) > 40) c.facing = toward > rig.hips.x ? 1 : -1;
    set(this.gaze, rig.hips.x + c.facing * 150, sim.groundY + 10);
    c.lookAt = this.gaze;
    c.crouch = 0.35 * smoothstep(0.1, 0.4, this.t);
    if (this.t > 0.5) {
      sim.ball.release(c.facing * 70, -90);
      this.hopped = false;
      this.setPhase('celebrate');
    }
  }

  /** A happy hop while watching the ball bounce, then back to idle. */
  private celebrate(sim: PetSimulation): void {
    const c = sim.controls;
    c.lookAt = sim.pointer.active && this.t > 0.7 ? sim.pointer.pos : sim.ball.pos;
    if (!this.hopped && this.t > 0.3) {
      c.jump = 330;
      this.hopped = true;
    }
    if (this.t > 1.3) sim.setBehavior('idle');
  }

  /**
   * From the cursor if it's up in the air beside the dog, else from the edge
   * behind it; lands well out on the roomier side so the dog has to run.
   */
  private pickThrow(sim: PetSimulation): void {
    const x = sim.rig.hips.x;
    const p = sim.pointer;
    const usePointer =
      p.active && p.pos.y > 30 && p.pos.y < sim.groundY - 70 && Math.abs(p.pos.x - x) > 120;

    let dir: Facing = sim.width - x > x ? 1 : -1;
    if (usePointer) {
      dir = p.pos.x < x ? 1 : -1;
      if ((dir > 0 ? sim.width - x : x) < 200) dir = dir > 0 ? -1 : 1;
      set(this.from, p.pos.x, p.pos.y);
    } else {
      set(
        this.from,
        dir > 0 ? BALL.radius + 16 : sim.width - BALL.radius - 16,
        sim.groundY - 120 - Math.random() * 50,
      );
    }
    this.throwDir = dir;

    const room = dir > 0 ? sim.width - 40 - x : x - 40;
    const dist = Math.max(room - 170, 0) * (0.35 + 0.65 * Math.random()) + Math.min(room, 170);
    set(this.to, x + dir * dist, sim.ball.bounds.floorY);

    // Random hang time, shortened if the apex would leave the canvas: rise = vy² / 2g.
    const range = Math.random() < FETCH.lineDriveChance ? FETCH.lineDriveTime : FETCH.lobTime;
    let T = range.min + Math.random() * (range.max - range.min);
    for (let i = 0; i < 12; i++) {
      launchVelocity(this.vel, this.from, this.to, WORLD.gravity, T);
      const rise = this.vel.y < 0 ? (this.vel.y * this.vel.y) / (2 * WORLD.gravity) : 0;
      if (this.from.y - rise >= FETCH.apexMargin) break;
      T *= 0.92;
    }
    this.flightTime = T;
  }
}
