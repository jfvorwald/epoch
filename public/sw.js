// The production shell and assets are precached with a build-specific revision.
// Vite injects ASSETS/CACHE at build time (see vite.config.ts).
const CACHE = '__EPOCH_CACHE__';
const ASSETS = __EPOCH_ASSETS__;
self.addEventListener('install', event => {
  // A complete new offline shell can take over without waiting for every old tab
  // to close. Existing documents keep running until the player chooses to reload.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('epoch-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    // A refresh should load the deployed game. Cache-first HTML can otherwise
    // keep an old release alive indefinitely, even when HTTP says no-cache.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (!response.ok) throw new Error('Game shell unavailable');
        // Keep the precached fallback paired with its complete asset set; the
        // next worker replaces it only after its own installation succeeds.
        return response;
      } catch {
        return await cache.match('/index.html', { ignoreVary: true }) || Response.error();
      }
    })());
    return;
  }
  // Static assets are identical for every same-origin client. Vite adds Vary: Origin;
  // ignore it so module/CORS requests match resources precached without that header.
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request, { ignoreVary: true });
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch { return Response.error(); }
  }));
});
