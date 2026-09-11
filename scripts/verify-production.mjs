import { chromium, webkit, devices } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run after building. Each browser uses an isolated loopback origin, which is
// actually stopped after the service worker precaches the production build.
// WebKit's Playwright setOffline(true) path can fail with an internal navigation
// error even when a stopped real origin reloads successfully through the worker.
// No physical iPhone or Home Screen installation is exercised by this script.
const distRoot = fileURLToPath(new URL('../dist/', import.meta.url)).replace(/\/$/, '');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

async function serveBuild() {
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = resolve(distRoot, '.' + (path === '/' ? '/index.html' : path));
      if (!file.startsWith(distRoot + sep)) { response.writeHead(403).end(); return; }
      const data = await readFile(file);
      // Disable the ordinary HTTP cache: the subsequent reload must use the SW.
      // Match Vite's Vary header to retain coverage of precache/module matching.
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'Vary': 'Origin' });
      response.end(data);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let stopped = false;
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    async stop() {
      if (stopped) return;
      stopped = true;
      const closed = new Promise(resolve => server.close(resolve));
      server.closeAllConnections();
      await closed;
    },
  };
}

for (const engine of ['chrome', 'webkit']) {
  const origin = await serveBuild();
  const browser = await (engine === 'chrome' ? chromium.launch({ channel: 'chrome' }) : webkit.launch());
  try {
    const context = await browser.newContext(engine === 'webkit' ? devices['iPhone 13'] : { viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin.url);
    await page.locator('[data-action="launch"]').waitFor();
    await page.waitForFunction(() => !!document.querySelector('[data-action="launch"]') && !document.querySelector('[data-action="launch"]').disabled);
    assert.equal(await page.title(), 'EPOCH — Jaq Studios');
    assert.equal(await page.evaluate(() => typeof window.__EPOCH__), 'undefined', 'DEV control must be absent in production');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const cacheCount = await page.evaluate(async () => { const key = (await caches.keys()).find(k => k.startsWith('epoch-')); return (await (await caches.open(key)).keys()).length; });
    assert.ok(cacheCount > 25, 'offline cache includes art, code, icons, and fonts');
    await origin.stop();
    await page.reload();
    await page.waitForFunction(() => !!document.querySelector('[data-action="launch"]') && !document.querySelector('[data-action="launch"]').disabled);
    await page.locator('[data-action="launch"]').click();
    await page.locator('#pause-control').waitFor({ state: 'visible' });
    await page.waitForTimeout(4000);
    assert.equal(await page.locator('#hud').isVisible(), true);
    const timing = await page.evaluate(() => new Promise(resolve => {
      const frames = []; let last = performance.now();
      function frame(now) { frames.push(now - last); last = now; if (frames.length < 120) requestAnimationFrame(frame); else { frames.shift(); frames.sort((a,b) => a-b); resolve({ medianMs: frames[Math.floor(frames.length / 2)], p95Ms: frames[Math.floor(frames.length * .95)] }); } }
      requestAnimationFrame(frame);
    }));
    await page.screenshot({ path: `/tmp/epoch-production-offline-${engine}.png` });
    assert.deepEqual(errors, [], 'no browser runtime errors');
    console.log(JSON.stringify({ engine, offlineLaunch: true, offlineMethod: 'origin server stopped; ordinary HTTP cache disabled', cachedAssets: cacheCount, frameTiming: timing, runtimeErrors: errors }));
  } finally { await browser.close(); await origin.stop(); }
}
