import { describe, expect, it } from 'vitest';
import { LEVELS, getLevel } from '../src/data/levels';
import { CHAPTERS } from '../src/data/story';
import { TRANSMISSIONS } from '../src/data/transmissions';
import { CAMPAIGN_LEVEL_COUNT, GAME_CONFIG, MAX_LEVEL_NUMBER } from '../src/data/config';
import { defaultLoadout, getShipStats, SHIPS } from '../src/data/ships';
import { getDamageMultiplier, getProjectileDamageMultiplier } from '../src/game/weapons';

describe('the signal campaign', () => {
  it('keeps the original opening and expands into fifty named levels in ten chapters', () => {
    expect(CAMPAIGN_LEVEL_COUNT).toBe(50);
    expect(GAME_CONFIG.terminology).toEqual({ level: 'level', wave: 'wave' });
    expect(LEVELS.map(level => level.id)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(new Set(LEVELS.map(level => level.name)).size).toBe(50);
    expect(LEVELS.slice(0, 5).map(level => level.name)).toEqual(['PERIMETER DRIFT', 'DEAD RELAY', 'ARSENAL GRAVEYARD', 'STATIC WALL', 'BLACK ARRAY']);
    expect(CHAPTERS).toHaveLength(10);
    expect(CHAPTERS.flatMap(chapter => Array.from({ length: chapter.endLevel - chapter.startLevel + 1 }, (_, i) => chapter.startLevel + i))).toEqual(LEVELS.map(level => level.id));
    for (const chapter of CHAPTERS) {
      expect(chapter.endLevel - chapter.startLevel).toBe(4);
      expect(chapter.summary.length).toBeGreaterThan(40);
    }
  });

  it('keeps each level within the wave and entity budgets with chronologically ordered encounters', () => {
    for (const level of [...LEVELS, getLevel(51), getLevel(100), getLevel(1000), getLevel(1_000_000)]) {
      expect(level.waves.length + (level.boss ? 1 : 0)).toBeGreaterThanOrEqual(8);
      expect(level.waves.length + (level.boss ? 1 : 0)).toBeLessThanOrEqual(10);
      expect(level.boss!.hp).toBeGreaterThan(0);
      expect(Number.isFinite(level.boss!.hp)).toBe(true);
      let previous = -1;
      for (const wave of level.waves) {
        expect(wave.at).toBeGreaterThan(previous);
        previous = wave.at;
        expect(Number.isInteger(wave.count)).toBe(true);
        expect(wave.count).toBeGreaterThan(0);
        expect(wave.count).toBeLessThanOrEqual(24);
        expect(wave.hp).toBeGreaterThan(0);
        expect(Number.isFinite(wave.hp)).toBe(true);
        expect(wave.speed).toBeGreaterThan(0);
        expect(wave.speed).toBeLessThanOrEqual(400);
        expect(wave.kind).not.toBe('debris'); // Rolled independently when a level starts.
      }
    }
  });

  it('opens every story and endless level with four or five basic hits, including pulse-weak weavers', () => {
    expect(GAME_CONFIG.waves.openingWave).toEqual({ minimumBasicHits: 4, maximumBasicHits: 5 });
    const basicDamage = getShipStats('strelka', defaultLoadout()).damage * getProjectileDamageMultiplier(0);
    const openingKinds = new Set<string>();
    for (const level of [...LEVELS, ...[51, 52, 100, 1000, 1_000_000, MAX_LEVEL_NUMBER].map(getLevel)]) {
      const wave = level.waves[0];
      openingKinds.add(wave.kind);
      const damage = basicDamage * getDamageMultiplier(wave.kind, SHIPS.strelka.weapon);
      const hits = Math.ceil(wave.hp / damage);
      expect(hits, `level ${level.id} ${wave.kind}`).toBeGreaterThanOrEqual(4);
      expect(hits, `level ${level.id} ${wave.kind}`).toBeLessThanOrEqual(5);
      // Combat subtracts each shot separately: a rounding remainder must not require a sixth shot.
      let remainingHp = wave.hp;
      for (let hit = 1; hit < hits; hit++) {
        remainingHp -= damage;
        expect(remainingHp, `level ${level.id} after ${hit} hits`).toBeGreaterThan(0);
      }
      expect(remainingHp - damage, `level ${level.id} final hit`).toBeLessThanOrEqual(0);
    }
    expect(openingKinds).toEqual(new Set(['straight', 'weaver', 'shooter']));
    expect(LEVELS[0].waves[0].hp).toBe(4);
  });

  it('supports attack growth and preserves the three main enemy families across the campaign', () => {
    const waves = LEVELS.flatMap(level => level.waves);
    expect(new Set(waves.map(wave => wave.kind))).toEqual(new Set(['straight', 'weaver', 'shooter']));
    expect(new Set(waves.map(wave => wave.formation)).size).toBe(5);
    expect(new Set(LEVELS.map(level => level.boss!.kind)).size).toBe(5);
    expect(LEVELS.some(level => level.boss!.count === 2)).toBe(true);
    for (const level of [...LEVELS, getLevel(51), getLevel(100), getLevel(1000), getLevel(1_000_000)]) {
      const upgrades = level.waves.reduce((total, wave) => total + (wave.powerUpDrops ?? 0), 0);
      expect(upgrades).toBeGreaterThanOrEqual(GAME_CONFIG.pickups.permanentPower.minimumPerLevel);
      expect(upgrades).toBeLessThanOrEqual(GAME_CONFIG.pickups.permanentPower.maximumPerLevel);
      for (const [index, wave] of level.waves.entries()) {
        expect(wave.powerUpDrops).toBe(index < GAME_CONFIG.pickups.permanentPower.openingWavesWithoutDrops ? 0 : 1);
        expect(wave.powerUpDrops ?? 0).toBeLessThanOrEqual(wave.count - (wave.drop ? 1 : 0));
      }
      expect(level.waves.some(wave => wave.drop === 'health')).toBe(true);
      expect(level.waves.some(wave => wave.drop?.startsWith('weapon-'))).toBe(true);
      expect(level.waves.some(wave => wave.drop === 'ship-part')).toBe(false);
    }
  });

  it('continues beyond fifty with increasing later-wave durability and bounded movement, not a reset', () => {
    const levels = [50, 51, 100, 1000, 1000000].map(getLevel);
    expect(levels.map(level => level.id)).toEqual([50, 51, 100, 1000, 1000000]);
    const hp = levels.map(level => {
      const scalingWaves = level.waves.slice(1); // The opening wave keeps its four-to-five-hit target.
      return scalingWaves.reduce((total, wave) => total + wave.hp * wave.count, 0) / scalingWaves.reduce((total, wave) => total + wave.count, 0);
    });
    for (let i = 1; i < hp.length; i++) expect(hp[i]).toBeGreaterThan(hp[i - 1]);
    expect(getLevel(51).transmissionId).toBeUndefined();
    expect(getLevel(1000)).toEqual(getLevel(1000));
  });

  it('gives every authored level a substantial unique story installment and preserves legacy IDs', () => {
    expect(TRANSMISSIONS).toHaveLength(51);
    expect(new Set(TRANSMISSIONS.map(entry => entry.id)).size).toBe(51);
    expect(new Set(TRANSMISSIONS.map(entry => entry.text)).size).toBe(51);
    expect(TRANSMISSIONS.map(entry => entry.afterLevel).sort((a, b) => a - b)).toEqual(Array.from({ length: 51 }, (_, i) => i));
    expect(TRANSMISSIONS.find(entry => entry.id === 'launch-orders')!.afterLevel).toBe(0);
    expect(TRANSMISSIONS.find(entry => entry.id === 'cold-start')!.afterLevel).toBe(1);
    expect(TRANSMISSIONS.find(entry => entry.id === 'voss-echo')!.afterLevel).toBe(3);
    expect(TRANSMISSIONS.find(entry => entry.id === 'open-channel')!.afterLevel).toBe(5);
    for (const level of LEVELS) {
      const transmission = TRANSMISSIONS.find(entry => entry.id === level.transmissionId);
      expect(transmission?.afterLevel).toBe(level.id);
      expect(transmission!.text.split(/\s+/).length).toBeGreaterThanOrEqual(60);
      expect(transmission!.text.split(/\s+/).length).toBeLessThanOrEqual(180);
      expect(level.briefing.length).toBeGreaterThan(50);
    }
  });
});
