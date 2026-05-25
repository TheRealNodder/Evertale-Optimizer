/* live-data-config.js
   Central runtime paths for the live site.
   The live build intentionally reads generated APK-derived data from /apkfiles
   instead of the old /data fallback folder.
*/
(function () {
  const APK_BASE = './apkfiles';
  const ENTRY_BASE = `${APK_BASE}/entries`;

  window.EVERTALE_LIVE_CONFIG = Object.freeze({
    mode: 'live',
    apkBase: APK_BASE,
    entryBase: ENTRY_BASE,
    bundlesBase: `${ENTRY_BASE}/bundles`,
    mapsBase: `${ENTRY_BASE}/maps`,
    runtimeBase: `${ENTRY_BASE}/runtime`,
    legacyFallbackEnabled: false,
    cacheMode: 'force-cache',
    noStoreUrls: false,
  });
})();
