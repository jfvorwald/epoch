// Exercise the real service-worker template against two local origins: a game
// and an Access-like login page. Only the cache name and precached shell differ.
// No real accounts, browser profiles, or remote services are used.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium, webkit, devices } from '@playwright/test';

const workerTemplate = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const manifestLink = html.match(/<link\b[^>]*rel="manifest"[^>]*>/)?.[0];
assert.match(manifestLink ?? '', /crossorigin="use-credentials"/, 'Protected manifests must include session credentials');

async function listen(handler) {
  const server = createServer(handler);
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
  let state = 'signed-in';
  let shell = 'CACHED GAME';
  let sessionReads = 0;
  let callbacks = 0;
  let origin;
  const login = await listen((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    response.end(`<h1 id="login">Sign in</h1><a id="authorize" href="${origin.url}cdn-cgi/access/callback">Continue</a>`);
  });
  const worker = workerTemplate.replace("'__EPOCH_CACHE__'", JSON.stringify(`epoch-access-regression-${engine}`))
    .replace('__EPOCH_ASSETS__', JSON.stringify(['/', '/index.html']));
  origin = await listen((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const headers = { 'Cache-Control': 'no-store' };
    if (path === '/sw.js') {
      response.writeHead(200, { ...headers, 'Content-Type': 'text/javascript' }).end(worker);
    } else if (path === '/cdn-cgi/access/callback') {
      callbacks++;
      state = 'signed-in';
      response.writeHead(302, { ...headers, Location: '/' }).end();
    } else if (path === '/cdn-cgi/access/check') {
      response.writeHead(200, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify({ read: ++sessionReads }));
    } else if (path === '/manifest.webmanifest') {
      const authorized = request.headers.cookie?.includes('manifest_session=active');
      response.writeHead(authorized ? 200 : 403, { ...headers, 'Content-Type': 'application/manifest+json' });
      response.end(JSON.stringify(authorized ? { name: 'EPOCH authenticated manifest', start_url: '/', display: 'standalone' } : { error: 'Missing credentials' }));
    } else if (state === 'expired') {
      response.writeHead(302, { ...headers, Location: login.url }).end();
    } else if (state.startsWith('denied-')) {
      const status = Number(state.slice(7));
      response.writeHead(status, { ...headers, 'Content-Type': 'text/html' }).end(`<h1 id="denied">Access denied ${status}</h1>`);
    } else {
      response.writeHead(200, { ...headers, 'Content-Type': 'text/html', 'Set-Cookie': 'manifest_session=active; Path=/; SameSite=Lax; HttpOnly' });
      response.end(`<!doctype html><html><head>${manifestLink}</head><body><h1 id="game">${shell}</h1><script>navigator.serviceWorker.register('/sw.js');</script></body></html>`);
    }
  });
  let browser;
  try {
    browser = await (engine === 'chrome' ? chromium.launch({ channel: 'chrome' }) : webkit.launch());
    const context = await browser.newContext(engine === 'webkit' ? devices['iPhone 13'] : {});
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    await page.goto(origin.url);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.evaluate(() => localStorage.setItem('epoch.browser.save.v1', 'progress-must-survive-sign-in'));
    if (engine === 'chrome') {
      const session = await context.newCDPSession(page);
      const manifest = await session.send('Page.getAppManifest');
      assert.equal(manifest.data && JSON.parse(manifest.data).name, 'EPOCH authenticated manifest', 'Browser manifest request includes its session cookie');
      await session.detach();
    }

    // A redirect has status 0 and ok=false when surfaced to a service worker.
    // It must reach the browser instead of being mistaken for offline failure.
    shell = 'CURRENT GAME';
    state = 'expired';
    await page.reload();
    assert.equal(page.url(), login.url, 'Expired Access session reaches the cross-origin login page');
    await page.locator('#login').waitFor();
    await page.locator('#authorize').click();
    await page.locator('#game').waitFor();
    assert.equal(page.url(), origin.url, 'Access callback returns to the game');
    assert.equal(await page.locator('#game').innerText(), 'CURRENT GAME', 'Completed sign-in loads online HTML rather than the cached shell');
    assert.equal(callbacks, 1, 'Authentication callback reaches the origin exactly once');

    const reads = await page.evaluate(async () => [
      await (await fetch('/cdn-cgi/access/check')).json(),
      await (await fetch('/cdn-cgi/access/check')).json(),
    ]);
    assert.deepEqual(reads, [{ read: 1 }, { read: 2 }], 'Access session endpoints always reach the network');
    const cachedAuth = await page.evaluate(async () => {
      const entries = await Promise.all((await caches.keys()).map(async key => (await caches.open(key)).keys()));
      return entries.flat().map(entry => new URL(entry.url).pathname).filter(path => path.startsWith('/cdn-cgi/'));
    });
    assert.deepEqual(cachedAuth, [], 'Access callbacks and session responses never enter CacheStorage');
    for (const status of [401, 403]) {
      state = `denied-${status}`;
      const response = await page.goto(origin.url);
      assert.equal(response.status(), status);
      assert.equal(await page.locator('#denied').innerText(), `Access denied ${status}`, 'Explicit authentication denial is not replaced by the offline game');
    }
    state = 'signed-in';
    await page.goto(origin.url);
    await page.locator('#game').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('epoch.browser.save.v1')), 'progress-must-survive-sign-in');

    await origin.stop();
    await page.reload();
    assert.equal(await page.locator('#game').innerText(), 'CACHED GAME', 'A stopped origin still loads its complete precached offline shell');
    const offlineAuthRejected = await page.evaluate(async () => {
      try { await fetch('/cdn-cgi/access/check'); return false; } catch { return true; }
    });
    assert.equal(offlineAuthRejected, true, 'Offline Access session fetches fail instead of returning a cached response');
    assert.equal(await page.evaluate(() => localStorage.getItem('epoch.browser.save.v1')), 'progress-must-survive-sign-in');
    console.log(JSON.stringify({ engine, expiredSignInRedirect: true, callbackNetworkOnly: true, authDenialsPreserved: true, savedProgressPreserved: true, offlineShell: true, manifestCredentials: engine === 'chrome' ? 'native browser request verified' : 'shared HTML verified' }));
  } finally {
    await browser?.close();
    await origin.stop();
    await login.stop();
  }
}
