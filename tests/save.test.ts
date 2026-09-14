import { describe, expect, it } from 'vitest';
import { defaultSave, loadSave, persistSave, SAVE_KEY } from '../src/game/save';
import { SHIP_PARTS_REQUIRED } from '../src/data/ships';
import { MAX_LEVEL_NUMBER } from '../src/data/config';
import { TRANSMISSIONS } from '../src/data/transmissions';

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
    original.furthestLevel = 4;
    original.checkpoint = { level: 4, score: 9800, hp: 3 };
    original.preferences = { music: false, sfx: true, reducedMotion: true, trainingWheels: true };
    original.unlockedTransmissions = TRANSMISSIONS.filter(t => t.afterLevel <= 3).map(t => t.id);

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
    expect(restored.preferences).toEqual({ music: false, sfx: true, reducedMotion: true, trainingWheels: false });
    expect(restored.unlockedTransmissions).toEqual(['launch-orders']);
  });

  it('bounds damaged statistics and filters unknown or duplicate transmission IDs', () => {
    const restored = loadSave(memoryStorage(JSON.stringify({
      version: 1,
      bestScore: -20,
      furthestLevel: -600,
      unlockedTransmissions: ['cold-start', 'cold-start', 4, '__proto__', 'unreleased-epoch'],
    })));
    expect(restored.bestScore).toBe(0);
    expect(restored.furthestLevel).toBe(1);
    expect(restored.unlockedTransmissions).toEqual(['launch-orders', 'cold-start']);
  });

  it('keeps Training Wheels off for older or malformed preferences without changing player progress', () => {
    const original = defaultSave();
    original.bestScore = 123456;
    original.furthestLevel = 51;
    original.checkpoint = { level: 51, score: 98765, hp: 2, shipId: 'manta', loadout: { handling: 'agile', reactor: 'heavy' } };
    original.unlockedTransmissions = TRANSMISSIONS.map(entry => entry.id);
    original.hangar.parts = SHIP_PARTS_REQUIRED;
    original.hangar.selectedShip = 'manta';
    original.hangar.loadouts.manta = { handling: 'agile', reactor: 'heavy' };
    original.preferences = { music: false, sfx: false, reducedMotion: true, trainingWheels: false };

    for (const value of [undefined, null, 'true', 'false', 1, 0, [], {}]) {
      const storage = memoryStorage(JSON.stringify({
        ...original, preferences: { ...original.preferences, trainingWheels: value },
      }));
      const restored = loadSave(storage);
      expect(restored).toEqual(original);
      expect(persistSave(restored, storage)).toBe(true);
      expect(loadSave(storage)).toEqual(original);
    }
  });

  it('discards incomplete, fractional, dead, or numerically unsafe checkpoints', () => {
    const invalid = [
      { level: MAX_LEVEL_NUMBER + 1, score: 5, hp: 4 },
      { level: 0, score: 5, hp: 4 },
      { level: 2.5, score: 5, hp: 4 },
      { level: 2, score: 5, hp: 0 },
      { level: 2, score: 5, hp: 9 },
      { level: 2, score: 5, hp: 2.5 },
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
      furthestLevel: 1,
      checkpoint: { level: 5, score: 20000, hp: 1 },
    })));
    expect(restored.bestScore).toBe(20000);
    expect(restored.furthestLevel).toBe(5);
    expect(restored.checkpoint).toEqual({ level: 5, score: 20000, hp: 1 });
  });

  it('clears Continue while keeping records and archive after a completed run', () => {
    const storage = memoryStorage();
    const completed = defaultSave();
    completed.bestScore = 42000;
    completed.furthestLevel = 5;
    completed.unlockedTransmissions = TRANSMISSIONS.filter(t => t.afterLevel <= 5).map(t => t.id);
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
    first.hangar.parts = 5;
    first.hangar.loadouts.strelka.handling = 'agile';
    expect(defaultSave().hangar.parts).toBe(0);
    expect(defaultSave().hangar.loadouts.strelka.handling).toBe('balanced');
    expect(first.hangar.loadouts.manta.handling).toBe('balanced');
  });
});

describe('hangar progression and checkpoint migration', () => {
  it('adds a fresh hangar to legacy v1 saves without losing records or the old checkpoint', () => {
    const oldSave = {
      version: 1, bestScore: 38400, furthestSector: 4,
      checkpoint: { level: 3, score: 12200, hp: 4 },
      unlockedTransmissions: ['launch-orders', 'cold-start', 'voss-echo'],
      preferences: { music: false, sfx: false, reducedMotion: true },
    };
    const restored = loadSave(memoryStorage(JSON.stringify(oldSave)));
    const { furthestSector, ...legacyFields } = oldSave;
    expect(restored).toEqual({ ...legacyFields, preferences: { ...oldSave.preferences, trainingWheels: false }, furthestLevel: furthestSector, checkpoint: { ...oldSave.checkpoint, hp: 3 }, hangar: defaultSave().hangar, unlockedTransmissions: TRANSMISSIONS.filter(t => t.afterLevel <= 3).map(t => t.id) });
  });

  it('continues completed legacy five-level saves into level six', () => {
    const restored = loadSave(memoryStorage(JSON.stringify({
      version: 1, furthestSector: 5, bestScore: 50000, checkpoint: null,
      unlockedTransmissions: ['launch-orders', 'cold-start', 'voss-echo', 'open-channel'],
    })));
    expect(restored.furthestLevel).toBe(6);
    expect(restored.checkpoint).toMatchObject({ level: 6, score: 0, hp: 3, shipId: 'strelka' });
    expect(restored.bestScore).toBe(50000);
    expect(restored).not.toHaveProperty('furthestSector');
    expect(restored.unlockedTransmissions).toEqual(TRANSMISSIONS.filter(t => t.afterLevel <= 5).map(t => t.id));
  });

  it('preserves late-story and endless checkpoints without wrapping to level one', () => {
    for (const level of [6, 49, 50, 51, 100, 1000, 1000000]) {
      const storage = memoryStorage();
      const saved = defaultSave();
      saved.checkpoint = { level, score: 1_000_000_050, hp: 2 };
      saved.furthestLevel = level;
      expect(persistSave(saved, storage)).toBe(true);
      const restored = loadSave(storage);
      expect(restored.checkpoint).toEqual(saved.checkpoint);
      expect(restored.furthestLevel).toBe(level);
      expect(restored.unlockedTransmissions).toEqual(TRANSMISSIONS.filter(t => t.afterLevel < level).map(t => t.id));
    }
  });

  it('persists recovered fragments and separate ship configurations across runs', () => {
    const storage = memoryStorage();
    const save = defaultSave();
    save.hangar.parts = 7;
    save.hangar.loadouts.strelka = { handling: 'agile', reactor: 'rapid' };
    save.hangar.loadouts.manta = { handling: 'armored', reactor: 'heavy' };
    expect(persistSave(save, storage)).toBe(true);
    expect(loadSave(storage)).toEqual(save);
    save.checkpoint = null;
    save.hangar.parts = SHIP_PARTS_REQUIRED;
    save.hangar.selectedShip = 'manta';
    persistSave(save, storage);
    expect(loadSave(storage).hangar).toEqual(save.hangar);
  });

  it('migrates an old eight-hull Manta boundary to three hull while preserving its loadout snapshot', () => {
    const storage = memoryStorage();
    const save = defaultSave();
    save.hangar.parts = SHIP_PARTS_REQUIRED;
    // Selecting or customizing another ship later must not rewrite the active run.
    save.hangar.selectedShip = 'strelka';
    save.hangar.loadouts.manta = { handling: 'agile', reactor: 'rapid' };
    save.checkpoint = {
      level: 3, score: 15800, hp: 8, shipId: 'manta',
      loadout: { handling: 'armored', reactor: 'heavy' },
    };
    save.bestScore = 15800;
    save.furthestLevel = 3;
    expect(persistSave(save, storage)).toBe(true);
    expect(loadSave(storage)).toEqual({ ...save, checkpoint: { ...save.checkpoint, hp: 3 }, unlockedTransmissions: TRANSMISSIONS.filter(t => t.afterLevel < 3).map(t => t.id) });
    expect(save.checkpoint.hp).toBe(8);
  });

  it('does not equip an unfinished ship from the hangar or a checkpoint', () => {
    const restored = loadSave(memoryStorage(JSON.stringify({
      version: 1,
      hangar: { selectedShip: 'manta', parts: SHIP_PARTS_REQUIRED - 1 },
      checkpoint: { level: 2, score: 1400, hp: 4, shipId: 'manta' },
    })));
    expect(restored.hangar.selectedShip).toBe('strelka');
    expect(restored.hangar.parts).toBe(SHIP_PARTS_REQUIRED - 1);
    expect(restored.checkpoint).toEqual({
      level: 2, score: 1400, hp: 3, shipId: 'strelka',
      loadout: { handling: 'balanced', reactor: 'balanced' },
    });
  });

  it('preserves every old hull value from one through eight and caps restored hull at three', () => {
    for (let hp = 1; hp <= 8; hp++) {
      const checkpoint = { level: 3, score: 7200, hp };
      const restored = loadSave(memoryStorage(JSON.stringify({ version: 1, checkpoint })));
      expect(restored.checkpoint).toEqual({ ...checkpoint, hp: Math.min(hp, 3) });
      expect(restored.bestScore).toBe(7200);
      expect(restored.furthestLevel).toBe(3);
    }
  });

  it('rejects checkpoint hull values beyond the legacy maximum for any configuration', () => {
    for (const checkpoint of [
      { level: 2, score: 50, hp: 9, shipId: 'strelka', loadout: { handling: 'agile', reactor: 'balanced' } },
      { level: 2, score: 50, hp: 9, shipId: 'manta', loadout: { handling: 'armored', reactor: 'balanced' } },
    ]) {
      const restored = loadSave(memoryStorage(JSON.stringify({
        version: 1, hangar: { parts: SHIP_PARTS_REQUIRED }, checkpoint,
      })));
      expect(restored.checkpoint).toBeNull();
    }
  });

  it('sanitizes malformed fragment values without trusting numeric strings', () => {
    for (const [parts, expected] of [[-3, 0], [4.9, 4], [800, SHIP_PARTS_REQUIRED], ['12', 0], [null, 0], [{}, 0]] as const) {
      const restored = loadSave(memoryStorage(JSON.stringify({ version: 1, hangar: { parts } })));
      expect(restored.hangar.parts).toBe(expected);
    }
    const storage = memoryStorage();
    const save = defaultSave();
    save.hangar.parts = Number.POSITIVE_INFINITY;
    persistSave(save, storage);
    expect(loadSave(storage).hangar.parts).toBe(0);
  });

  it('repairs corrupted configurations one field at a time and ignores unknown ship names', () => {
    const restored = loadSave(memoryStorage(JSON.stringify({
      version: 1,
      hangar: {
        selectedShip: '__proto__', parts: SHIP_PARTS_REQUIRED,
        loadouts: { strelka: { handling: 'teleport', reactor: 'heavy' }, manta: { handling: 'armored', reactor: false } },
      },
      checkpoint: { level: 2, score: 900, hp: 4, shipId: 'prototype', loadout: { handling: 'agile', reactor: 'unlimited' } },
    })));
    expect(restored.hangar.selectedShip).toBe('strelka');
    expect(restored.hangar.loadouts).toEqual({
      strelka: { handling: 'balanced', reactor: 'heavy' },
      manta: { handling: 'armored', reactor: 'balanced' },
    });
    expect(restored.checkpoint).toMatchObject({ shipId: 'strelka', loadout: { handling: 'agile', reactor: 'balanced' } });
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
