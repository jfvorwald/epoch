import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { TRANSMISSIONS } from '../src/data/transmissions';

describe('authored campaign data', () => {
  it('provides five distinct consecutive sectors and reserves the boss for the finale', () => {
    expect(LEVELS.map((level) => level.id)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(LEVELS.map((level) => level.name)).size).toBe(5);
    expect(LEVELS.filter((level) => level.boss).map((level) => level.id)).toEqual([5]);
    expect(LEVELS[4].boss!.hp).toBeGreaterThan(0);
  });

  it('keeps spawn schedules chronological, bounded, and long enough for deliberate encounters', () => {
    for (const level of LEVELS) {
      expect(level.waves.length).toBeGreaterThanOrEqual(4);
      expect(level.waves.length).toBeLessThanOrEqual(6);
      expect(level.waves[0].at).toBeGreaterThanOrEqual(1);
      expect(level.waves.at(-1)!.at).toBeGreaterThanOrEqual(30);
      expect(level.waves.at(-1)!.at).toBeLessThanOrEqual(45);
      let priorTime = -1;
      for (const wave of level.waves) {
        expect(wave.at).toBeGreaterThan(priorTime);
        expect(Number.isInteger(wave.count)).toBe(true);
        expect(wave.count).toBeGreaterThan(0);
        expect(wave.count).toBeLessThanOrEqual(10);
        expect(wave.hp).toBeGreaterThan(0);
        expect(wave.speed).toBeGreaterThan(0);
        expect(wave.hold).toBeGreaterThanOrEqual(1);
        priorTime = wave.at;
      }
    }
  });

  it('teaches movement before shooters and escalates total enemy durability each sector', () => {
    expect(LEVELS[0].waves.some((wave) => wave.kind === 'shooter')).toBe(false);
    expect(LEVELS[1].waves.some((wave) => wave.kind === 'shooter')).toBe(true);
    const durability = LEVELS.map((level) =>
      level.waves.reduce((sum, wave) => sum + wave.hp * wave.count, 0) + (level.boss?.hp ?? 0),
    );
    for (let index = 1; index < durability.length; index++) {
      expect(durability[index]).toBeGreaterThan(durability[index - 1]);
    }
  });

  it('covers all enemy and formation behaviors and authors all four pickup types', () => {
    const waves = LEVELS.flatMap((level) => level.waves);
    expect(new Set(waves.map((wave) => wave.kind))).toEqual(new Set(['straight', 'weaver', 'shooter']));
    expect(new Set(waves.map((wave) => wave.formation))).toEqual(new Set(['chevron', 'arc', 'pincer', 'column', 'line']));
    expect(new Set(waves.map((wave) => wave.drop))).toEqual(new Set(['health', 'rapid', 'spread', 'damage']));
    for (const level of LEVELS) expect(level.waves.some((wave) => wave.drop === 'health')).toBe(true);
  });

  it('ties every story transition to its completed sector and exposes initial orders', () => {
    expect(new Set(TRANSMISSIONS.map((entry) => entry.id)).size).toBe(TRANSMISSIONS.length);
    expect(TRANSMISSIONS.some((entry) => entry.afterLevel === 0)).toBe(true);
    for (const level of LEVELS) {
      if (!level.transmissionId) continue;
      const transmission = TRANSMISSIONS.find((entry) => entry.id === level.transmissionId);
      expect(transmission?.afterLevel).toBe(level.id);
    }
    for (const transmission of TRANSMISSIONS) {
      expect(transmission.text.length).toBeGreaterThan(100);
      expect(transmission.text.length).toBeLessThan(700);
      if (transmission.afterLevel > 0) {
        expect(LEVELS.some((level) => level.transmissionId === transmission.id)).toBe(true);
      }
    }
  });
});
