/**
 * Start Vite, then run: node scripts/verify-endless.mjs
 * EPOCH_BASE_URL defaults to http://127.0.0.1:5173/.
 * EPOCH_BROWSER=webkit selects Playwright WebKit; default is local Chrome.
 * EPOCH_AUDIT_LEVELS=1,5,50,51,100 optionally selects a smaller explicit sample.
 *
 * Default audit: all 50 authored levels, then 51 and 100. Consecutive levels
 * advance through the real completion, transmission, and victory controls.
 * Level 100 uses the local playtest level selector as a separate late sample.
 *
 * This is a progression/collision audit, NOT a difficulty or human playability
 * test. Its assisted pilot is invulnerable and instantly aims from coordinates
 * bounded by the playable arena. It advances the real Scene at a fixed 60Hz,
 * using normal automatic weapons, projectile collisions, pickups, guardian
 * phases, and wave-clear rules. It NEVER changes enemy HP, weapon power,
 * projectile damage, score, schedules, or outcomes, and never forces kills.
 * Math.random is seeded separately before each level for reproducible plans.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from '@playwright/test';

const browserName = process.env.EPOCH_BROWSER ?? 'chrome';
assert.ok(['chrome', 'webkit'].includes(browserName), 'EPOCH_BROWSER must be chrome or webkit');
const levels = process.env.EPOCH_AUDIT_LEVELS
  ? process.env.EPOCH_AUDIT_LEVELS.split(',').map(Number)
  : [...Array.from({ length: 50 }, (_, index) => index + 1), 51, 100];
assert.ok(levels.length && levels.every(level => Number.isInteger(level) && (level >= 1 && level <= 51 || level === 100)), 'The local playtest selector supports levels 1–51 and 100');
const browser = await (browserName === 'webkit' ? webkit.launch() : chromium.launch({ channel: 'chrome', headless: true }));
const results = [];
const errors = [];
const description = 'Assisted progression audit: invulnerability and instant arena-bounded aim; real autofire/collisions/rewards; no forced kills or upgrades. Not a difficulty test.';
const started = Date.now();
let passed = false;

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  const url = new URL(process.env.EPOCH_BASE_URL ?? 'http://127.0.0.1:5173/');
  url.searchParams.set('playtest', '1');
  await page.goto(url.toString());
  await page.locator('[data-action="launch"]:not(:disabled)').waitFor();
  await page.locator('[data-action="settings"]').click();
  await page.locator('input[name="music"]').uncheck();
  await page.locator('input[name="sfx"]').uncheck();
  await page.locator('[data-action="settings-back"]').click();
  await page.evaluate(() => window.__EPOCH__.game.loop.stop());

  for (let index = 0; index < levels.length; index++) {
    const level = levels[index];
    await page.evaluate(levelId => {
      let seed = Math.imul(0x45a09e31 ^ levelId, 0x9e3779b1) >>> 0;
      Math.random = () => {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        return (seed >>> 0) / 4294967296;
      };
    }, level);
    if (index && level === levels[index - 1] + 1) {
      await page.locator('[data-action="advance"]').click();
      if (await page.locator('[data-action="transmission-next"]').count()) await page.locator('[data-action="transmission-next"]').click();
      if (await page.locator('[data-action="continue-beyond"]').count()) await page.locator('[data-action="continue-beyond"]').click();
    } else {
      if (index) await page.locator('[data-action="menu"]').click();
      await page.getByLabel('Playtest starting level', { exact: true }).selectOption(String(level));
      await page.locator('[data-action="launch"]').click();
    }

    const result = await page.evaluate(expectedLevel => {
      const { scene, game, snapshot } = window.__EPOCH__;
      game.loop.stop();
      scene.debug('invulnerable', { seconds: 1_000_000 });
      let target;
      let maxHostile = 0, maxFriendly = 0, maxEnemies = 0, maxEffects = 0;
      let maxPower = 0, bossPhase = 0, returnedAsteroids = 0;
      const seenReturning = new Set();
      const initial = scene.getDebugState();
      for (let tick = 0; tick < 60 * 900 && scene.mode === 'combat'; tick++) {
        const visible = enemy => enemy.age >= 0 && enemy.x >= 15 && enemy.x <= 465 && enemy.y >= -10 && enemy.y <= 660;
        if (!target || !scene.enemies.includes(target) || !visible(target)) {
          target = scene.enemies.filter(visible).sort((a, b) => Number(b.boss) - Number(a.boss) || a.hp - b.hp || b.y - a.y)[0];
        }
        if (target) {
          const travelSeconds = 0.1;
          const drift = Math.max(-300, Math.min(300, (target.x - target.px) * 60));
          scene.debug('setPlayer', { x: target.x + drift * travelSeconds, y: target.y + 100 });
        }
        scene.update(0, 1000 / 60);
        maxHostile = Math.max(maxHostile, scene.bullets.filter(bullet => bullet.hostile).length);
        maxFriendly = Math.max(maxFriendly, scene.bullets.filter(bullet => !bullet.hostile).length);
        maxEnemies = Math.max(maxEnemies, scene.enemies.length);
        maxEffects = Math.max(maxEffects, scene.effects.length);
        maxPower = Math.max(maxPower, scene.multishot);
        for (const enemy of scene.enemies) {
          bossPhase = Math.max(bossPhase, enemy.bossPhase);
          if (enemy.kind === 'debris' && enemy.returns > 0 && !seenReturning.has(enemy)) {
            seenReturning.add(enemy);
            returnedAsteroids++;
          }
        }
      }
      const state = scene.getDebugState();
      return {
        expectedLevel, level: state.level, completed: snapshot().screen === 'complete' && state.mode === 'ended',
        seconds: Math.round(state.elapsed * 10) / 10, hp: state.hp, kills: state.kills, score: state.score,
        totalWaves: state.totalWaves, asteroidWaves: initial.asteroidWaves, returnedAsteroids,
        weaponPower: maxPower, bossPhase, maxHostile, maxFriendly, maxEnemies, maxEffects,
        nextCheckpoint: snapshot().save.checkpoint?.level, limits: state.limits,
        ...(state.mode !== 'ended' ? { remaining: state.enemies.map(enemy => ({ kind: enemy.kind, boss: enemy.boss, hp: enemy.hp, x: enemy.x, y: enemy.y, returns: enemy.returns })), wave: state.wave } : {}),
      };
    }, level);
    results.push(result);
    console.log(JSON.stringify(result));
    assert.equal(result.level, level, 'Requested level loads without wrapping');
    assert.equal(result.completed, true, `Level ${level} must clear through actual projectile damage within 900 simulated seconds`);
    assert.equal(result.nextCheckpoint, level + 1, 'Completion secures the next level');
    assert.ok(result.totalWaves >= 8 && result.totalWaves <= 10);
    assert.ok(result.asteroidWaves >= 0 && result.asteroidWaves <= 2);
    assert.ok(result.weaponPower >= 5 && result.weaponPower <= 7, 'Normal arrays follow the slower 5–7 upgrade schedule');
    assert.ok(result.maxFriendly <= result.limits.friendly && result.maxHostile <= result.limits.hostile && result.maxEnemies <= result.limits.enemies && result.maxEffects <= result.limits.effects, 'Entity budgets hold');
    assert.deepEqual(errors, [], 'No browser runtime errors');
  }
  passed = true;
} finally {
  await browser.close();
  const report = { browser: browserName, description, passed, requestedLevels: levels, wallSeconds: Math.round((Date.now() - started) / 100) / 10, results, errors };
  await mkdir('test-results', { recursive: true });
  await writeFile(`test-results/endless-audit-${browserName}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ browser: browserName, passed, audited: results.length, requested: levels.length, wallSeconds: report.wallSeconds, report: `test-results/endless-audit-${browserName}.json`, description }));
}
