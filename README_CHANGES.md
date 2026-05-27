# README_CHANGES

Generated: 2026-05-27 04:52:01

## What changed

1. Cleaned the root folder.
   - Historical patch/readme checkpoint files were moved to `legacy/docs/`.
   - Root now keeps only files needed for GitHub Pages operation plus the current README.

2. Added `apkfiles/derived/`.
   - `evertale-runtime-scaling.json`
   - `character-seed-index.json`

3. Preserved raw data.
   - `apkfiles/entries/**` was left untouched.
   - `Monster.json`, `Weapon.json`, and `Equipment.json` were left untouched.

4. Improved load performance.
   - `optimizerRuntimeLoader.js` now loads runtime chunks in parallel.
   - Removed `Date.now()` cache busting from runtime chunk fetches.
   - Added stable site versioning through `live-data-config.js`.
   - `optimizerRuntimeBootstrap.js` skips known heavy chunks during first optimizer boot.

5. Added `runtime-data-bridge.js`.
   - Provides a stable way for pages to load derived runtime data.
   - Keeps raw + derived merge logic separate from raw files.

6. Patched `stat-test.html`.
   - It now loads `live-data-config.js` and `runtime-data-bridge.js`.

## Suggestions

- Keep `apkfiles/entries` immutable.
- Put all reverse-engineered calibration data under `apkfiles/derived`.
- Do not regenerate `stat-test.html` wholesale again. Patch only the engine block or loader block.
- If GitHub Pages cache ever sticks, update only `window.EVERTALE_LIVE_CONFIG.version`.
