import { describe, expect, it } from 'vitest';
import type { WeaponKind } from '../src/game/types';
import { addWeaponPower, getDamageMultiplier, getEffectiveWeaponPower, getProjectileCount, getProjectileDamageMultiplier, getWeaponPower, getWeaponWeakness, MAX_PROJECTILES, MAX_WEAPON_POWER, normalizeWeaponPower, type DamageTarget } from '../src/game/weapons';

describe('per-level weapon progression', () => {
  it('starts with one shot and adds one shot on each of the first seven upgrades', () => {
    for (let power = 0; power <= 7; power++) {
      expect(getWeaponPower(power)).toEqual({ power, projectiles: power + 1, damageMultiplier: 1, maxed: false });
    }
  });

  it('uses the last five upgrades to strengthen all eight shots', () => {
    for (let power = 8; power <= MAX_WEAPON_POWER; power++) {
      expect(getWeaponPower(power)).toEqual({ power, projectiles: MAX_PROJECTILES, damageMultiplier: 1 + (power - 7) * 0.25, maxed: power === 12 });
    }
    expect(getProjectileDamageMultiplier(12)).toBe(2.25);
  });

  it('caps collected power at twelve even after repeated pickups', () => {
    let power = 0;
    for (let pickups = 1; pickups <= 30; pickups++) {
      power = addWeaponPower(power);
      expect(power).toBe(Math.min(pickups, 12));
    }
  });

  it('never weakens a volley when collecting an upgrade', () => {
    for (const spread of [false, true]) {
      let previousDamage = 0;
      for (let power = 0; power <= MAX_WEAPON_POWER; power++) {
        const totalDamage = getProjectileCount(power, spread) * getProjectileDamageMultiplier(power, spread);
        expect(totalDamage).toBeGreaterThan(previousDamage);
        previousDamage = totalDamage;
      }
    }
  });

  it.each([[-2, 0], [2.8, 2], [99, 12], [Number.NaN, 0], [Infinity, 12], [-Infinity, 0]])('normalizes invalid power %s to %s', (power, expected) => {
    expect(normalizeWeaponPower(power)).toBe(expected);
    expect(getWeaponPower(power).power).toBe(expected);
  });
});

describe('temporary Supercharge', () => {
  it('provides the full twelve-power volley at every earned upgrade count', () => {
    for (let earned = 0; earned <= MAX_WEAPON_POWER; earned++) {
      const effective = getEffectiveWeaponPower(earned, true);
      expect(effective).toBe(MAX_WEAPON_POWER);
      expect(getProjectileCount(effective)).toBe(8);
      expect(getProjectileDamageMultiplier(effective)).toBe(2.25);
      expect(getEffectiveWeaponPower(earned, false)).toBe(earned);
    }
  });

  it('retains arrays collected while charged when the temporary boost ends', () => {
    let earned = 3;
    expect(getEffectiveWeaponPower(earned, true)).toBe(12);
    earned = addWeaponPower(earned);
    expect(getEffectiveWeaponPower(earned, true)).toBe(12);
    expect(getEffectiveWeaponPower(earned, false)).toBe(4);
    expect(getProjectileCount(getEffectiveWeaponPower(earned, false))).toBe(5);
  });
});

describe('temporary spread at the shot cap', () => {
  it('adds two shots while there is capacity', () => {
    expect(getProjectileCount(0, true)).toBe(3);
    expect(getProjectileCount(5, true)).toBe(8);
    expect(getProjectileDamageMultiplier(5, true)).toBe(1);
  });

  it('converts overflow to damage so spread stays effective at every power', () => {
    for (let power = 0; power <= MAX_WEAPON_POWER; power++) {
      const base = getWeaponPower(power);
      const shots = getProjectileCount(power, true);
      const damage = getProjectileDamageMultiplier(power, true);
      expect(shots).toBeLessThanOrEqual(8);
      expect(damage).toBeGreaterThanOrEqual(base.damageMultiplier);
      expect(shots * damage).toBeCloseTo((base.projectiles + 2) * base.damageMultiplier);
    }
    expect(getProjectileDamageMultiplier(12, true)).toBe(2.8125);
  });
});

describe('projectile type weaknesses', () => {
  const weaknesses: [DamageTarget, WeaponKind][] = [
    ['straight', 'scatter'], ['weaver', 'pulse'], ['shooter', 'lance'], ['debris', 'lance'],
    ['warden', 'lance'], ['twins', 'pulse'], ['carrier', 'scatter'], ['lattice', 'lance'], ['koschei', 'pulse'],
  ];

  it.each(weaknesses)('%s takes extra damage from %s', (target, weakness) => {
    expect(getWeaponWeakness(target)).toBe(weakness);
    for (const weapon of ['pulse', 'lance', 'scatter'] as WeaponKind[]) {
      expect(getDamageMultiplier(target, weapon)).toBe(weapon === weakness ? 1.6 : 1);
    }
  });

  it('leaves every enemy and boss killable with any weapon', () => {
    for (const [target] of weaknesses) {
      for (const weapon of ['pulse', 'lance', 'scatter'] as WeaponKind[]) {
        expect(getDamageMultiplier(target, weapon)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
