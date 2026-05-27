/* optimizerRuntimeLoader.js
   Fast runtime chunk loader.
   - Uses the existing apkfiles/entries/runtime files.
   - Loads chunks in parallel instead of sequentially.
   - Avoids Date.now cache busting so GitHub Pages/browser cache can work.
   - Keeps the old window.loadOptimizerRuntime() API intact.
*/

(function(){
  'use strict';

  const VERSION = (window.EVERTALE_LIVE_CONFIG && window.EVERTALE_LIVE_CONFIG.version) || 'live';
  const BASE_PATH = './apkfiles/entries/runtime';

  window.OptimizerRuntime = window.OptimizerRuntime || {
    loaded: false,
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

  async function loadOptimizerRuntimeChunk(basePath, key, chunkInfo) {
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
    if (window.OptimizerRuntime.loaded) return window.OptimizerRuntime;

    const manifest = await fetchJson(`${BASE_PATH}/optimizer_runtime_manifest.json`);
    window.OptimizerRuntime.manifest = manifest;
    window.OptimizerRuntime.runtimeFlags = manifest.runtimeFlags || {};

    const chunks = Object.entries(manifest.chunks || {});
    const skipHeavy = options.skipHeavy === true;
    const heavy = new Set(['abilityGraph', 'optimizerKnowledge']);

    const selected = chunks.filter(([key]) => !(skipHeavy && heavy.has(key)));

    await Promise.all(selected.map(([key, info]) => loadOptimizerRuntimeChunk(BASE_PATH, key, info)));

    window.OptimizerRuntime.loaded = true;

    console.log('[OptimizerRuntime] loaded', {
      chunks: Object.keys(window.OptimizerRuntime.chunks),
      skippedHeavy: skipHeavy,
      errors: window.OptimizerRuntime.errors
    });

    return window.OptimizerRuntime;
  };

  window.loadOptimizerRuntimeChunk = loadOptimizerRuntimeChunk;
})();
