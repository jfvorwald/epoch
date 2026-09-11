import { describe, expect, it } from 'vitest';
import { defaultSave, loadSave, persistSave, SAVE_KEY } from '../src/game/save';

function memoryStorage(raw: string | null = null) {
  const entries = new Map<string, string>();
  if (raw !== null) entries.set(SAVE_KEY, raw);
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  };
}

describe('local save restoration', () => {
  it('restores a completed-level boundary and all preferences after a reload', () => {
    const storage = memoryStorage();
    const original = defaultSave();
    original.bestScore = 15400;
    original.furthestSector = 4;
    original.checkpoint = { level: 4, score: 9800, hp: 3 };
    original.preferences = { music: false, sfx: true, reducedMotion: true };
    original.unlockedTransmissions = ['launch-orders', 'cold-start', 'voss-echo'];

    expect(persistSave(original, storage)).toBe(true);
    const restored = loadSave(storage);
    expect(restored).toEqual(original);
    restored.checkpoint!.hp = 1;
    expect(loadSave(storage).checkpoint?.hp).toBe(3);
  });

  it('starts safely with absent, malformed, null, array or unknown-version data', () => {
    for (const raw of [null, '', '{unfinished', 'null', '[]', 'true', '{"version":2,"bestScore":900}']) {
      expect(loadSave(memoryStorage(raw))).toEqual(defaultSave());
    }
  });

  it('recovers valid fields from a partial save without coercing strings to preferences', () => {
    const restored = loadSave(memoryStorage(JSON.stringify({
      version: 1,
      bestScore: 1200,
      preferences: { music: false, sfx: 'false', reducedMotion: true },
    })));
    expect(restored.bestScore).toBe(1200);
    expect(restored.checkpoint).toBeNull();
    expect(restored.preferences).toEqual({ music: false, sfx: true, reducedMotion: true });
    expect(restored.unlockedTransmissions).toEqual(['launch-orders']);
  });

  it('bounds damaged statistics and filters unknown or duplicate transmission IDs', () => {
    const restored = loadSave(memoryStorage(JSON.stringify({
      version: 1,
      bestScore: -20,
      furthestSector: 600,
      unlockedTransmissions: ['cold-start', 'cold-start', 4, '__proto__', 'unreleased-epoch'],
    })));
    expect(restored.bestScore).toBe(0);
    expect(restored.furthestSector).toBe(5);
    expect(restored.unlockedTransmissions).toEqual(['launch-orders', 'cold-start']);
  });

  it('discards incomplete, fractional, dead, or out-of-campaign checkpoints', () => {
    const invalid = [
      { level: 6, score: 5, hp: 4 },
      { level: 0, score: 5, hp: 4 },
      { level: 2.5, score: 5, hp: 4 },
      { level: 2, score: 5, hp: 0 },
      { level: 2, score: 5, hp: 6 },
      { level: 2, score: -1, hp: 4 },
      { level: 2, score: 5.5, hp: 4 },
      { level: 2, score: 1e50, hp: 4 },
      { level: '2', score: 5, hp: 4 },
      { level: 2, score: 5 },
    ];
    for (const checkpoint of invalid) {
      const restored = loadSave(memoryStorage(JSON.stringify({ version: 1, checkpoint, bestScore: 50 })));
      expect(restored.checkpoint).toBeNull();
      expect(restored.bestScore).toBe(50);
    }
  });

  it('keeps lifetime records consistent with a valid boundary checkpoint', () => {
    const restored = loadSave(memoryStorage(JSON.stringify({
      version: 1,
      bestScore: 10,
      furthestSector: 1,
      checkpoint: { level: 5, score: 20000, hp: 1 },
    })));
    expect(restored.bestScore).toBe(20000);
    expect(restored.furthestSector).toBe(5);
    expect(restored.checkpoint).toEqual({ level: 5, score: 20000, hp: 1 });
  });

  it('clears Continue while keeping records and archive after a completed run', () => {
    const storage = memoryStorage();
    const completed = defaultSave();
    completed.bestScore = 42000;
    completed.furthestSector = 5;
    completed.unlockedTransmissions.push('cold-start', 'voss-echo', 'open-channel');
    completed.checkpoint = null;
    persistSave(completed, storage);
    expect(loadSave(storage)).toEqual(completed);
  });

  it('does not share default objects between fresh runs', () => {
    const first = defaultSave();
    first.preferences.music = false;
    first.unlockedTransmissions.push('open-channel');
    expect(defaultSave().preferences.music).toBe(true);
    expect(defaultSave().unlockedTransmissions).toEqual(['launch-orders']);
  });
});

describe('unavailable browser storage', () => {
  it('handles read policy and write quota failures without interrupting play', () => {
    const blocked = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
    };
    expect(loadSave(blocked)).toEqual(defaultSave());
    expect(persistSave(defaultSave(), blocked)).toBe(false);
    expect(loadSave(null)).toEqual(defaultSave());
    expect(persistSave(defaultSave(), null)).toBe(false);
  });

  it('handles a security exception when the localStorage property itself is read', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    try {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get: () => { throw new Error('SecurityError'); },
      });
      expect(loadSave()).toEqual(defaultSave());
      expect(persistSave(defaultSave())).toBe(false);
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});
