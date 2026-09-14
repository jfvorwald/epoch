import type { WeaponKind } from './types';

export const MAX_WEAPON_POWER = 12;
export const MAX_PROJECTILES = 8;
export const POWER_DAMAGE_STEP = 0.25;
export const WEAKNESS_DAMAGE_MULTIPLIER = 1.6;

export type DamageTarget = 'straight' | 'weaver' | 'shooter' | 'debris' | 'warden' | 'twins' | 'carrier' | 'lattice' | 'koschei';

export const WEAPON_WEAKNESSES: Readonly<Record<DamageTarget, WeaponKind>> = {
  straight: 'scatter',
  weaver: 'pulse',
  shooter: 'lance',
  debris: 'lance',
  warden: 'lance',
  twins: 'pulse',
  carrier: 'scatter',
  lattice: 'lance',
  koschei: 'pulse',
};

export function normalizeWeaponPower(power: number): number {
  return Number.isNaN(power) ? 0 : Math.max(0, Math.min(MAX_WEAPON_POWER, Math.trunc(power)));
}

export function addWeaponPower(power: number): number {
  return normalizeWeaponPower(normalizeWeaponPower(power) + 1);
}

/** Supercharge changes firing power without replacing the upgrades earned this level. */
export function getEffectiveWeaponPower(earned: number, supercharged: boolean): number {
  return supercharged ? MAX_WEAPON_POWER : normalizeWeaponPower(earned);
}

/** One starting shot; the first seven upgrades add shots, and the final five strengthen every shot. */
export function getWeaponPower(power: number): { power: number; projectiles: number; damageMultiplier: number; maxed: boolean } {
  const normalized = normalizeWeaponPower(power);
  return {
    power: normalized,
    projectiles: Math.min(MAX_PROJECTILES, normalized + 1),
    damageMultiplier: 1 + Math.max(0, normalized - (MAX_PROJECTILES - 1)) * POWER_DAMAGE_STEP,
    maxed: normalized === MAX_WEAPON_POWER,
  };
}

export function getProjectileCount(power: number, spreadActive = false): number {
  return Math.min(MAX_PROJECTILES, getWeaponPower(power).projectiles + (spreadActive ? 2 : 0));
}

/** Convert spread shots above the cap into damage, preserving the buff's total volley strength. */
export function getProjectileDamageMultiplier(power: number, spreadActive = false): number {
  const profile = getWeaponPower(power);
  const requestedShots = profile.projectiles + (spreadActive ? 2 : 0);
  return profile.damageMultiplier * requestedShots / Math.min(MAX_PROJECTILES, requestedShots);
}

export function getWeaponWeakness(target: DamageTarget): WeaponKind {
  return WEAPON_WEAKNESSES[target];
}

export function getDamageMultiplier(target: DamageTarget, weapon: WeaponKind): number {
  return getWeaponWeakness(target) === weapon ? WEAKNESS_DAMAGE_MULTIPLIER : 1;
}
