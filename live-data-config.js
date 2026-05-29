/* live-data-config.js
   Central runtime paths for the live site.
   The live build intentionally reads generated APK-derived data from /apkfiles
   instead of the old /data fallback folder.
*/
(function () {
  const APK_BASE = './apkfiles';
  const ENTRY_BASE = `${APK_BASE}/entries`;

  // Bump this whenever apkfiles/entries/bundles or maps are regenerated.
  // It prevents GitHub Pages/browser cache from serving stale bundles where
  // newly added entries exist on disk but never appear in the roster/catalog.
  const DATA_VERSION = '2026-05-29-entry-override-fix';

  window.EVERTALE_LIVE_CONFIG = Object.freeze({
    mode: 'live',
    apkBase: APK_BASE,
    entryBase: ENTRY_BASE,
    bundlesBase: `${ENTRY_BASE}/bundles`,
    mapsBase: `${ENTRY_BASE}/maps`,
    runtimeBase: `${ENTRY_BASE}/runtime`,
    legacyFallbackEnabled: false,

    // Bundles/indexes are small and must not go stale after content drops.
    // Heavy entry JSON/image assets can still be cached by the browser/CDN.
    cacheMode: 'no-cache',
    bundleCacheMode: 'no-cache',
    mapCacheMode: 'no-cache',
    dataVersion: DATA_VERSION,
    noStoreUrls: false,
  });
})();
