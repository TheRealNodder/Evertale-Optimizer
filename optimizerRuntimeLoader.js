/* optimizerRuntimeLoader.js
   Fast runtime chunk loader.
   - Uses existing apkfiles/entries/runtime files.
   - Loads chunks in parallel.
   - Avoids Date.now cache busting so GitHub Pages/browser cache can work.
   - De-duplicates concurrent load calls so the same JSON is not fetched twice.
   - Keeps the old window.loadOptimizerRuntime() API intact.
*/

(function(){
  'use strict';

  const LIVE_CONFIG = window.EVERTALE_LIVE_CONFIG || {};
  const VERSION = LIVE_CONFIG.dataVersion || LIVE_CONFIG.version || 'live';
  const BASE_PATH = LIVE_CONFIG.runtimeBase || './apkfiles/entries/runtime';
  const HEAVY_CHUNKS = new Set(['abilityGraph', 'optimizerKnowledge']);
  const FAST_OPTIMIZER_CHUNKS = new Set(['weapons', 'accessories']);

  let manifestPromise = null;
  let runtimeLoadPromise = null;

  window.OptimizerRuntime = window.OptimizerRuntime || {
    loaded: false,
    loadedHeavy: false,
    manifest: null,
    chunks: {},
    runtimeFlags: {},
    errors: {}
  };

  function withVersion(url) {
    return VERSION ? `${url}?v=${encodeURIComponent(VERSION)}` : url;
  }

  async function fetchJson(url, optional = false) {
    const response = await fetch(withVersion(url), { cache: 'default' });
    if (!response.ok) {
      if (optional) return null;
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.json();
  }

  async function getManifest() {
    if (!manifestPromise) {
      manifestPromise = fetchJson(`${BASE_PATH}/optimizer_runtime_manifest.json`).then((manifest) => {
        window.OptimizerRuntime.manifest = manifest;
        window.OptimizerRuntime.runtimeFlags = manifest.runtimeFlags || {};
        return manifest;
      });
    }
    return manifestPromise;
  }

  async function loadOptimizerRuntimeChunk(basePath, key, chunkInfo) {
    if (Object.prototype.hasOwnProperty.call(window.OptimizerRuntime.chunks, key)) {
      return window.OptimizerRuntime.chunks[key];
    }

    const file = chunkInfo && chunkInfo.file;
    if (!file) return null;

    try {
      const payload = await fetchJson(`${basePath}/${file}`, true);
      window.OptimizerRuntime.chunks[key] = payload && Object.prototype.hasOwnProperty.call(payload, 'data')
        ? payload.data
        : payload;
      return window.OptimizerRuntime.chunks[key];
    } catch (err) {
      window.OptimizerRuntime.errors[key] = String(err && err.message ? err.message : err);
      console.warn('[OptimizerRuntime] optional chunk failed:', key, err);
      return null;
    }
  }

  window.loadOptimizerRuntime = async function loadOptimizerRuntime(options = {}) {
    const skipHeavy = options.skipHeavy === true;

    if (window.OptimizerRuntime.loaded && (skipHeavy || window.OptimizerRuntime.loadedHeavy)) {
      return window.OptimizerRuntime;
    }

    if (runtimeLoadPromise) {
      await runtimeLoadPromise;
      if (window.OptimizerRuntime.loaded && (skipHeavy || window.OptimizerRuntime.loadedHeavy)) {
        return window.OptimizerRuntime;
      }
    }

    runtimeLoadPromise = (async () => {
      const manifest = await getManifest();
      const chunks = Object.entries(manifest.chunks || {});
      const selected = skipHeavy
        ? chunks.filter(([key]) => FAST_OPTIMIZER_CHUNKS.has(key))
        : chunks.filter(([key]) => !HEAVY_CHUNKS.has(key));

      await Promise.all(selected.map(([key, info]) => loadOptimizerRuntimeChunk(BASE_PATH, key, info)));

      window.OptimizerRuntime.loaded = true;
      if (!skipHeavy) window.OptimizerRuntime.loadedHeavy = true;

      console.log('[OptimizerRuntime] loaded', {
        chunks: Object.keys(window.OptimizerRuntime.chunks),
        skippedHeavy: skipHeavy,
        fastChunksOnly: skipHeavy,
        loadedHeavy: window.OptimizerRuntime.loadedHeavy,
        errors: window.OptimizerRuntime.errors
      });

      return window.OptimizerRuntime;
    })();

    try {
      return await runtimeLoadPromise;
    } finally {
      runtimeLoadPromise = null;
    }
  };

  window.loadOptimizerRuntimeChunk = loadOptimizerRuntimeChunk;
})();