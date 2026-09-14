// Verify the real service worker recovers from immutable HTTP-cached 404s.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, webkit, devices } from '@playwright/test';

const template = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
for (const engine of ['chrome', 'webkit']) {
  let published = false;
  const hits = { '/future.js': 0, '/late.js': 0 };
  const worker = template.replace("'__EPOCH_CACHE__'", JSON.stringify(`epoch-negative-cache-${engine}`))
    .replace('__EPOCH_ASSETS__', JSON.stringify(['/', '/index.html', '/future.js']));
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/sw.js') return response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }).end(worker);
    if (path in hits) {
      hits[path]++;
      return response.writeHead(published ? 200 : 404, { 'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=31536000, immutable' }).end(published ? '// published' : '// not yet uploaded');
    }
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }).end('<!doctype html><h1>Game shell</h1>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await (engine === 'chrome' ? chromium.launch({ channel: 'chrome' }) : webkit.launch());
    const context = await browser.newContext(engine === 'webkit' ? devices['iPhone 13'] : {});
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(() => localStorage.setItem('progress', 'preserve-me'));
    for (const path of Object.keys(hits)) {
      assert.equal(await page.evaluate(async path => (await fetch(path)).status, path), 404);
      assert.equal(await page.evaluate(async path => (await fetch(path)).status, path), 404);
      if (engine === 'chrome') assert.equal(hits[path], 1, 'Chrome must reproduce an HTTP-cached missing asset');
    }
    const before = { ...hits };
    published = true;
    await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 10000 });
    assert.equal(await page.evaluate(async () => (await fetch('/future.js')).text()), '// published', 'Precache installation replaces the stale HTTP failure');
    assert.equal(await page.evaluate(async () => (await fetch('/late.js')).text()), '// published', 'A static cache miss also bypasses stale HTTP failure');
    assert.equal(hits['/future.js'], before['/future.js'] + 1);
    assert.equal(hits['/late.js'], before['/late.js'] + 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('progress')), 'preserve-me');
    assert.deepEqual(await page.evaluate(async () => Promise.all(['/future.js', '/late.js'].map(async path => (await caches.match(path)).status))), [200, 200]);
    console.log(JSON.stringify({ engine, cached404Reproduced: before['/future.js'] === 1, precacheRecovery: true, staticMissRecovery: true, progressPreserved: true }));
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
