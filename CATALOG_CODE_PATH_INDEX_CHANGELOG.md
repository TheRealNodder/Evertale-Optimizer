# Catalog Code Path Index Changelog

This companion log records small ownership/version updates that need to be reflected in `CATALOG_CODE_PATH_INDEX.md` when the main index is next recompiled.

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
