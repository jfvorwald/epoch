import { chromium, webkit, devices } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Exercise one built artifact on both deployment hostnames without publishing.
// This verifies the review UI and production-mode controls, not Cloudflare SSO.
const distRoot = fileURLToPath(new URL('../dist/', import.meta.url)).replace(/\/$/, '');
const build = JSON.parse(await readFile(resolve(distRoot, 'build.json'), 'utf8'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

for (const engine of ['chrome', 'webkit']) {
  const browser = await (engine === 'chrome' ? chromium.launch({ channel: 'chrome' }) : webkit.launch());
  try {
    const context = await browser.newContext({ ...(engine === 'webkit' ? devices['iPhone 13'] : { viewport: { width: 1440, height: 1000 } }), serviceWorkers: 'block' });
    await context.route('https://*.jaqstudios.com/**', async route => {
      const path = decodeURIComponent(new URL(route.request().url()).pathname);
      const file = resolve(distRoot, '.' + (path === '/' ? '/index.html' : path));
      if (!file.startsWith(distRoot + sep)) return route.fulfill({ status: 403 });
      try { await route.fulfill({ body: await readFile(file), contentType: mime[extname(file)] ?? 'application/octet-stream' }); }
      catch { await route.fulfill({ status: 404 }); }
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const hostname of ['epoch-staging.jaqstudios.com', 'epoch.jaqstudios.com']) {
      const staging = hostname.startsWith('epoch-staging.');
      await page.goto(`https://${hostname}/?playtest=1`);
      await page.waitForFunction(() => !!document.querySelector('[data-action="launch"]') && !document.querySelector('[data-action="launch"]').disabled);
      assert.equal(await page.locator('.staging-badge').count(), staging ? 1 : 0, 'Only staging has the review label');
      assert.equal(await page.locator('.playtest-badge').count(), 0, 'Staging and production both ignore DEV playtest mode');
      assert.equal(await page.evaluate(() => typeof window.__EPOCH__), 'undefined', 'No development controls');
      if (staging) {
        assert.equal(await page.locator('.staging-badge').textContent(), `STAGING · v${build.version} · ${build.id}`);
        assert.equal(await page.locator('.staging-badge').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
        const badge = await page.locator('.staging-badge').boundingBox();
        const menu = await page.locator('.menu-topline').boundingBox();
        assert.ok(badge.y + badge.height <= menu.y, 'Review label does not overlap menu text');
        await page.screenshot({ path: `/tmp/epoch-staging-${engine}.png` });
      }
      await page.locator('[data-action="hangar"]').click();
      await page.locator('[data-ship="manta"]').click();
      assert.equal(await page.locator('[aria-label="Manta parts collected"]').getAttribute('aria-valuenow'), '0');
      await page.getByRole('button', { name: 'Close ship hangar' }).click();
      await page.locator('[data-action="launch"]').click();
      await page.locator('#pause-control').waitFor({ state: 'visible' });
      if (staging) {
        const badge = await page.locator('.staging-badge').boundingBox();
        const pause = await page.locator('#pause-control').boundingBox();
        assert.ok(badge.y + badge.height <= pause.y, 'Review label does not overlap pause control');
      }
      await page.locator('#pause-control').click();
      await page.locator('[data-action="resume"]').waitFor({ state: 'visible' });
      await page.locator('[data-action="resume"]').click();
      await page.locator('#pause-control').waitFor({ state: 'visible' });
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ engine, sharedArtifact: build.id, stagingBadge: true, productionBadge: false, productionControls: true, launchPauseResume: true, runtimeErrors: errors }));
  } finally { await browser.close(); }
}
