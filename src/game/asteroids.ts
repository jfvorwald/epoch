import { GAME_CONFIG } from '../data/config';
import type { Level, Wave } from './types';
import { aimedVelocity, clamp } from './math';

type RandomSource = () => number;

/** Clamp injected sources as well as Math.random, so the upper bucket stays in range. */
function randomUnit(rng: RandomSource): number {
  const value = rng();
  return Number.isFinite(value) ? clamp(value, 0, 1 - Number.EPSILON) : 0;
}

/**
 * A level is the complete run; waves are its sequential encounters. Roll once at
 * launch, replacing 0–2 middle waves so the total still includes 8–10 encounters
 * and a guardian. Copy all rewards rather than losing a weapon or hull pickup.
 * A separate 30% roll can place one Supercharge in a middle/late combat wave.
 * It may replace a temporary boost, but never a weapon crate or hull supply.
 */
export function createLevelWaves(level: Level, rng: RandomSource = Math.random): Wave[] {
  const waves = level.waves.map(wave => wave.kind === 'debris'
    ? { ...wave, kind: 'straight' as const, hold: Math.max(1, wave.hold) }
    : { ...wave });
  const eligible = waves.map((_, index) => index).slice(1, -1);
  const { minimum, maximum } = GAME_CONFIG.waves.asteroidWaves;
  const count = Math.min(eligible.length, minimum + Math.floor(randomUnit(rng) * (maximum - minimum + 1)));
  for (let index = 0; index < count; index++) {
    const chosen = index + Math.floor(randomUnit(rng) * (eligible.length - index));
    [eligible[index], eligible[chosen]] = [eligible[chosen], eligible[index]];
    const wave = waves[eligible[index]];
    waves[eligible[index]] = {
      ...wave,
      kind: 'debris',
      formation: 'line',
      hold: 0,
      tier: 0,
      speed: clamp(wave.speed + 45, GAME_CONFIG.asteroids.minSpeed, GAME_CONFIG.asteroids.maxSpeed),
    };
  }
  const superchargeSlots = waves.flatMap((wave, index) => (
    index >= Math.floor(waves.length / 2) && index < waves.length - 1
    && wave.kind !== 'debris'
    && (!wave.drop || ['rapid', 'spread', 'damage'].includes(wave.drop))
  ) ? [index] : []);
  if (superchargeSlots.length && randomUnit(rng) < GAME_CONFIG.pickups.supercharge.chancePerLevel) {
    const chosen = superchargeSlots[Math.floor(randomUnit(rng) * superchargeSlots.length)];
    waves[chosen].drop = 'supercharge';
  }
  return waves;
}

export interface AsteroidTrajectory {
  edge: 'top' | 'left' | 'right';
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
}

/**
 * Six committed routes alternate top diagonals and rising/falling side crossings.
 * Each pass changes route; jitter varies its angle without homing on the player.
 * All routes cross a substantial part of the firing area and begin offscreen.
 */
export function createAsteroidTrajectory(index: number, pass: number, speed: number, rng: RandomSource = Math.random): AsteroidTrajectory {
  const route = ((Math.floor(index) + Math.floor(pass)) % 6 + 6) % 6;
  const start = randomUnit(rng);
  const end = randomUnit(rng);
  let edge: AsteroidTrajectory['edge'];
  let sx: number, sy: number, tx: number, ty: number;
  if (route === 0 || route === 3) {
    edge = 'top';
    sx = route === 0 ? 60 + start * 115 : 305 + start * 115;
    sy = -72;
    tx = route === 0 ? 320 + end * 100 : 60 + end * 100;
    ty = 880;
  } else {
    edge = route === 1 || route === 4 ? 'left' : 'right';
    sx = edge === 'left' ? -72 : 552;
    tx = edge === 'left' ? 552 : -72;
    const rising = route >= 4;
    sy = rising ? 470 + start * 120 : 125 + start * 130;
    ty = rising ? 160 + end * 160 : 570 + end * 110;
  }
  const velocity = aimedVelocity(sx, sy, tx, ty, clamp(speed, GAME_CONFIG.asteroids.minSpeed, GAME_CONFIG.asteroids.maxSpeed));
  return { edge, sx, sy, tx, ty, vx: velocity.x, vy: velocity.y };
}

/** Later levels scale durability, while bullets retain a readable speed ceiling. */
export function boundedProjectileSpeed(level: number, tier = 0): number {
  const levelPressure = clamp(level, 1, 50);
  return Math.min(GAME_CONFIG.scaling.maxProjectileSpeed, 165 + levelPressure * 13 + clamp(tier, 0, 2) * 16);
}
