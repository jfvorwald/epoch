// The production shell and assets are precached with a build-specific revision.
// Vite injects ASSETS/CACHE at build time (see vite.config.ts).
const CACHE = '__EPOCH_CACHE__';
const ASSETS = __EPOCH_ASSETS__;
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('epoch-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Static assets are identical for every same-origin client. Vite adds Vary: Origin;
  // ignore it so module/CORS requests match resources precached without that header.
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); void caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
    return response;
  }).catch(() => event.request.mode === 'navigate' ? caches.match('/index.html') : Response.error())));
});
