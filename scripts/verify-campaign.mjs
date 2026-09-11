/**
 * Accelerated browser simulation of all five authored sectors.
 * Start Vite first. Run: node scripts/verify-campaign.mjs
 * EPOCH_BASE_URL defaults to http://127.0.0.1:5173.
 * EPOCH_BROWSER=webkit selects installed Playwright WebKit; default is local Chrome.
 *
 * This is assisted simulation: an automated pilot reads entity coordinates and
 * moves at <=309 logical pixels/second. It uses real firing, collisions, pickups,
 * timers, damage, boss phases, and menu transitions. It never changes health,
 * enemy health, score, schedules, or outcomes. It is not a physical iPhone test.
 */
import assert from 'node:assert/strict';
import { chromium, webkit } from '@playwright/test';

const browserName = process.env.EPOCH_BROWSER ?? 'chrome';
const browser = await (browserName === 'webkit' ? webkit.launch() : chromium.launch({ channel: 'chrome', headless: true }));
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.EPOCH_BASE_URL ?? 'http://127.0.0.1:5173/');
  await page.locator('[data-action="launch"]:not(:disabled)').waitFor();
  await page.locator('[data-action="launch"]').click();
  const run = await page.evaluate(() => {
    const { scene, game, snapshot } = window.__EPOCH__;
    // Drive the actual Scene update with a fixed dt, independent of rendering.
    game.loop.stop();
    const sectors = [];
    for (let sector = 1; sector <= 5; sector++) {
      let maxHostile = 0, maxFriendly = 0, maxEffects = 0, bossPhase = 0;
      let state;
      for (let tick = 0; tick < 4500; tick++) {
        state = scene.getDebugState();
        if (state.mode !== 'combat') break;
        const p = state.player;
        const targets = state.enemies.filter(enemy => enemy.y > 0 && enemy.y < 540).sort((a, b) => (b.boss ? 1000 : b.y) - (a.boss ? 1000 : a.y));
        let desired = targets[0]?.x ?? 240;
        // Predict nearby red projectiles crossing the pilot's altitude.
        for (const bullet of scene.bullets) {
          if (!bullet.hostile || bullet.vy <= 0) continue;
          const time = (p.y - bullet.y) / bullet.vy;
          if (time < 0 || time > 0.7) continue;
          const predicted = bullet.x + bullet.vx * time;
          const diff = p.x - predicted;
          if (Math.abs(diff) < 52) desired = p.x + (diff > 0 ? 1 : -1) * 95;
        }
        for (const enemy of state.enemies) {
          if (enemy.y > 490 && Math.abs(enemy.x - p.x) < 70) desired = p.x + (p.x > enemy.x ? 1 : -1) * 110;
          bossPhase = Math.max(bossPhase, enemy.phase);
        }
        scene.debug('setPlayer', { x: p.x + Math.max(-10.3, Math.min(10.3, desired - p.x)), y: 654 });
        scene.update(0, 1000 / 60);
        scene.update(0, 1000 / 60);
        state = scene.getDebugState();
        maxHostile = Math.max(maxHostile, state.bullets.hostile);
        maxFriendly = Math.max(maxFriendly, state.bullets.friendly);
        maxEffects = Math.max(maxEffects, state.effects);
      }
      sectors.push({ sector, seconds: Math.round(state.elapsed * 10) / 10, hp: state.hp, kills: state.kills, score: state.score, screen: snapshot().screen, maxHostile, maxFriendly, maxEffects, bossPhase });
      if (snapshot().screen !== 'complete') break;
      document.querySelector('[data-action="advance"]').click();
      if (snapshot().screen === 'transmission') document.querySelector('[data-action="transmission-next"]').click();
    }
    return { sectors, screen: snapshot().screen, save: snapshot().save };
  });
  assert.equal(run.sectors.length, 5, 'The automated pilot must reach all five sectors');
  assert.ok(run.sectors.every(sector => sector.screen === 'complete'), 'All sectors complete through normal wave resolution');
  assert.equal(run.sectors.at(-1).bossPhase, 3, 'Boss takes real damage through all three phases');
  assert.ok(run.sectors.every(sector => sector.maxFriendly <= 100 && sector.maxHostile <= 150 && sector.maxEffects <= 100), 'Simulation stays within entity budgets');
  assert.equal(run.screen, 'victory', 'The normal transmission and next-sector buttons reach victory');
  assert.equal(run.save.furthestSector, 5);
  assert.equal(run.save.checkpoint, null);
  assert.ok(run.save.unlockedTransmissions.includes('open-channel'));
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log(JSON.stringify({ browser: browserName, validation: 'assisted accelerated simulation; no health or outcome overrides', ...run, errors }, null, 2));
} finally {
  await browser.close();
}
