const CACHE_NAME = 'execution-flow-v12.1-recent-trades';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )),
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable().catch(() => {})
        : Promise.resolve()
    ]).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Fast app startup: serve the cached HTML immediately when available,
  // then refresh it quietly in the background. This avoids making every
  // iPhone Home Screen launch wait for the network.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html');

      const refresh = (async () => {
        try {
          const preload = event.preloadResponse ? await event.preloadResponse : null;
          const response = preload || await fetch(event.request);
          if (response && response.ok) {
            const copy = response.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put('./index.html', copy);
          }
          return response;
        } catch (_) {
          return null;
        }
      })();

      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }

      const fresh = await refresh;
      return fresh || caches.match('./index.html');
    })());
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});
