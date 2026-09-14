/**
 * Accelerated browser simulation of the opening five authored levels.
 * Start Vite first. Run: node scripts/verify-campaign.mjs
 * EPOCH_BASE_URL defaults to http://127.0.0.1:5173.
 * EPOCH_BROWSER=webkit selects installed Playwright WebKit; default is local Chrome.
 *
 * This is assisted simulation: an automated pilot reads entity coordinates and
 * selects armored/heavy tuning in the hangar and respects its movement speed.
 * It uses real firing, collisions, pickups,
 * timers, damage, boss phases, and menu transitions. It never changes health,
 * enemy health, score, schedules, or outcomes. It is not a physical iPhone test.
 * Victory assertions intentionally fail if the pilot loses; the three-hit
 * balance is harder than the earlier campaign this pilot could reliably clear.
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
  await page.locator('[data-action="hangar"]').click();
  await page.locator('input[name="handling"][value="armored"]').check();
  await page.locator('input[name="reactor"][value="heavy"]').check();
  await page.keyboard.press('Escape');
  await page.locator('[data-action="launch"]').click();
  const run = await page.evaluate(() => {
    const { scene, game, snapshot } = window.__EPOCH__;
    // Drive the actual Scene update with a fixed dt, independent of rendering.
    game.loop.stop();
    const levels = [];
    for (let level = 1; level <= 5; level++) {
      let maxHostile = 0, maxFriendly = 0, maxEffects = 0, bossPhase = 0;
      let state;
      for (let tick = 0; tick < 9000; tick++) {
        state = scene.getDebugState();
        if (state.mode === 'dying') {
          scene.update(0, 1000 / 60);
          scene.update(0, 1000 / 60);
          continue;
        }
        if (state.mode !== 'combat') break;
        const p = state.player;
        const speed = state.stats.speed;
        const targets = state.enemies.filter(enemy => enemy.y > 0 && enemy.y < 540).sort((a, b) => (b.boss ? 1000 : b.y) - (a.boss ? 1000 : a.y));
        const aimX = targets[0]?.x ?? 240;
        // Evaluate reachable paths against the whole incoming volley. A single-shot
        // sidestep cannot navigate the paired guardians and elite crossfire.
        const threats = [];
        for (const bullet of scene.bullets) {
          if (!bullet.hostile || bullet.vy <= 0) continue;
          const time = (p.y - bullet.y) / bullet.vy;
          if (time < -0.12 || time > 1.2) continue;
          threats.push({ time: Math.max(0, time), x: bullet.x + bullet.vx * time, radius: 25 });
        }
        for (const enemy of state.enemies) {
          bossPhase = Math.max(bossPhase, enemy.phase);
        }
        for (const enemy of scene.enemies) {
          if (enemy.y < 420 || enemy.boss || enemy.vy <= 0) continue;
          const time = (p.y - enemy.y) / enemy.vy;
          if (time < -0.1 || time > 1.2) continue;
          threats.push({ time: Math.max(0, time), x: enemy.x + enemy.vx * time, radius: enemy.radius + 23 });
        }
        let desired = p.x, bestCost = Infinity;
        for (const candidate of [p.x, aimX, ...Array.from({ length: 28 }, (_, i) => 28 + i * 424 / 27)]) {
          let cost = Math.abs(candidate - aimX) * 0.06 + Math.abs(candidate - p.x) * 0.01;
          for (const threat of threats) {
            const reachable = p.x + Math.max(-speed * threat.time, Math.min(speed * threat.time, candidate - p.x));
            const clearance = Math.abs(reachable - threat.x);
            cost += 600 * Math.exp(-((clearance / threat.radius) ** 2)) / (0.25 + threat.time);
          }
          if (cost < bestCost) { bestCost = cost; desired = candidate; }
        }
        scene.debug('setPlayer', { x: p.x + Math.max(-speed / 30, Math.min(speed / 30, desired - p.x)), y: 654 });
        scene.update(0, 1000 / 60);
        scene.update(0, 1000 / 60);
        state = scene.getDebugState();
        maxHostile = Math.max(maxHostile, state.bullets.hostile);
        maxFriendly = Math.max(maxFriendly, state.bullets.friendly);
        maxEffects = Math.max(maxEffects, state.effects);
      }
      levels.push({ level, seconds: Math.round(state.elapsed * 10) / 10, hp: state.hp, kills: state.kills, score: state.score, screen: snapshot().screen, maxHostile, maxFriendly, maxEffects, bossPhase });
      if (snapshot().screen !== 'complete') break;
      document.querySelector('[data-action="advance"]').click();
      if (snapshot().screen === 'transmission') document.querySelector('[data-action="transmission-next"]').click();
    }
    return { levels, screen: snapshot().screen, save: snapshot().save, limits: scene.getDebugState().limits };
  });
  assert.equal(run.levels.length, 5, `The automated pilot must reach all five levels: ${JSON.stringify(run.levels)}`);
  assert.ok(run.levels.every(level => level.screen === 'complete'), `All levels complete through normal wave resolution: ${JSON.stringify(run.levels)}`);
  assert.equal(run.levels.at(-1).bossPhase, 3, 'Boss takes real damage through all three phases');
  assert.ok(run.levels.every(level => level.maxFriendly <= run.limits.friendly && level.maxHostile <= run.limits.hostile && level.maxEffects <= run.limits.effects), 'Simulation stays within entity budgets');
  assert.equal(run.screen, 'playing', 'The opening chapter continues into level six');
  assert.equal(run.save.furthestLevel, 6);
  assert.equal(run.save.checkpoint.level, 6);
  assert.ok(run.save.unlockedTransmissions.includes('open-channel'));
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log(JSON.stringify({ browser: browserName, validation: 'assisted accelerated simulation; no health or outcome overrides', ...run, errors }, null, 2));
} finally {
  await browser.close();
}
