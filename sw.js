/* sw.js — lightweight cache worker for generated Evertale data.
   Caches versioned bundles/maps/runtime files so repeat visits do not
   re-download multi-megabyte JSON. Network is still used for fresh versions
   because live-data-config.js appends dataVersion to data URLs.
*/
const CACHE_NAME = 'evertale-supercharge-v2';
const DATA_RE = /\/apkfiles\/entries\/(bundles|maps|runtime)\//;
const WARM_URLS = [
  './apkfiles/entries/bundles/character_families.bundle.json',
  './apkfiles/entries/maps/character_order_map.json',
  './apkfiles/entries/maps/character_image_map.json',
  './apkfiles/entries/runtime/optimizer_runtime_manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith('evertale-supercharge') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function warmData() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(
    WARM_URLS.map(url => cache.add(new Request(url, { cache: 'default' })))
  );
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'WARM_DATA') event.waitUntil(warmData());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin && DATA_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
