import { MAX_LEVEL_NUMBER, MAX_SCORE } from '../data/config';
import { TRANSMISSIONS } from '../data/transmissions';
import { defaultLoadout, isShipUnlocked, PLAYER_MAX_HP, SHIP_PARTS_REQUIRED } from '../data/ships';
import type { Checkpoint, SaveData, ShipId, ShipLoadout } from './types';

export const SAVE_KEY = 'epoch.browser.save.v1';
// Older v1 hull/loadout combinations allowed up to eight hits.
const LEGACY_MAX_HP = 8;
type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Every call returns independent mutable state. No browser API is needed by this helper. */
export function defaultSave(): SaveData {
  return {
    version: 1,
    bestScore: 0,
    furthestLevel: 1,
    checkpoint: null,
    unlockedTransmissions: TRANSMISSIONS.filter((entry) => entry.afterLevel === 0).map((entry) => entry.id),
    preferences: { music: true, sfx: true, reducedMotion: false, trainingWheels: false },
    hangar: {
      selectedShip: 'strelka', parts: 0,
      loadouts: { strelka: defaultLoadout(), manta: defaultLoadout() },
    },
  };
}

function browserStorage(): SaveStorage | null {
  // Safari private modes or a blocked storage policy may throw even when reading the property.
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.floor(value)))
    : fallback;
}

function validLoadout(value: unknown): ShipLoadout {
  const loadout = defaultLoadout();
  if (!isRecord(value)) return loadout;
  if (value.handling === 'balanced' || value.handling === 'agile' || value.handling === 'armored') {
    loadout.handling = value.handling;
  }
  if (value.reactor === 'balanced' || value.reactor === 'rapid' || value.reactor === 'heavy') {
    loadout.reactor = value.reactor;
  }
  return loadout;
}

function validShipId(value: unknown, parts: number): ShipId {
  return value === 'manta' && isShipUnlocked('manta', parts) ? 'manta' : 'strelka';
}

function validCheckpoint(value: unknown, parts: number): Checkpoint | null {
  if (!isRecord(value)) return null;
  const { level, score, hp } = value;
  const shipId = validShipId(value.shipId, parts);
  const loadout = validLoadout(value.loadout);
  if (
    typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL_NUMBER ||
    typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > MAX_SCORE ||
    typeof hp !== 'number' || !Number.isInteger(hp) || hp < 1 || hp > LEGACY_MAX_HP
  ) return null;
  const normalizedHp = Math.min(hp, PLAYER_MAX_HP);
  // Preserve old v1 boundaries; the flight code treats omitted snapshots as Strelka / balanced.
  return value.shipId === undefined && value.loadout === undefined
    ? { level, score, hp: normalizedHp }
    : { level, score, hp: normalizedHp, shipId, loadout };
}

function normalizeSave(value: unknown): SaveData {
  const saved = defaultSave();
  // Unknown schema versions are intentionally not guessed at or partially migrated.
  if (!isRecord(value) || value.version !== 1) return saved;

  if (isRecord(value.hangar)) {
    saved.hangar.parts = boundedInteger(value.hangar.parts, 0, 0, SHIP_PARTS_REQUIRED);
    saved.hangar.selectedShip = validShipId(value.hangar.selectedShip, saved.hangar.parts);
    if (isRecord(value.hangar.loadouts)) {
      saved.hangar.loadouts.strelka = validLoadout(value.hangar.loadouts.strelka);
      saved.hangar.loadouts.manta = validLoadout(value.hangar.loadouts.manta);
    }
  }
  saved.checkpoint = validCheckpoint(value.checkpoint, saved.hangar.parts);
  saved.bestScore = Math.max(
    boundedInteger(value.bestScore, 0, 0, MAX_SCORE),
    saved.checkpoint?.score ?? 0,
  );
  saved.furthestLevel = Math.max(
    boundedInteger(value.furthestLevel ?? value.furthestSector, 1, 1, MAX_LEVEL_NUMBER),
    saved.checkpoint?.level ?? 1,
  );

  const unlocked = new Set(Array.isArray(value.unlockedTransmissions) ? value.unlockedTransmissions : []);
  // The old five-level ending deleted its boundary. Carry those completed saves
  // into chapter two without inventing a retained flight score or hull snapshot.
  if (value.furthestLevel === undefined && typeof value.furthestSector === 'number' &&
      value.furthestSector >= 5 && !saved.checkpoint && unlocked.has('open-channel')) {
    const shipId = saved.hangar.selectedShip;
    saved.checkpoint = { level: 6, score: 0, hp: PLAYER_MAX_HP, shipId, loadout: { ...saved.hangar.loadouts[shipId] } };
    saved.furthestLevel = Math.max(6, saved.furthestLevel);
  }
  saved.unlockedTransmissions = TRANSMISSIONS
    .filter((entry) => entry.afterLevel === 0 || entry.afterLevel < saved.furthestLevel || unlocked.has(entry.id))
    .map((entry) => entry.id);

  if (isRecord(value.preferences)) {
    for (const key of ['music', 'sfx', 'reducedMotion', 'trainingWheels'] as const) {
      if (typeof value.preferences[key] === 'boolean') saved.preferences[key] = value.preferences[key];
    }
  }
  return saved;
}

/** Unavailable storage or malformed content always produces a playable fresh save. */
export function loadSave(storage: SaveStorage | null = browserStorage()): SaveData {
  if (!storage) return defaultSave();
  try {
    const raw = storage.getItem(SAVE_KEY);
    return raw === null ? defaultSave() : normalizeSave(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

/** Returns false on quota/security failures so the UI can report session-only progress. */
export function persistSave(data: SaveData, storage: SaveStorage | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(normalizeSave(data)));
    return true;
  } catch {
    return false;
  }
}
