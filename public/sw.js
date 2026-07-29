// CopyZapp Service Worker v5 — PWA + Multi-Network
const CACHE_NAME = 'copyzapp-v5';
const SHELL_ASSETS = [
  '/',
  '/index.html',
];

// Network-info cache: short TTL (60s), so stale data doesn't linger
const NETWORK_INFO_CACHE = 'copyzapp-network-v1';
const NETWORK_INFO_TTL_MS = 60 * 1000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== NETWORK_INFO_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // /api/network-info — cache with short TTL
  if (url.pathname === '/api/network-info') {
    event.respondWith(
      caches.open(NETWORK_INFO_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) {
          const dateHeader = cached.headers.get('sw-cached-at');
          if (dateHeader && Date.now() - parseInt(dateHeader) < NETWORK_INFO_TTL_MS) {
            return cached;
          }
        }
        try {
          const fresh = await fetch(event.request);
          if (fresh.ok) {
            // Clone and tag with timestamp header
            const headers = new Headers(fresh.headers);
            headers.set('sw-cached-at', Date.now().toString());
            const tagged = new Response(await fresh.clone().text(), { headers, status: fresh.status });
            cache.put(event.request, tagged);
          }
          return fresh;
        } catch {
          return cached || new Response(JSON.stringify({ error: 'Offline' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })
    );
    return;
  }

  // All other /api/ calls — network-first, offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline mode active' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Static assets — cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});
