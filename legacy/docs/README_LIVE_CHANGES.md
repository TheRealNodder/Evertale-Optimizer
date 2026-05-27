# Evertale Optimizer — Live APK Data Build

This package was cleaned up to run the website from the APK-derived `apkfiles/entries` data pipeline instead of the old hybrid `/data` fallback.

## What changed

- Added `live-data-config.js` as the central live runtime data configuration.
- Updated `data-loader.js` to use `apkfiles/entries` as the source of truth.
- Removed the old automatic fallback to root `/data/*.json` files.
- Updated `catalog.js`, `app.js`, and `optimizer.js` so they no longer depend on root `/data`.
- Added `package.json` with simple static server and validation scripts.
- Added `tools/validate-live-data.js` to check required live data files and detect accidental `/data` references.
- Moved redundant legacy data into:
  - `legacy/data`
  - `legacy/legacy_unused`

## Live data source

The live site now expects these generated APK files:

```text
apkfiles/
  entries/
    bundles/
      catalog.bundle.json
      character_families.bundle.json
      weapons.bundle.json
      accessories.bundle.json
      bosses.bundle.json
    characters/families/index.json
    weapons/index.json
    accessories/index.json
    bosses/index.json
```

## Run locally

This is still a static site. Use a local server because browser `fetch()` calls will usually fail from `file://`.

```bash
npm install
npm run serve
```

Then open:

```text
http://localhost:4173/
```

## Validate live setup

```bash
npm run validate
```

The validator checks that the expected `apkfiles` live files exist, the root `/data` folder is gone, and the main runtime files do not reference `/data`.

## Notes for the original GPT/project owner

The old `/data` files were not deleted. They were moved under `legacy/data` so they can be compared or restored if needed.

The project is now closer to a true live APK-derived setup, but it still depends on the generated JSON files already existing inside `apkfiles/entries`. The browser should not parse raw APK files directly. Keep using the build/extraction scripts to generate normalized JSON bundles.

## Suggestions

1. Add a real build command that regenerates `apkfiles/entries/bundles/*.bundle.json` from the raw APK exports.
2. Add schema validation for characters, weapons, accessories, and bosses before deploy.
3. Add a small CI workflow that runs `npm run validate` on every push.
4. Keep `legacy/` out of production deploys once the live data path is fully verified.
5. Consider moving large raw APK dumps out of the web root and only deploying optimized bundles.
