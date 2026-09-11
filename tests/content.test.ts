import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { TRANSMISSIONS } from '../src/data/transmissions';

describe('authored campaign data', () => {
  it('ends every sector with a distinct command encounter, including paired minibosses', () => {
    expect(LEVELS.map((level) => level.id)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(LEVELS.map((level) => level.name)).size).toBe(5);
    expect(LEVELS.every((level) => level.boss && level.boss.hp > 0)).toBe(true);
    expect(new Set(LEVELS.map((level) => level.boss!.kind)).size).toBe(5);
    expect(LEVELS.some((level) => level.boss!.count === 2)).toBe(true);
  });

  it('keeps spawn schedules chronological, bounded, and long enough for deliberate encounters', () => {
    for (const level of LEVELS) {
      const totalWaves = level.waves.length + (level.boss ? 1 : 0);
      expect(totalWaves).toBeGreaterThanOrEqual(6);
      expect(totalWaves).toBeLessThanOrEqual(12);
      expect(level.waves[0].at).toBeGreaterThanOrEqual(1);
      expect(level.waves.at(-1)!.at).toBeGreaterThanOrEqual(25);
      expect(level.waves.at(-1)!.at).toBeLessThanOrEqual(75);
      let priorTime = -1;
      for (const wave of level.waves) {
        expect(wave.at).toBeGreaterThan(priorTime);
        expect(Number.isInteger(wave.count)).toBe(true);
        expect(wave.count).toBeGreaterThan(0);
        expect(wave.count).toBeLessThanOrEqual(12);
        expect(wave.hp).toBeGreaterThanOrEqual(level.id + 3);
        expect(wave.speed).toBeGreaterThan(0);
        expect(wave.hold).toBeGreaterThanOrEqual(0.5);
        priorTime = wave.at;
      }
    }
  });

  it('escalates enemy numbers, regular durability and total boss durability every sector', () => {
    expect(LEVELS[0].waves[0].kind).toBe('straight');
    expect(LEVELS.every((level) => level.waves.some((wave) => wave.kind === 'shooter'))).toBe(true);
    const counts = LEVELS.map((level) => level.waves.reduce((sum, wave) => sum + wave.count, 0));
    // Keep the campaign near twice its original population, with room for balance tuning.
    const minimumCounts = [50, 65, 80, 100, 120];
    for (let index = 0; index < counts.length; index++) expect(counts[index]).toBeGreaterThanOrEqual(minimumCounts[index]);
    const durability = LEVELS.map((level) =>
      level.waves.reduce((sum, wave) => sum + wave.hp * wave.count, 0),
    );
    for (let index = 1; index < durability.length; index++) {
      expect(counts[index]).toBeGreaterThan(counts[index - 1]);
      expect(durability[index]).toBeGreaterThan(durability[index - 1]);
      const encounterHp = (i: number) => LEVELS[i].boss!.hp * (LEVELS[i].boss!.count ?? 1);
      expect(encounterHp(index)).toBeGreaterThan(encounterHp(index - 1));
    }
    expect(LEVELS.at(-1)!.waves.some((wave) => (wave.tier ?? 0) >= 2)).toBe(true);
  });

  it('offers sector attack growth and new weapons while limiting temporary boosts', () => {
    const waves = LEVELS.flatMap((level) => level.waves);
    expect(new Set(waves.map((wave) => wave.kind))).toEqual(new Set(['straight', 'weaver', 'shooter']));
    expect(new Set(waves.map((wave) => wave.formation))).toEqual(new Set(['chevron', 'arc', 'pincer', 'column', 'line']));
    for (const level of LEVELS) {
      expect(level.waves.filter((wave) => wave.drop === 'multishot')).toHaveLength(2);
      expect(level.waves.filter((wave) => ['rapid', 'spread', 'damage'].includes(wave.drop ?? ''))).toHaveLength(1);
      expect(level.waves.filter((wave) => wave.drop?.startsWith('weapon-'))).toHaveLength(1);
      expect(level.waves.filter((wave) => wave.drop === 'health')).toHaveLength(1);
      expect(level.waves.some((wave) => wave.drop === 'ship-part')).toBe(false);
    }
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
