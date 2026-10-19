import type { Vec2 } from './vec2';

/**
 * Damped springs integrated with implicit (backward) Euler.
 *
 * For x'' = -k(x - target) - c·x', solving the step implicitly gives
 *   v' = (v - dt·k·(x - target)) / (1 + dt·c + dt²·k)
 *   x' = x + dt·v'
 * which is unconditionally stable: a long frame (tab switch, GC pause) can
 * only add damping, never make the spring explode.
 *
 * Springs are described by frequency (Hz) and damping ratio instead of raw
 * k and c, so tuning reads as "how fast" and "how bouncy".
 * dampingRatio 1 = critically damped, < 1 = overshoots.
 */
export interface SpringConfig {
  frequency: number;
  dampingRatio: number;
}

export interface Spring1 {
  value: number;
  velocity: number;
}

export interface Spring2 {
  pos: Vec2;
  vel: Vec2;
}

function coefficients(cfg: SpringConfig): { k: number; c: number } {
  const omega = 2 * Math.PI * cfg.frequency;
  return { k: omega * omega, c: 2 * cfg.dampingRatio * omega };
}

export function stepSpring1(s: Spring1, target: number, cfg: SpringConfig, dt: number): void {
  const { k, c } = coefficients(cfg);
  const denom = 1 + dt * c + dt * dt * k;
  s.velocity = (s.velocity - dt * k * (s.value - target)) / denom;
  s.value += dt * s.velocity;
}

export function stepSpring2(s: Spring2, target: Vec2, cfg: SpringConfig, dt: number): void {
  const { k, c } = coefficients(cfg);
  const denom = 1 + dt * c + dt * dt * k;
  s.vel.x = (s.vel.x - dt * k * (s.pos.x - target.x)) / denom;
  s.vel.y = (s.vel.y - dt * k * (s.pos.y - target.y)) / denom;
  s.pos.x += dt * s.vel.x;
  s.pos.y += dt * s.vel.y;
}
