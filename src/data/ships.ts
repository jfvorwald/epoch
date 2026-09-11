import type { ShipId, ShipLoadout, WeaponKind } from '../game/types';

export const PLAYER_MAX_HP = 3;

export interface ShipStats {
  maxHp: number;
  speed: number;
  /** Seconds of protection after taking a hit. */
  hitRecovery: number;
  /** Seconds between volleys, before temporary powerups and weapon modifiers. */
  fireInterval: number;
  damage: number;
}

export interface ShipDefinition extends ShipStats {
  id: ShipId;
  name: string;
  className: string;
  description: string;
  art: string;
  weapon: WeaponKind;
}

export const SHIPS: Record<ShipId, ShipDefinition> = {
  strelka: {
    id: 'strelka', name: 'STRELKA-9', className: 'INTERCEPTOR',
    description: 'A nimble interceptor with paired pulse cannons. Keep moving and carve a path through the swarm.',
    art: '/art/strelka.svg', weapon: 'pulse',
    maxHp: PLAYER_MAX_HP, speed: 310, hitRecovery: 1.3, fireInterval: 0.2, damage: 1,
  },
  manta: {
    id: 'manta', name: 'MANTA-12', className: 'LANCE CORVETTE',
    description: 'A broad armored crescent built around a piercing ion lance. Line up your targets and punch through the formation.',
    art: '/art/manta.svg', weapon: 'lance',
    maxHp: PLAYER_MAX_HP, speed: 270, hitRecovery: 1.3, fireInterval: 0.3, damage: 1.4,
  },
};

// At most one fragment roll per sector: about thirteen full campaigns on average.
export const SHIP_PARTS_REQUIRED = 12;
export const SHIP_PART_DROP_CHANCE = 0.18;

export function defaultLoadout(): ShipLoadout {
  return { handling: 'balanced', reactor: 'balanced' };
}

export function isShipUnlocked(shipId: ShipId, parts: number): boolean {
  return shipId === 'strelka' || (shipId === 'manta' && Number.isFinite(parts) && parts >= SHIP_PARTS_REQUIRED);
}

export function getShipStats(shipId: ShipId, loadout: ShipLoadout): ShipStats {
  const ship = SHIPS[shipId];
  let { speed, hitRecovery, fireInterval, damage } = ship;
  if (loadout.handling === 'agile') { hitRecovery = 1; speed *= 1.2; }
  if (loadout.handling === 'armored') { hitRecovery = 1.8; speed *= 0.85; }
  if (loadout.reactor === 'rapid') { fireInterval *= 0.75; damage *= 0.8; }
  if (loadout.reactor === 'heavy') { fireInterval *= 1.3; damage *= 1.45; }
  return { maxHp: PLAYER_MAX_HP, speed, hitRecovery, fireInterval, damage };
}
