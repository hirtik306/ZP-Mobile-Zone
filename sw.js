// ZP Mobile Zone - Service Worker v4.0
// Force refresh — clears all old caches

const CACHE_NAME = 'zp-mobile-zone-v4';
const OFFLINE_QUEUE_KEY = 'zp_offline_queue';

// Files to cache for offline use
const CACHE_URLS = [
  '/',
  '/index.html'
];

// External CDN resources to cache
const CDN_CACHE_NAME = 'zp-cdn-v1';

// Install: cache app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(CACHE_URLS).catch(err => {
        console.log('[SW] Cache error (ok in dev):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== CDN_CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: serve from cache, fallback to network, cache CDN resources
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests and Supabase API calls (those go to offline queue)
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  
  // For CDN resources (Google Fonts, ZXing, Supabase JS)
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
  
  // For app files: cache first, then network
  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return cached || new Response('App is offline. Please open the cached version.', { status: 503 });
      }
    })
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_PAGE') {
    caches.open(CACHE_NAME).then(cache => {
      cache.add(event.data.url).catch(() => {});
    });
  }
});
