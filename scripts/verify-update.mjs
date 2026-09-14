/**
 * Run after pnpm build: node scripts/verify-update.mjs
 * EPOCH_BROWSER=chrome or webkit limits the run; by default both engines run.
 *
 * Reproduces a returning player with a live tab controlled by the cache-first
 * worker from 11395ae. A small marker shell stands in for that release's UI;
 * the worker's install/activate/fetch behavior is preserved. The origin then
 * stages another old-style release to reproduce a waiting worker and stale
 * reload, then serves current dist without closing the tab or clearing storage.
 * This tests a discovered worker update, not how often browsers check updates.
 */
import assert from 'node:assert/strict';
import { chromium, webkit, devices, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const distRoot = fileURLToPath(new URL('../dist/', import.meta.url)).replace(/\/$/, '');
const legacyCache = 'epoch-update-regression-legacy';
const waitingCache = 'epoch-update-regression-waiting';
const saveKey = 'epoch.browser.save.v1';
const savedProgress = JSON.stringify({
  version: 1, bestScore: 24100, furthestSector: 4,
  checkpoint: { level: 3, score: 9876, hp: 2, shipId: 'strelka', loadout: { handling: 'agile', reactor: 'heavy' } },
  unlockedTransmissions: ['launch-orders', 'cold-start', 'voss-echo'],
  preferences: { music: false, sfx: false, reducedMotion: true },
  hangar: { selectedShip: 'strelka', parts: 7, loadouts: { strelka: { handling: 'agile', reactor: 'heavy' }, manta: { handling: 'balanced', reactor: 'balanced' } } },
});
const legacyHtml = '<!doctype html><html><head><meta charset="utf-8"><title>EPOCH legacy update fixture</title><script defer src="/legacy.js"></script></head><body><h1 id="legacy-shell">OLD EPOCH SHELL</h1></body></html>';
const legacyJs = `window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js'); });`;
// Faithful 11395ae worker fixture. Only the injected cache name / asset manifest
// differ; notably there is no skipWaiting, message handler, or navigation refresh.
const legacyWorker = `
const CACHE = '${legacyCache}';
const ASSETS = ['/', '/index.html', '/legacy.js'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('epoch-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); void caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
    return response;
  }).catch(() => event.request.mode === 'navigate' ? caches.match('/index.html') : Response.error())));
});`;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

async function serveVersions() {
  let release = 'legacy';
  let workerRequests = 0;
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (path === '/sw.js') workerRequests++;
      let data, contentType;
      if (release !== 'current') {
        if (path === '/' || path === '/index.html') { data = legacyHtml; contentType = mime['.html']; }
        else if (path === '/legacy.js') { data = legacyJs; contentType = mime['.js']; }
        else if (path === '/sw.js') { data = release === 'waiting' ? legacyWorker.replace(legacyCache, waitingCache) : legacyWorker; contentType = mime['.js']; }
        else { response.writeHead(404).end(); return; }
      } else {
        const file = resolve(distRoot, '.' + (path === '/' ? '/index.html' : path));
        if (!file.startsWith(distRoot + sep)) { response.writeHead(403).end(); return; }
        data = await readFile(file);
        contentType = mime[extname(file)] ?? 'application/octet-stream';
      }
      response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store', Vary: 'Origin' });
      response.end(data);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    stageWaitingRelease() { release = 'waiting'; },
    deploy() { release = 'current'; },
    workerRequests: () => workerRequests,
    async stop() {
      const closed = new Promise(resolve => server.close(resolve));
      server.closeAllConnections();
      await closed;
    },
  };
}

const currentWorker = await readFile(resolve(distRoot, 'sw.js'), 'utf8');
const expectedCache = currentWorker.match(/const CACHE = ['"]([^'"]+)['"]/)?.[1];
assert.ok(expectedCache?.startsWith('epoch-'), 'Build dist before running the update regression');
const engines = process.env.EPOCH_BROWSER ? [process.env.EPOCH_BROWSER] : ['chrome', 'webkit'];
assert.ok(engines.every(engine => ['chrome', 'webkit'].includes(engine)), 'EPOCH_BROWSER must be chrome or webkit');
let failures = 0;
for (const engine of engines) {
  const origin = await serveVersions();
  let browser;
  try {
    browser = await (engine === 'chrome' ? chromium.launch({ channel: 'chrome' }) : webkit.launch());
    const context = await browser.newContext(engine === 'webkit' ? devices['iPhone 13'] : { viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin.url);
    await page.locator('#legacy-shell').waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.evaluate(({ saveKey, savedProgress }) => localStorage.setItem(saveKey, savedProgress), { saveKey, savedProgress });
    // A second load proves that the legacy worker owns navigation, not merely
    // that an old document happened to remain open after installation.
    await page.reload();
    await page.locator('#legacy-shell').waitFor();
    assert.equal(await page.evaluate(async name => !!await (await caches.open(name)).match('/'), legacyCache), true);

    // Reproduce the original failure before testing recovery: a different
    // cache-first release installs, but an ordinary reload cannot activate it
    // while this old client remains alive.
    origin.stageWaitingRelease();
    await page.evaluate(() => { void navigator.serviceWorker.getRegistration().then(registration => registration.update()); });
    await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting), { timeout: 20_000 }).toBe(true);
    await page.reload();
    await page.locator('#legacy-shell').waitFor();
    assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting), true, 'Ordinary reload reproduces the old release stuck waiting');

    const workerRequestsBefore = origin.workerRequests();
    origin.deploy();
    // Trigger the browser's real update algorithm while the old client is alive.
    // Never post a skip-waiting message or unregister/clear caches from the test:
    // only the release itself can recover users of the old worker.
    await page.evaluate(() => { void navigator.serviceWorker.getRegistration().then(registration => registration.update()); });
    await expect.poll(() => page.evaluate(async expectedCache => {
      const registration = await navigator.serviceWorker.getRegistration();
      return !!navigator.serviceWorker.controller && registration?.active?.state === 'activated' &&
        !registration.installing && !registration.waiting && (await caches.keys()).includes(expectedCache);
    }, expectedCache), { timeout: 20_000, message: 'New worker should activate while its legacy client remains open' }).toBe(true);
    const updateState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return { active: registration?.active?.state, installing: registration?.installing?.state, waiting: registration?.waiting?.state, caches: await caches.keys() };
    });
    assert.ok(origin.workerRequests() > workerRequestsBefore, `Browser must discover the new worker from the network (before ${workerRequestsBefore}, after ${origin.workerRequests()}, ${JSON.stringify(updateState)})`);
    assert.ok(!updateState.caches.includes(legacyCache) && !updateState.caches.includes(waitingCache), 'Activation retires both stale release caches');
    const autoRefreshed = await page.locator('#legacy-shell').count() === 0;
    assert.equal(autoRefreshed, false, 'Worker activation must not force a running game to reload');
    // This ordinary reload must be enough even if the old shell has no new
    // controllerchange listener. The tab remains open throughout the update.
    await page.reload();
    await page.locator('[data-action="launch"]:not(:disabled)').waitFor({ timeout: 20_000 });
    assert.equal(await page.locator('#legacy-shell').count(), 0, 'Old marker shell must be replaced');
    assert.equal(await page.evaluate(() => typeof window.__EPOCH__), 'undefined', 'Update must load production, not a development shell');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), saveKey), savedProgress, 'Worker update must not reset or rewrite saved progress');
    assert.match(await page.locator('[data-action="continue"]').innerText(), /LEVEL 03/, 'Saved level boundary survives the update');
    await page.locator('[data-action="hangar"]').click();
    assert.equal(await page.locator('.ship-card').count(), 2, 'Updated hangar contains both airframes');
    assert.equal((await page.locator('.ship-stats > div').first().innerText()).trim(), 'HULL\n3', 'Updated hull rules load after the worker transition');
    await page.locator('[data-ship="manta"]').click();
    assert.equal(await page.locator('[aria-label="Manta parts collected"]').getAttribute('aria-valuenow'), '7', 'Collected ship parts survive the update');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), saveKey), savedProgress, 'Inspecting locked Manta preserves the existing save');
    await page.getByRole('button', { name: 'Close ship hangar' }).click();
    await page.locator('[data-action="settings"]').click();
    const guides = page.getByRole('switch', { name: 'Training Wheels', exact: false });
    await expect(guides).not.toBeChecked();
    await guides.check();
    const migrated = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
    const previous = JSON.parse(savedProgress);
    assert.deepEqual(migrated.preferences, { ...previous.preferences, trainingWheels: true });
    assert.deepEqual(migrated.checkpoint, previous.checkpoint);
    assert.deepEqual(migrated.hangar, previous.hangar);
    assert.equal(migrated.bestScore, previous.bestScore);
    assert.equal(migrated.furthestLevel, previous.furthestSector);
    await page.reload();
    await page.locator('[data-action="settings"]').click();
    await expect(page.getByRole('switch', { name: 'Training Wheels', exact: false })).toBeChecked();
    assert.deepEqual(errors, [], 'No runtime errors during the old-to-new worker transition');
    const cacheNames = await page.evaluate(() => caches.keys());
    assert.deepEqual(cacheNames, [expectedCache], 'Only the current release cache remains after migration');
    console.log(JSON.stringify({ engine, reproducedWaitingWorker: true, updatedWhileOldTabOpen: true, autoRefreshed, ordinaryReloadFresh: true, savedProgressPreserved: true, trainingWheelsDefaultsOff: true, trainingWheelsOptInPersists: true, cacheNames }));
  } catch (error) {
    failures++;
    console.error(JSON.stringify({ engine, updateRegressionFailed: error.message }));
  } finally {
    await browser?.close();
    await origin.stop();
  }
}
if (failures) process.exitCode = 1;
