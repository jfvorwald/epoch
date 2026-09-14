import { describe, expect, it } from 'vitest';
import { defaultLoadout, getShipStats, isShipUnlocked, PLAYER_MAX_HP, SHIPS, SHIP_PART_DROP_CHANCE, SHIP_PARTS_REQUIRED } from '../src/data/ships';
import type { HandlingKind, ReactorKind, ShipId } from '../src/game/types';

describe('ship identities and progression', () => {
  it('starts with the interceptor and requires all twelve rare fragments to unlock the corvette', () => {
    expect(isShipUnlocked('strelka', 0)).toBe(true);
    expect(SHIP_PARTS_REQUIRED).toBe(12);
    expect(isShipUnlocked('manta', 0)).toBe(false);
    expect(isShipUnlocked('manta', SHIP_PARTS_REQUIRED - 1)).toBe(false);
    expect(isShipUnlocked('manta', SHIP_PARTS_REQUIRED)).toBe(true);
    expect(isShipUnlocked('manta', Number.NaN)).toBe(false);
    expect(isShipUnlocked('manta', Number.POSITIVE_INFINITY)).toBe(false);
    // Only one roll per cleared level; even five perfect runs should not be the average unlock.
    expect(SHIP_PART_DROP_CHANCE).toBeGreaterThan(0);
    expect(SHIP_PARTS_REQUIRED / (5 * SHIP_PART_DROP_CHANCE)).toBeGreaterThan(10);
  });

  it('gives each airframe a distinct silhouette, native weapon, and flight profile', () => {
    expect(SHIPS.strelka.art).not.toBe(SHIPS.manta.art);
    expect(SHIPS.strelka.weapon).toBe('pulse');
    expect(SHIPS.manta.weapon).toBe('lance');
    expect(SHIPS.strelka.speed).toBeGreaterThan(SHIPS.manta.speed);
    expect(PLAYER_MAX_HP).toBe(3);
    expect(SHIPS.strelka.maxHp).toBe(PLAYER_MAX_HP);
    expect(SHIPS.manta.maxHp).toBe(PLAYER_MAX_HP);
    expect(SHIPS.strelka.fireInterval).toBeLessThan(SHIPS.manta.fireInterval);
  });
});

describe('flight customization', () => {
  it('trades protection after a hit for agility while keeping both ships at three hull', () => {
    for (const shipId of ['strelka', 'manta'] as const) {
      const balanced = getShipStats(shipId, defaultLoadout());
      const agile = getShipStats(shipId, { handling: 'agile', reactor: 'balanced' });
      const armored = getShipStats(shipId, { handling: 'armored', reactor: 'balanced' });
      expect(balanced.hitRecovery).toBe(1.3);
      expect(agile.hitRecovery).toBe(1);
      expect(agile.maxHp).toBe(3);
      expect(agile.speed).toBeCloseTo(balanced.speed * 1.2);
      expect(armored.hitRecovery).toBe(1.8);
      expect(armored.maxHp).toBe(3);
      expect(armored.speed).toBeCloseTo(balanced.speed * 0.85);
      expect(agile.damage).toBe(balanced.damage);
      expect(armored.fireInterval).toBe(balanced.fireInterval);
    }
  });

  it('trades individual shot strength against firing cadence', () => {
    for (const shipId of ['strelka', 'manta'] as const) {
      const balanced = getShipStats(shipId, defaultLoadout());
      const rapid = getShipStats(shipId, { handling: 'balanced', reactor: 'rapid' });
      const heavy = getShipStats(shipId, { handling: 'balanced', reactor: 'heavy' });
      expect(rapid.fireInterval).toBeCloseTo(balanced.fireInterval * 0.75);
      expect(rapid.damage).toBeCloseTo(balanced.damage * 0.8);
      expect(heavy.fireInterval).toBeCloseTo(balanced.fireInterval * 1.3);
      expect(heavy.damage).toBeCloseTo(balanced.damage * 1.45);
      expect(rapid.maxHp).toBe(balanced.maxHp);
      expect(rapid.hitRecovery).toBe(balanced.hitRecovery);
      expect(heavy.hitRecovery).toBe(balanced.hitRecovery);
      expect(heavy.speed).toBe(balanced.speed);
    }
  });

  it('keeps all eighteen configurations playable and avoids modifying the shared airframes', () => {
    const originals = structuredClone(SHIPS);
    for (const shipId of Object.keys(SHIPS) as ShipId[]) {
      for (const handling of ['balanced', 'agile', 'armored'] as HandlingKind[]) {
        for (const reactor of ['balanced', 'rapid', 'heavy'] as ReactorKind[]) {
          const stats = getShipStats(shipId, { handling, reactor });
          expect(stats.maxHp).toBe(3);
          expect(stats.hitRecovery).toBe(({ balanced: 1.3, agile: 1, armored: 1.8 })[handling]);
          expect(stats.speed).toBeGreaterThan(200);
          expect(stats.fireInterval).toBeGreaterThan(0.1);
          expect(stats.fireInterval).toBeLessThan(0.5);
          expect(stats.damage).toBeGreaterThan(0);
        }
      }
    }
    expect(SHIPS).toEqual(originals);
    const first = defaultLoadout();
    first.handling = 'armored';
    expect(defaultLoadout()).toEqual({ handling: 'balanced', reactor: 'balanced' });
  });
});
