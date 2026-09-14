/** Read-only visual review of the local development game; no persistent save writes. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/?playtest=1');
  await page.locator('[data-action="launch"]:not(:disabled)').waitFor();
  await page.locator('[data-action="launch"]').click();
  await mkdir('test-results/visual-review', { recursive: true });
  const levels = [1, 2, 3, 4, 5, 8, 21, 24, 30, 34, 50, 100];
  const sheets = await page.evaluate(levels => {
    const { scene, game } = window.__EPOCH__;
    game.loop.stop();
    const scenery = document.createElement('canvas');
    scenery.width = 4 * 240; scenery.height = 3 * 425;
    const fleet = document.createElement('canvas');
    fleet.width = 960; fleet.height = levels.length * 125;
    const bg = scenery.getContext('2d'), fg = fleet.getContext('2d');
    bg.fillStyle = fg.fillStyle = '#080a12'; bg.fillRect(0,0,scenery.width,scenery.height); fg.fillRect(0,0,fleet.width,fleet.height);
    levels.forEach((level, index) => {
      scene.startRun({ level, score: 0, hp: 3 });
      const state = scene.getDebugState();
      const x = index % 4 * 240, y = Math.floor(index / 4) * 425;
      bg.drawImage(scene.textures.get('level-environment').getSourceImage(), x, y + 25, 240, 400);
      bg.font = '12px monospace'; bg.fillStyle = '#ddd'; bg.fillText(`L${String(level).padStart(2,'0')} · ${state.appearance.environment}`, x + 8, y + 17);
      fg.font = '12px monospace'; fg.fillStyle = '#ddd'; fg.fillText(`LEVEL ${level} · ${state.appearance.fleet}`, 12, index * 125 + 17);
      Object.entries(state.appearance.textures).forEach(([kind,key], column) => {
        const asset = scene.textures.get(key).getSourceImage();
        const width = column < 4 ? 57 : 90, height = column < 4 ? 63 : 72;
        fg.drawImage(asset, 20 + column * 103, index * 125 + 28, width, height);
        fg.font = '9px monospace'; fg.fillStyle = '#999'; fg.fillText(kind, 20 + column * 103, index * 125 + 114);
      });
    });
    return { backgrounds: scenery.toDataURL('image/png'), fleets: fleet.toDataURL('image/png') };
  }, levels);
  for (const [name, data] of Object.entries(sheets)) await writeFile(`test-results/visual-review/${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
  for (const level of [1, 2, 3, 4, 5]) {
    await page.evaluate(level => {
      const { scene, game } = window.__EPOCH__;
      scene.startRun({ level, score: 0, hp: 3 });
      scene.nextFire = Infinity;
      scene.spawnWave(scene.level.waves[0], 0); scene.waveIndex = 1;
      for (let tick = 0; tick < 125; tick++) scene.updateEnemies(1/60);
      scene.pauseCombat(); scene.emitHud(); game.loop.start(game.step.bind(game));
    }, level);
    await page.locator('#hud').filter({ hasText: `LEVEL ${String(level).padStart(2, '0')}` }).waitFor();
    await page.screenshot({ path: `test-results/visual-review/level-${level}.png` });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ levels, screenshots: 'test-results/visual-review', errors }));
} finally { await browser.close(); }
