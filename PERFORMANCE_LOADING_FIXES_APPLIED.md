# Performance Loading Fixes Applied

Changed files:
- `live-data-config.js`
  - Switched generated data fetch cache mode from `no-cache` to `default`.
  - Keeps `dataVersion` URL cache-busting, so new data releases still invalidate old cached assets.

- `data-loader.js`
  - Loads `characters.bundle.json` directly before falling back to the giant catalog bundle.
  - This avoids unnecessary `catalog.bundle.json` downloads for character-only pages.

- `optimizer.js`
  - Calls `window.loadOptimizerRuntime({ skipHeavy: true })` during optimizer initialization.
  - Prevents initial optimizer page load from pulling heavy runtime chunks like ability graph/knowledge data.

- `optimizerRuntimeLoader.js`
  - Uses `dataVersion` from live config.
  - Adds an in-flight promise lock to prevent duplicate runtime fetches.
  - Tracks partial/heavy runtime state so light startup can happen first and full runtime can still load later if needed.
  - Skips already-loaded chunks.

- `sw.js`
  - Re-enabled a lightweight service worker cache for generated bundles/maps/runtime files.
  - Removes old supercharge caches and keeps a versioned v2 cache.
  - Warms critical lightweight data after page load.

- `supercharge.js`
  - No code change needed; it now registers the fixed `sw.js`.

Validation:
- `node --check` passed for all changed JavaScript files.
