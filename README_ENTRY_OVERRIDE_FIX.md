# Entry Override Visibility Fix

## Problem fixed

Some newly extracted content existed in `apkfiles/entries/**/entries`, but the live site was loading generated bundle/index data. If an index, map, or override file was stale, the raw entry could exist on disk but never reach the roster/catalog UI.

This was especially risky for:
- new duo/merged character families
- new weapon/accessory entries
- boss state variants
- entries added after the last bundle build

## Changes

### 1. `data-loader.js`
- Added cache-busting/versioned bundle/map URLs.
- Uses `bundleCacheMode` / `mapCacheMode` from `live-data-config.js`.
- Character image/family maps are now treated as hints instead of absolute overrides.
- Raw discovered character forms are merged back into runtime variants so stale overrides cannot hide new states.

### 2. `live-data-config.js`
- Added `dataVersion`.
- Changed bundle/map loading to `no-cache` so GitHub Pages/browser cache does not serve stale bundles.

### 3. `tools/new_structure/build_entry_bundles.py`
- Added auto-discovery fallback.
- Indexed entries still keep authority/order.
- Any unindexed raw JSON files are appended to generated bundles instead of being silently excluded.

### 4. Regenerated bundles
- `characters`: 733
- `weapons`: 824
- `accessories`: 105
- `bosses`: 405
- `characterFamilies`: 419

## Validation

Ran:

```bash
node tools/validate-live-data.js
```

Result: passed.

## Important note

The biggest count change is weapons: the old live bundle only carried 325 indexed weapon rows, while the raw folder contains 824 weapon JSON files. The patched bundle builder now includes those discovered raw weapon files too.
