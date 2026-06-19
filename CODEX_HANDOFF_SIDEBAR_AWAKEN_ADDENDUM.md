# Codex Handoff Addendum — Old Catalog Layout Flash

This addendum belongs with:

```text
CODEX_HANDOFF_SIDEBAR_AWAKEN_INDICATORS.md
```

## New user observation

The user reports seeing the old/original Catalog HTML/layout briefly before the newer pushed layout overrides it.

This likely means there is still an older base layout or legacy stylesheet/script path being applied first, then later overridden by newer desktop/mobile authority scripts or hard-lock CSS.

This is important because the sidebar awaken indicator bug may be affected by an old style or layout rule that still loads before or after the newer override stack.

---

## Mutation warning

Do not broadly rewrite the page to remove the flash.

Do not delete legacy files unless the exact active conflict is proven.

Do not change mobile, roster, optimizer, generated data, card rendering, or progressive loading.

Use the repo map first:

```text
CATALOG_CODE_PATH_INDEX.md
CATALOG_CODE_PATH_INDEX_CHANGELOG.md
```

---

## What to inspect

Check the actual load and override sequence in `index.html`:

```text
style.css
element-watermark.css
test-catalog-v2.css
test-catalog-v2-elements.css
test-catalog-v2-theme.css
test-catalog-v2-mobile.css
test-catalog-v2-layout-refine.css
test-catalog-v2-visual-fix.css
test-catalog-v2-mobile-fluid.css
test-catalog-v2-mobile-detail.css
inline #v2-hard-desktop-layout-lock
catalog-v2-lite.js
legacy/no-op bridge files
test-catalog-v2-desktop-structure.js
test-catalog-v2-sidebar-detail-buttons.js
test-catalog-v2-desktop-sidebar-authority.js
catalog-click-fast-authority.js
```

Look for old layout rules that are still active before the final override, especially selectors around:

```text
.v2-shell
.v2-sidebar
.v2-hero
.v2-description
#v2AwakenTabs
.v2-awaken-tabs
.v2-awaken-tabs button
.unitCard
.stateRow
.stateBtn
```

---

## Possible root causes

1. The initial HTML/CSS paints the original layout before desktop scripts add final classes or CSS.
2. `test-catalog-v2-theme.css` or another CSS file still contains old `.v2-awaken-tabs button` rules.
3. `test-catalog-v2-desktop-structure.js` may move or rebuild sidebar sections after initial paint.
4. `test-catalog-v2-sidebar-detail-buttons.js` may create/alter a secondary sidebar detail path.
5. The inline `#v2-hard-desktop-layout-lock` only handles card/grid layout, not all sidebar button states.
6. `catalog-click-fast-authority.js` injects CSS after page load, which means initial CSS may flash first.

---

## Debug instruction

Use DevTools Performance or slow refresh with cache disabled and watch which file last changes the sidebar.

For the sidebar awaken buttons, inspect computed styles and the matched CSS rule source for:

```js
[...document.querySelectorAll('#v2AwakenTabs button')].map(b => ({
  text: b.textContent.trim(),
  className: b.className,
  pressed: b.getAttribute('aria-pressed'),
  opacity: getComputedStyle(b).opacity,
  background: getComputedStyle(b).backgroundImage,
  color: getComputedStyle(b).color,
  filter: getComputedStyle(b).filter
}))
```

If the attributes are correct but the style is wrong, fix the winning CSS rule only.

If the attributes are wrong, fix the sidebar path in `catalog-click-fast-authority.js` only.

If a different visible DOM path is being used instead of `#v2AwakenTabs`, update `CATALOG_CODE_PATH_INDEX.md` before patching.
