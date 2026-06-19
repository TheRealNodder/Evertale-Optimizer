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
