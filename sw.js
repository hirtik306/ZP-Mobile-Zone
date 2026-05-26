// ZP Mobile Zone - Service Worker v5.0
// Network First — always fresh code
const CACHE_NAME = 'zp-mobile-zone-v5';
const CDN_CACHE_NAME = 'zp-cdn-v2';

const CACHE_URLS = ['/', '/index.html'];

// Install
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v5...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS).catch(err => {
        console.log('[SW] Cache error (ok in dev):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean ALL old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v5...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== CDN_CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Skip Supabase & Render API — seedha network pe jao
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('onrender.com')) return;

  // CDN resources — cache first (fonts, libraries)
  if (url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CDN_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          return cached || new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // App files (index.html etc) — NETWORK FIRST, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
        }
        return response;
      })
      .catch(async () => {
        // Offline fallback
        const cached = await caches.match(event.request);
        return cached || new Response('App is offline.', { status: 503 });
      })
  );
});

// Messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_PAGE') {
    caches.open(CACHE_NAME).then(cache => {
      cache.add(event.data.url).catch(() => {});
    });
  }
});
