/* runtime-data-bridge.js
   Small helper for pages that need raw + derived runtime data without mutating apkfiles/entries.
*/
(function(){
  'use strict';

  const cfg = window.EVERTALE_LIVE_CONFIG || {};
  const derivedBase = cfg.derivedBase || './apkfiles/derived';
  const version = cfg.version || 'live';

  function v(url) {
    return version ? `${url}?v=${encodeURIComponent(version)}` : url;
  }

  async function getJson(url, fallback = null) {
    try {
      const res = await fetch(v(url), { cache: 'default' });
      if (!res.ok) return fallback;
      return await res.json();
    } catch (_) {
      return fallback;
    }
  }

  window.EvertaleRuntimeBridge = {
    async loadScaling() {
      return getJson(`${derivedBase}/evertale-runtime-scaling.json`, {});
    },
    async loadCharacterSeedIndex() {
      return getJson(`${derivedBase}/character-seed-index.json`, { characters: [] });
    },
    async loadAll() {
      const [scaling, seeds] = await Promise.all([
        this.loadScaling(),
        this.loadCharacterSeedIndex()
      ]);
      return { scaling, seeds };
    }
  };
})();
