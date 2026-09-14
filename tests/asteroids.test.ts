import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/data/config';
import { LEVELS, getLevel } from '../src/data/levels';
import { boundedProjectileSpeed, createAsteroidTrajectory, createLevelWaves } from '../src/game/asteroids';
import type { Level, Wave } from '../src/game/types';

function levelFixture(): Level {
  const waves: Wave[] = Array.from({ length: 9 }, (_, index) => ({
    at: 2 + index * 6, kind: index % 2 ? 'shooter' : 'straight', formation: 'chevron',
    count: 9, hp: 6, speed: 160, hold: 1.5, tier: 2, powerUpDrops: 2,
    ...(index === 1 ? { drop: 'health' as const } : index === 2 ? { drop: 'weapon-lance' as const } : {}),
  }));
  return { id: 7, name: 'TEST RELAY', subtitle: 'TEST', briefing: 'Follow the signal.', color: 0, waves, boss: { name: 'WARDEN', hp: 300, kind: 'warden' } };
}

describe('random asteroid encounters per level', () => {
  it.each([[0, 0], [0.333334, 1], [0.666667, 2], [0.99999, 2]])('roll %s selects exactly %s asteroid waves', (roll, expected) => {
    const source = levelFixture();
    const plan = createLevelWaves(source, () => roll);
    expect(plan.filter(wave => wave.kind === 'debris')).toHaveLength(expected);
    expect(plan.length + 1).toBe(10);
    expect(plan[0]).toEqual(source.waves[0]);
    expect(plan.at(-1)).toEqual(source.waves.at(-1));
  });

  it('retains hull supplies, weapon crates, arrays, chronological slots, and source data', () => {
    const source = levelFixture();
    const before = structuredClone(source);
    let calls = 0;
    const plan = createLevelWaves(source, () => calls++ === 0 ? 0.9 : 0);
    expect(plan[1].kind).toBe('debris');
    expect(plan[2].kind).toBe('debris');
    expect(plan[1].drop).toBe('health');
    expect(plan[2].drop).toBe('weapon-lance');
    expect(plan.map(wave => wave.at)).toEqual(source.waves.map(wave => wave.at));
    expect(plan.map(wave => wave.powerUpDrops)).toEqual(source.waves.map(wave => wave.powerUpDrops));
    expect(plan.map(wave => wave.count)).toEqual(source.waves.map(wave => wave.count));
    expect(plan.filter(wave => wave.kind === 'debris').every(wave => wave.tier === 0 && wave.hold === 0)).toBe(true);
    expect(source).toEqual(before);
    expect(plan.every((wave, index) => wave !== source.waves[index])).toBe(true);
  });

  it('rerolls the encounter count and placement for a new run', () => {
    const source = levelFixture();
    const none = createLevelWaves(source, () => 0);
    const two = createLevelWaves(source, () => 0.95);
    expect(none.filter(wave => wave.kind === 'debris')).toHaveLength(0);
    expect(two.filter(wave => wave.kind === 'debris')).toHaveLength(2);
    expect(two[7].kind).toBe('debris');
    expect(source.waves.some(wave => wave.kind === 'debris')).toBe(false);
  });

  it('does not inherit a mandatory legacy debris encounter or overrun a small schedule', () => {
    const source = levelFixture();
    source.waves[3].kind = 'debris';
    source.waves[3].hold = 0;
    expect(createLevelWaves(source, () => 0).some(wave => wave.kind === 'debris')).toBe(false);
    source.waves = source.waves.slice(0, 3);
    expect(createLevelWaves(source, () => 1).filter(wave => wave.kind === 'debris')).toHaveLength(1);
  });
});

describe('rare Supercharge drop planning', () => {
  function rolls(...values: number[]): () => number {
    let index = 0;
    return () => values[index++] ?? 0;
  }

  it.each([[0, 1], [0.29999, 1], [0.3, 0], [0.99999, 0]])('a level roll of %s places %s Supercharge', (roll, expected) => {
    const source = levelFixture();
    const plan = createLevelWaves(source, rolls(0, roll, 0.99999));
    expect(plan.filter(wave => wave.drop === 'supercharge')).toHaveLength(expected);
    const index = plan.findIndex(wave => wave.drop === 'supercharge');
    if (expected) {
      expect(index).toBeGreaterThanOrEqual(Math.floor(plan.length / 2));
      expect(index).toBeLessThan(plan.length - 1);
      expect(plan[index].kind).not.toBe('debris');
    }
  });

  it('replaces only a temporary boost while preserving all permanent arrays and source data', () => {
    const source = levelFixture();
    source.waves[4].drop = 'rapid';
    const before = structuredClone(source);
    const plan = createLevelWaves(source, rolls(0, 0, 0));
    expect(plan[4].drop).toBe('supercharge');
    expect(plan[1].drop).toBe('health');
    expect(plan[2].drop).toBe('weapon-lance');
    expect(plan.map(wave => wave.powerUpDrops)).toEqual(source.waves.map(wave => wave.powerUpDrops));
    expect(source).toEqual(before);
  });

  it('skips asteroid waves and never overwrites a protected drop', () => {
    const source = levelFixture();
    source.waves[4].drop = 'health';
    source.waves[5].drop = 'weapon-lance';
    // Two asteroids at slots 6 and 7 leave no eligible middle/late combat slot.
    const plan = createLevelWaves(source, rolls(0.9, 5 / 7, 5 / 6, 0));
    expect(plan.filter(wave => wave.kind === 'debris')).toHaveLength(2);
    expect(plan.filter(wave => wave.drop === 'supercharge')).toHaveLength(0);
    expect(plan[4].drop).toBe('health');
    expect(plan[5].drop).toBe('weapon-lance');
  });

  it('keeps one rare drop at most and the 5–7 array budget across authored and endless levels', () => {
    for (const source of [...LEVELS, getLevel(51), getLevel(1000)]) {
      for (const roll of [0, 0.4, 0.9]) {
        const plan = createLevelWaves(source, () => roll);
        expect(plan.filter(wave => wave.drop === 'supercharge').length).toBeLessThanOrEqual(1);
        expect(plan.filter(wave => wave.kind === 'debris').length).toBeLessThanOrEqual(2);
        expect(plan.reduce((sum, wave) => sum + (wave.powerUpDrops ?? 0), 0)).toBe(source.waves.length - 2);
        for (const [index, wave] of source.waves.entries()) {
          if (wave.drop === 'health' || wave.drop?.startsWith('weapon-')) expect(plan[index].drop).toBe(wave.drop);
        }
      }
    }
  });
});

describe('asteroid angles and readable movement', () => {
  it('mixes both top diagonals with rising and falling crossings from both sides', () => {
    const routes = Array.from({ length: 6 }, (_, index) => createAsteroidTrajectory(index, 0, 220, () => 0.5));
    expect(new Set(routes.map(route => route.edge))).toEqual(new Set(['top', 'left', 'right']));
    expect(new Set(routes.map(route => Math.atan2(route.vy, route.vx).toFixed(3))).size).toBe(6);
    expect(routes.some(route => route.vx > 0 && route.vy < 0)).toBe(true);
    expect(routes.some(route => route.vx < 0 && route.vy < 0)).toBe(true);
    expect(routes.every(route => Math.abs(route.vx) > 20 && Math.abs(route.vy) > 20)).toBe(true);
  });

  it('starts offscreen, crosses the firing area, and follows exactly the telegraphed vector', () => {
    for (const roll of [0, 0.5, 0.99999]) {
      for (let index = 0; index < 6; index++) {
        const route = createAsteroidTrajectory(index, 0, 220, () => roll);
        expect(route.sx < 0 || route.sx > 480 || route.sy < 0).toBe(true);
        expect(Math.hypot(route.vx, route.vy)).toBeCloseTo(220);
        const seconds = Math.hypot(route.tx - route.sx, route.ty - route.sy) / 220;
        expect(route.sx + route.vx * seconds).toBeCloseTo(route.tx);
        expect(route.sy + route.vy * seconds).toBeCloseTo(route.ty);
        const visiblePoints = Array.from({ length: 41 }, (_, step) => {
          const x = route.sx + route.vx * seconds * step / 40;
          const y = route.sy + route.vy * seconds * step / 40;
          return x >= 28 && x <= 452 && y >= 110 && y <= 700;
        }).filter(Boolean);
        expect(visiblePoints.length).toBeGreaterThan(10);
      }
    }
  });

  it('uses a new crossing on return and allows angle variation within an entry route', () => {
    const initial = createAsteroidTrajectory(0, 0, 220, () => 0.5);
    const returning = createAsteroidTrajectory(0, 1, 220, () => 0.5);
    expect(returning.edge).not.toBe(initial.edge);
    const variation = createAsteroidTrajectory(0, 0, 220, () => 0.9);
    expect(variation.vx).not.toBe(initial.vx);
  });

  it('bounds asteroid and projectile speeds at very high levels', () => {
    for (const requested of [0, 175, 220, 260, 999999]) {
      const route = createAsteroidTrajectory(1, 0, requested, () => 0.5);
      const speed = Math.hypot(route.vx, route.vy);
      expect(speed).toBeGreaterThanOrEqual(GAME_CONFIG.asteroids.minSpeed - 1e-8);
      expect(speed).toBeLessThanOrEqual(GAME_CONFIG.asteroids.maxSpeed + 1e-8);
    }
    expect(boundedProjectileSpeed(1, 0)).toBe(178);
    expect(boundedProjectileSpeed(5, 2)).toBe(262);
    for (const level of [50, 51, 1000, Number.MAX_SAFE_INTEGER]) {
      expect(boundedProjectileSpeed(level, 2)).toBe(GAME_CONFIG.scaling.maxProjectileSpeed);
    }
  });
});
