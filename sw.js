/* sw.js — Evertale Optimizer supercharge cache */
const CACHE_VERSION = 'evertale-supercharge-v1';
const CORE_CACHE = `${CACHE_VERSION}-core`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './element-watermark.css',
  './seasonal-theme.js',
  './site-menu.js',
  './image-cache-reset.js',
  './live-data-config.js',
  './data-loader.js',
  './leader-skill-resolver.js',
  './duo-source-collapse.js',
  './catalog.js',
  './catalog-sort.js',
  './duo-sort-bypass.js',
  './catalog-state-restore.js',
  './catalog-ui-align.js'
];

const DATA_ASSETS = [
  './apkfiles/entries/bundles/catalog.bundle.json',
  './apkfiles/entries/bundles/characters.bundle.json',
  './apkfiles/entries/bundles/weapons.bundle.json',
  './apkfiles/entries/bundles/accessories.bundle.json',
  './apkfiles/entries/bundles/bosses.bundle.json',
  './apkfiles/entries/bundles/character_families.bundle.json',
  './apkfiles/entries/maps/character_image_map.json',
  './apkfiles/entries/maps/explorer_character_order.json',
  './apkfiles/entries/localization/localizable_groups.json',
  './apkfiles/entries/localization/leader_skill_localization.json'
];

function cleanUrl(request){
  const url = new URL(request.url);
  url.search = '';
  return url.toString();
}

function sameOrigin(request){
  return new URL(request.url).origin === self.location.origin;
}

async function staleWhileRevalidate(request, cacheName){
  const cache = await caches.open(cacheName);
  const key = cleanUrl(request);
  const cached = await cache.match(key);
  const network = fetch(request).then(response => {
    if(response && response.ok) cache.put(key, response.clone());
    return response;
  }).catch(() => cached);
  return cached || network;
}

async function cacheFirst(request, cacheName){
  const cache = await caches.open(cacheName);
  const key = cleanUrl(request);
  const cached = await cache.match(key);
  if(cached) return cached;
  const response = await fetch(request);
  if(response && response.ok) cache.put(key, response.clone());
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const core = await caches.open(CORE_CACHE);
    await core.addAll(CORE_ASSETS.map(url => new Request(url, { cache: 'reload' })).catch ? [] : CORE_ASSETS);
  })().catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => !key.startsWith(CACHE_VERSION)).map(key => caches.delete(key)));
    await self.clients.claim();
    const data = await caches.open(DATA_CACHE);
    await Promise.allSettled(DATA_ASSETS.map(url => fetch(url, { cache: 'reload' }).then(r => r.ok && data.put(url, r))));
  })());
});

self.addEventListener('message', event => {
  if(event.data && event.data.type === 'WARM_DATA'){
    event.waitUntil((async () => {
      const data = await caches.open(DATA_CACHE);
      await Promise.allSettled(DATA_ASSETS.map(url => fetch(url, { cache: 'reload' }).then(r => r.ok && data.put(url, r))));
    })());
  }
  if(event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET') return;
  const url = new URL(request.url);

  if(url.hostname === 'ik.imagekit.io'){
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if(!sameOrigin(request)) return;

  if(url.pathname.includes('/apkfiles/entries/') && url.pathname.endsWith('.json')){
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  if(/\.(css|js|html)$/i.test(url.pathname) || url.pathname.endsWith('/')){
    event.respondWith(staleWhileRevalidate(request, CORE_CACHE));
  }
});
