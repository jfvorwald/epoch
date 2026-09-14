/** Player-facing progression vocabulary: a level contains waves. */
export const CAMPAIGN_LEVEL_COUNT = 50;
// JavaScript's exact-integer boundary, not an authored campaign endpoint.
export const MAX_LEVEL_NUMBER = Number.MAX_SAFE_INTEGER - 1;
export const MAX_SCORE = Number.MAX_SAFE_INTEGER;

export const GAME_CONFIG = {
  terminology: { level: 'level', wave: 'wave' },
  campaign: { authoredLevelCount: CAMPAIGN_LEVEL_COUNT, levelsPerChapter: 5, endlessAfterStory: true },
  waves: {
    minimumTotal: 8, maximumTotal: 10,
    asteroidWaves: { minimum: 0, maximum: 2 },
    openingWave: { minimumBasicHits: 4, maximumBasicHits: 5 },
  },
  asteroids: { warningSeconds: 1.2, minSpeed: 175, maxSpeed: 260, staggerSeconds: 0.8 },
  pickups: {
    permanentPower: { openingWavesWithoutDrops: 2, maxPerWave: 1, minimumPerLevel: 5, maximumPerLevel: 7 },
    supercharge: { chancePerLevel: 0.3, durationSeconds: 6 },
  },
  scaling: { maxProjectileSpeed: 300 },
} as const;
