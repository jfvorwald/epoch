import { describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_LEVEL_COUNT, MAX_LEVEL_NUMBER } from '../src/data/config';
import { getLevelVisual, type LevelVisual } from '../src/data/visuals';

const authored = Array.from({ length: CAMPAIGN_LEVEL_COUNT }, (_, index) => getLevelVisual(index + 1));

function luminance(color: number): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return channel((color >>> 16) & 255) * 0.2126 + channel((color >>> 8) & 255) * 0.7152 + channel(color & 255) * 0.0722;
}

function appearance(visual: LevelVisual): string {
  return JSON.stringify([visual.environment, visual.palette, visual.landmark, visual.hullStyle, visual.hullVariant]);
}

describe('level visual identities', () => {
  it('gives all fifty destinations their own palette, fleet, and ship geometry', () => {
    expect(authored.map(visual => visual.level)).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
    expect(new Set(authored.map(visual => JSON.stringify(visual.palette))).size).toBe(50);
    expect(new Set(authored.map(visual => visual.fleet)).size).toBe(50);
    expect(new Set(authored.map(visual => `${visual.hullStyle}:${visual.hullVariant}`)).size).toBe(50);
    expect(new Set(authored.map(visual => visual.environment)).size).toBe(10);
    expect(new Set(authored.map(visual => visual.seed)).size).toBe(50);
    expect(new Set(authored.map(appearance)).size).toBe(50);
  });

  it('makes the first five places visibly different before any later chapter is unlocked', () => {
    const opening = authored.slice(0, 5);
    expect(new Set(opening.map(visual => visual.environment)).size).toBe(5);
    expect(new Set(opening.map(visual => visual.hullStyle)).size).toBe(5);
    // Haze channels distinguish blue orbit, amber relay, oxidized wrecks, violet static, and red machinery.
    expect(opening.map(visual => visual.environment)).toEqual(['orbit', 'relay', 'wreckage', 'nebula', 'array']);
    expect(getLevelVisual(8).environment).toBe('garden');
    expect(getLevelVisual(21).environment).toBe('ocean');
    expect(getLevelVisual(24).environment).toBe('ice');
    expect(getLevelVisual(34).environment).toBe('beacons');
    expect(getLevelVisual(50).environment).toBe('orbit');
  });

  it('keeps backgrounds dark and enemy colors readable for authored and distant routes', () => {
    for (const visual of [...authored, ...[51, 100, 1000, 1_000_000, MAX_LEVEL_NUMBER].map(getLevelVisual)]) {
      for (const color of Object.values(visual.palette)) {
        expect(Number.isInteger(color)).toBe(true);
        expect(color).toBeGreaterThanOrEqual(0);
        expect(color).toBeLessThanOrEqual(0xffffff);
      }
      expect(luminance(visual.palette.void)).toBeLessThan(0.015);
      expect(luminance(visual.palette.haze)).toBeLessThan(0.08);
      expect((luminance(visual.palette.enemy) + 0.05) / (luminance(visual.palette.void) + 0.05)).toBeGreaterThan(5);
      expect(Number.isInteger(visual.hullStyle)).toBe(true);
      expect(visual.hullStyle).toBeGreaterThanOrEqual(0);
      expect(visual.hullStyle).toBeLessThan(10);
      expect(Number.isInteger(visual.hullVariant)).toBe(true);
      expect(visual.hullVariant).toBeGreaterThanOrEqual(0);
      expect(visual.hullVariant).toBeLessThan(5);
      expect(visual.landmark).toBeGreaterThanOrEqual(0);
      expect(visual.landmark).toBeLessThan(5);
      expect(visual.starSpeed).toBeGreaterThan(0);
      expect(visual.starSpeed).toBeLessThan(1.5);
      expect(Math.abs(visual.flowAngle)).toBeLessThan(Math.PI / 4);
    }
  });

  it('varies endless scenery repeatably without consuming gameplay randomness', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Visuals consumed gameplay randomness'); });
    try {
      const routes = Array.from({ length: 50 }, (_, index) => getLevelVisual(index + 51));
      expect(new Set(routes.map(appearance)).size).toBe(50);
      for (const visual of [...authored, ...routes, getLevelVisual(MAX_LEVEL_NUMBER)]) {
        expect(getLevelVisual(visual.level)).toEqual(visual);
      }
      expect(getLevelVisual(0x100000001).seed).not.toBe(getLevelVisual(1).seed);
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });

  it('normalizes invalid input consistently and does not expose mutable shared palettes', () => {
    for (const invalid of [NaN, Infinity, -Infinity, -4, 0]) expect(getLevelVisual(invalid)).toEqual(getLevelVisual(1));
    expect(getLevelVisual(12.8)).toEqual(getLevelVisual(12));
    expect(getLevelVisual(Number.MAX_VALUE)).toEqual(getLevelVisual(MAX_LEVEL_NUMBER));
    const changed = getLevelVisual(8);
    const original = getLevelVisual(8);
    changed.palette.void = 0xffffff;
    changed.fleet = 'changed by a renderer';
    expect(getLevelVisual(8)).toEqual(original);
  });
});
