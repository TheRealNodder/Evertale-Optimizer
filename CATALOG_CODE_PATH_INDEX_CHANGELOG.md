# Catalog Code Path Index Changelog

This companion log records small ownership/version updates that need to be reflected in `CATALOG_CODE_PATH_INDEX.md` when the main index is next recompiled.

## 2026-06-19 - Full site audit cleanup and awaken state repair

Routing/ownership update:

- Added `catalog-character-state-repair.js?v=1` to the Catalog load order after `data-loader.js` and before `catalog-v2-lite.js`.
- Bumped `catalog-v2-lite.js` to `v=25`; card state buttons now expose explicit labels and `aria-pressed` state.
- Bumped `test-catalog-v2-source-badge-authority.js` to `v=3`; it reads `data-state-rows` instead of old `data-imgs`, so SSR and SR cards keep their real state button counts.
- Bumped `catalog-click-fast-authority.js` to `v=36`; desktop sidebar state clicks now call `EvertaleCatalogV2.applyState()` and card-grid state clicks now refresh the sidebar through `v2:hero-state-change`.
- Bumped `test-catalog-v2-desktop-structure.js` to `v=8`; removed the synthetic-click fallback path and made sidebar awaken tabs follow the selected card's real state count.
- Bumped mobile popup guards to `test-catalog-v2-detail-fix.js?v=2` and `test-catalog-v2-mobile-detail-badge-tabs.js?v=3`; popup state changes use the renderer API/state rows.
- Bumped `test-catalog-v2-leader-detail-fix.js` to `v=3`; it now targets the current `.v2-detail-scroll-panel` as well as the old retired sidebar panel id.

Pruning update:

- Removed these redundant or duplicate Catalog scripts from `index.html`: `test-catalog-v2-final-awaken-controller.js`, `test-catalog-v2.js`, `test-catalog-v2-state-descriptions.js`, `test-catalog-v2-sidebar-detail-buttons.js`, and `test-catalog-v2-selected-detail-stability.js`.
- Files were not deleted; they remain as legacy artifacts until a separate deletion pass proves no external page loads them.

Theme/customization update:

- Bumped `seasonal-theme.js` to `v=5` and added Midnight, Aurora, Sakura, Ocean, Ember, Royal, Cyber, Forest, Cosmic, Quartz, and Sunrise themes.
- Bumped `site-menu.js` to `v=8`; the shared side menu now includes a sitewide theme select and swatches.
- Bumped `test-catalog-v2-theme.css` to `v=5` for the current desktop sidebar visual pass.
- `roster.html` and `optimizer.html` now use the same theme/menu script versions as Catalog.

## 2026-06-18 — Desktop awaken badge indicator authority

Commits:

- `4628f54b29a297cf7e9264f6addc4daef91a73f1` — `catalog-click-fast-authority.js`
- `080c6e60db7670405d5b9dcb7ec683cc45df83a4` — `index.html`

Routing/ownership update:

- Desktop card awaken badge activation state is owned by `catalog-click-fast-authority.js`.
- The file now enforces exactly one active desktop awaken badge per card.
- It writes synchronized state to:
  - `.stateBtn.active`
  - `aria-pressed="true|false"`
  - `data-v2-label`
  - visible button text: `5★`, `6★`, `FA`
  - host card `data-duo-index`
  - host image `data-state`
- It updates the host card image when a desktop awaken badge is clicked.
- It uses a targeted `#catalogGrid` child-list observer only to label/sync newly progressive-loaded cards.
- It does not run on mobile because `catalog-click-fast-authority.js` exits below `821px`.

Index load-order update needed:

- `index.html` now loads `catalog-click-fast-authority.js?v=32` instead of `v=31`.

Request routing update:

- For desktop badge indicators not showing active/inactive correctly, check `catalog-click-fast-authority.js` first.
- For pure desktop badge colors/glow, check `index.html` inline `#v2-hard-desktop-layout-lock` or `test-catalog-v2-theme.css` second.
- Do not patch `catalog-v2-lite.js` for desktop-only badge indicator state unless the generated card markup is missing `.stateRow` or `.stateBtn`.

## 2026-06-19 — Character awaken state data repair shim

Commits:

- `9f96d884f09872e80a2a8edcb0cd5a572314bdba` — `catalog-character-state-repair.js`
- `ac96d0caeae3d1d5b47715f8468d11313968083e` — `index.html`

Routing/ownership update:

- `catalog-character-state-repair.js` now loads immediately after `data-loader.js` and before `catalog-v2-lite.js`.
- It wraps `window.EvertaleData.loadEntryCategory('characters')` only.
- It repairs in-memory character rows before the live Catalog renderer sees them.
- It does not mutate generated `apkfiles` data.
- It guarantees expected image states for character families:
  - SSR: `01`, `02`, `03`
  - SR: `01`, `02`
- This exists because stale or incomplete character image/family maps can return only one state, causing `catalog-v2-lite.js` to render no `.stateRow` and no awaken buttons.

Request routing update:

- If awaken state buttons are missing entirely for character entries, check `catalog-character-state-repair.js` first.
- If `.stateRow` exists but button click state does not change, check `catalog-v2-lite.js` and then `catalog-click-fast-authority.js`.
- If sidebar buttons exist but active/inactive visual state is wrong, check `test-catalog-v2-theme.css` and desktop injected styles.
