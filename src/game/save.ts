import { LEVELS } from '../data/levels';
import { TRANSMISSIONS } from '../data/transmissions';
import type { Checkpoint, SaveData } from './types';

export const SAVE_KEY = 'epoch.browser.save.v1';
const MAX_SCORE = 999_999_999;
type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Every call returns independent mutable state. No browser API is needed by this helper. */
export function defaultSave(): SaveData {
  return {
    version: 1,
    bestScore: 0,
    furthestSector: 1,
    checkpoint: null,
    unlockedTransmissions: TRANSMISSIONS.filter((entry) => entry.afterLevel === 0).map((entry) => entry.id),
    preferences: { music: true, sfx: true, reducedMotion: false },
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

function validCheckpoint(value: unknown): Checkpoint | null {
  if (!isRecord(value)) return null;
  const { level, score, hp } = value;
  if (
    typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > LEVELS.length ||
    typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > MAX_SCORE ||
    typeof hp !== 'number' || !Number.isInteger(hp) || hp < 1 || hp > 5
  ) return null;
  return { level, score, hp };
}

function normalizeSave(value: unknown): SaveData {
  const saved = defaultSave();
  // Unknown schema versions are intentionally not guessed at or partially migrated.
  if (!isRecord(value) || value.version !== 1) return saved;

  saved.checkpoint = validCheckpoint(value.checkpoint);
  saved.bestScore = Math.max(
    boundedInteger(value.bestScore, 0, 0, MAX_SCORE),
    saved.checkpoint?.score ?? 0,
  );
  saved.furthestSector = Math.max(
    boundedInteger(value.furthestSector, 1, 1, LEVELS.length),
    saved.checkpoint?.level ?? 1,
  );

  const unlocked = new Set(Array.isArray(value.unlockedTransmissions) ? value.unlockedTransmissions : []);
  saved.unlockedTransmissions = TRANSMISSIONS
    .filter((entry) => entry.afterLevel === 0 || unlocked.has(entry.id))
    .map((entry) => entry.id);

  if (isRecord(value.preferences)) {
    for (const key of ['music', 'sfx', 'reducedMotion'] as const) {
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
