/* sw.js — disabled cache worker. Clears old supercharge caches and unregisters itself. */
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('evertale-supercharge')).map(key => caches.delete(key)));
    await self.clients.claim();
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for(const client of clients){
      client.postMessage({ type: 'EVERTALE_SW_DISABLED' });
    }
  })());
});

self.addEventListener('fetch', event => {
  return;
});
