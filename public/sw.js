const CACHE_VERSION = 'clawdify-v6';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// App shell files to pre-cache
const APP_SHELL = [
  '/',
  '/manifest.json',
];

// URLs that should never be cached (dynamic content)
const NO_CACHE_PATHS = [
  '/api/',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Never cache API calls or manifest — must always be fresh
  if (NO_CACHE_PATHS.some(p => url.pathname.startsWith(p))) return;

  // Stale-while-revalidate for static assets
  // But skip instance icons (they're dynamic)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(woff2?|ttf|eot)$/)
  ) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Network-first for everything else (HTML, images, etc.)
  e.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
