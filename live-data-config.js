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
  const DATA_VERSION = 'entries-1782519101-d5980e03a085-jeanne-nonduo-v1';

  window.EVERTALE_LIVE_CONFIG = Object.freeze({
    mode: 'live',
    apkBase: APK_BASE,
    entryBase: ENTRY_BASE,
    bundlesBase: `${ENTRY_BASE}/bundles`,
    mapsBase: `${ENTRY_BASE}/maps`,
    runtimeBase: `${ENTRY_BASE}/runtime`,
    legacyFallbackEnabled: false,

    // Versioned URLs below invalidate stale content after data drops.
    // Let the browser/CDN cache JSON normally so repeat visits avoid
    // downloading and parsing multi-megabyte bundles on every page load.
    cacheMode: 'default',
    bundleCacheMode: 'default',
    mapCacheMode: 'default',
    dataVersion: DATA_VERSION,
    noStoreUrls: false,
  });

  // Load before catalog-v2-lite's async data hydrate normally reaches the duo registry.
  // This keeps state-only characters such as JeanneFusion out of duo/form-switch maps.
  if (!window.__EVERTALE_NON_DUO_SCRIPT_INJECTED && !document.querySelector('script[src*="catalog-non-duo-guard.js"]')) {
    window.__EVERTALE_NON_DUO_SCRIPT_INJECTED = true;
    const script = document.createElement('script');
    script.defer = true;
    script.src = `./catalog-non-duo-guard.js?v=${encodeURIComponent(DATA_VERSION)}`;
    document.head.appendChild(script);
  }
})();
