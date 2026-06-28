/* live-data-config.js
   Central runtime paths for the live site.
   The live build intentionally reads generated APK-derived data from /apkfiles
   instead of the old /data fallback folder.
*/
(function () {
  const APK_BASE = './apkfiles';
  const ENTRY_BASE = `${APK_BASE}/entries`;

  // Master Control owns the generated base. Runtime code changes own the
  // revision. Keeping them separate prevents a data rebuild from silently
  // removing a loader/cache fix made between game-data releases.
  const DATA_VERSION_BASE = 'entries-1782519101-d5980e03a085';
  const RUNTIME_CACHE_REVISION = 'loader-v3-theme-v8';
  const DATA_VERSION = `${DATA_VERSION_BASE}-${RUNTIME_CACHE_REVISION}`;

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
    // Generated bundles already contain localized display and skill text.
    // Keep the 65MB global localization table as an explicit legacy fallback.
    useGlobalLocalization: false,
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
