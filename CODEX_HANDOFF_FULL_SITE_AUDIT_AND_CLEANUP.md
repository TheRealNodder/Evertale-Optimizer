# Codex Handoff — Full Site Audit, Catalog State Fix, Legacy Loader Cleanup, and Theme Expansion

## Purpose

This handoff has two parts.

1. A precise explanation of what is happening right now with the Catalog awaken state/sidebar issue.
2. A request for Codex to run through the entire site and clean up old loaders, stale style paths, duplicated responsibilities, and theme handling without mutating unrelated working behavior.

This repository is the Evertale Optimizer site:

```text
TheRealNodder/Evertale-Optimizer
```

Live page under review:

```text
https://therealnodder.github.io/Evertale-Optimizer/index.html
```

---

# PART 1 — Current Catalog Issue and What Is Happening

## User-facing issue

The user is trying to verify the desktop sidebar awaken state controls, but the awaken state buttons are not reliably showing for all character entries. Because the card catalog is not showing the awaken state controls, the sidebar cannot be properly verified.

Expected visible card/sidebar state options for SSR characters:

```text
5★
6★
FA
```

Expected active/inactive sidebar behavior:

```text
[5★ Active] [6★ Inactive] [FA Inactive]
[5★ Inactive] [6★ Active] [FA Inactive]
[5★ Inactive] [6★ Inactive] [FA Active]
```

The user specifically clarified that there are two JavaScript responsibilities:

```text
Card catalog renderer/state buttons:
catalog-v2-lite.js

Desktop sidebar selected-entry/awaken/details authority:
catalog-click-fast-authority.js
```

Do not confuse these two paths.

---

## Important repo map files

Before touching anything, read:

```text
CATALOG_CODE_PATH_INDEX.md
CATALOG_CODE_PATH_INDEX_CHANGELOG.md
```

These are the routing/ownership notes for the Catalog. If ownership or load order changes, update one of these files in the same PR/commit.

---

## Current findings

### 1. The card catalog must render awaken buttons first

The sidebar cannot work correctly if the card catalog has no awaken states.

The card catalog renderer is:

```text
catalog-v2-lite.js
```

The relevant flow is:

```text
renderCard(item)
  → buildStateRows(item, imgs)
  → stateBtns(states)
```

`stateBtns(states)` returns nothing unless there are at least 2 state rows.

In other words:

```text
states.length < 2 → no .stateRow → no .stateBtn → no awaken state buttons on card
```

That blocks sidebar verification.

---

### 2. The sidebar is separate and should not invent missing card states

The sidebar authority is:

```text
catalog-click-fast-authority.js
```

It owns desktop sidebar behavior:

```text
#v2AwakenTabs
#v2FeatureArt
#v2Name
#v2Title
#v2Pills
#v2Hp / #v2Atk / #v2Spd / #v2Cost
sidebar Leader / Active / Passive / Description panels
```

It should follow the selected card state, not fabricate card catalog state buttons.

---

### 3. Old desktop structure code still exists and can conflict

`test-catalog-v2-desktop-structure.js` still contains older desktop sidebar logic/styling. It has historically contained:

```text
selectedAwakenIndex
syncAwakenActive(index)
ensureAwakenTabs()
proxyAwakenState(index)
findNativeAwakenTargets()
```

This file can affect:

```text
#v2AwakenTabs
.v2-awaken-tabs
.v2-awaken-tabs button
```

It may also inject CSS after initial paint. If active/inactive buttons visually reset, check this file.

Important: do not expand or reintroduce synthetic-click behavior. That was part of an older fragile path.

---

### 4. Theme CSS can override the active/inactive look

The file:

```text
test-catalog-v2-theme.css
```

currently contains sidebar-specific overrides for:

```text
#v2AwakenTabs button
#v2AwakenTabs button.active
#v2AwakenTabs button[aria-pressed="true"]
#v2AwakenTabs button[aria-pressed="false"]
```

If the DOM state is correct but the active/inactive visual state is wrong, inspect the computed CSS cascade and patch the winning selector only.

---

### 5. Recent repair shim exists but must be verified

A narrow shim was added:

```text
catalog-character-state-repair.js
```

It is loaded in `index.html` after `data-loader.js` and before `catalog-v2-lite.js`.

Purpose:

```text
Wrap EvertaleData.loadEntryCategory('characters') only.
Repair character rows in memory only.
Guarantee expected image state variants before catalog-v2-lite renders cards.
SSR → 01 / 02 / 03
SR → 01 / 02
Do not mutate generated apkfiles data.
```

This must be verified. If it does not run early enough or if it is using the wrong source fields, fix that narrowly.

Do not mutate the generated `apkfiles` data unless a separate data-generation task is explicitly created.

---

## Current load order to inspect

In `index.html`, inspect the full script/style order. Pay special attention to the actual loaded order of these files:

```text
style.css
element-watermark.css
test-catalog-v2.css
test-catalog-v2-elements.css
test-catalog-v2-theme.css
test-catalog-v2-mobile.css
test-catalog-v2-mobile-fluid.css
test-catalog-v2-mobile-detail.css
inline #v2-hard-desktop-layout-lock

data-loader.js
catalog-character-state-repair.js
catalog-v2-lite.js
test-catalog-v2-desktop-structure.js
test-catalog-v2-sidebar-detail-buttons.js
test-catalog-v2-desktop-sidebar-authority.js
catalog-click-fast-authority.js
```

The old/original layout may flash before the newer override stack applies. The user has seen this happen. That implies older CSS/JS is still active before final override.

---

## Debugging checklist for the current issue

### Card catalog state buttons

In the live page console, run:

```js
[...document.querySelectorAll('#catalogGrid .unitCard')].slice(0,20).map(card => ({
  name: card.querySelector('.unitName')?.textContent?.trim(),
  id: card.getAttribute('data-id'),
  sourceId: card.getAttribute('data-source-id'),
  family: card.getAttribute('data-family'),
  stateRows: (() => {
    try { return JSON.parse(decodeURIComponent(card.getAttribute('data-state-rows') || '[]')).length; }
    catch { return -1; }
  })(),
  buttons: card.querySelectorAll('.stateRow .stateBtn').length,
  img: card.querySelector('.unitThumb img')?.getAttribute('src')
}))
```

Expected for SSR characters:

```text
stateRows: 3
buttons: 3
```

Expected for SR characters:

```text
stateRows: 2
buttons: 2
```

If SSR characters show `stateRows: 1` or `buttons: 0`, the issue is before or inside `catalog-v2-lite.js` rendering. Start with `catalog-character-state-repair.js` and the data returned by `EvertaleData.loadEntryCategory('characters')`.

---

### Sidebar state buttons

Only after card state buttons exist, test sidebar buttons:

```js
[...document.querySelectorAll('#v2AwakenTabs button')].map(b => ({
  text: b.textContent.trim(),
  className: b.className,
  pressed: b.getAttribute('aria-pressed'),
  idx: b.dataset.v2Idx || b.dataset.awakenIndex,
  opacity: getComputedStyle(b).opacity,
  filter: getComputedStyle(b).filter,
  background: getComputedStyle(b).backgroundImage
}))
```

Expected after clicking 5★:

```text
5★ active/true
6★ inactive/false
FA inactive/false
```

Expected after clicking 6★:

```text
5★ inactive/false
6★ active/true
FA inactive/false
```

Expected after clicking FA:

```text
5★ inactive/false
6★ inactive/false
FA active/true
```

---

## Do not mutate these unless proven necessary

Avoid broad changes to:

```text
roster files
optimizer files
runtime stat engine files
generated apkfiles data
mobile-only files
progressive render logic
ImageKit URL generation
core data loader architecture
```

Fix the smallest confirmed owner.

---

# PART 2 — Full Site Run-through and Cleanup Request for Codex

## Goal

After the Catalog awaken-state issue is isolated and fixed, perform a full run-through of the site and clean up the old loader/style stack so the site reflects the current design instead of the original/old layout.

This should be done carefully, preferably in a branch/PR, with small commits and clear notes.

---

## Full-site audit scope

Review all major pages:

```text
index.html       Catalog
roster.html      Roster
optimizer.html   Optimizer
```

Also review shared scripts/styles that affect all pages.

Primary goals:

1. Remove or retire stale loaders that are no longer supposed to run.
2. Stop old Catalog styling/layout from flashing before the current style takes over.
3. Ensure loaded code reflects the current V2 visual system.
4. Prune unnecessary duplicate code that is already represented by the main owner files.
5. Keep card catalog and sidebar responsibilities separate.
6. Make theme handling centralized, easier to expand, and visually appealing.
7. Preserve working behavior.

---

## Prune strategy

Do not delete first. Prove first.

For every loaded JS/CSS file, classify it as one of:

```text
KEEP — current owner
MERGE — useful rules/logic should be moved into owner file
RETIRE — loaded but should become a no-op or be removed from index after verification
LEGACY — kept in repo but not loaded
UNKNOWN — requires manual verification
```

Create or update a map table in:

```text
CATALOG_CODE_PATH_INDEX.md
```

If full update is too risky, update:

```text
CATALOG_CODE_PATH_INDEX_CHANGELOG.md
```

Do not leave ownership ambiguous.

---

## Files likely needing audit

Catalog-related files that should be audited for overlap:

```text
catalog-v2-lite.js
catalog-click-fast-authority.js
catalog-character-state-repair.js
test-catalog-v2.css
test-catalog-v2-theme.css
test-catalog-v2-elements.css
test-catalog-v2-layout-refine.css
test-catalog-v2-visual-fix.css
test-catalog-v2-duo-badges.css
test-catalog-v2-mobile.css
test-catalog-v2-mobile-fluid.css
test-catalog-v2-mobile-detail.css
test-catalog-v2-desktop-structure.js
test-catalog-v2-sidebar-detail-buttons.js
test-catalog-v2-selected-detail-stability.js
test-catalog-v2-leader-detail-fix.js
test-catalog-v2-desktop-sidebar-authority.js
test-catalog-v2-mobile-detail-badge-tabs.js
test-catalog-v2-final-awaken-controller.js
test-catalog-v2.js
test-catalog-v2-state-descriptions.js
test-catalog-v2-source-badge-authority.js
```

Some older files may already be retired/no-op. Verify and remove from load order only if safe.

---

## Loader cleanup requirements

For every script in `index.html`, determine:

```text
What does it own?
Does another later script own the same thing?
Does it mutate layout after initial paint?
Does it inject CSS that should live in CSS instead?
Does it run on mobile when it should be desktop-only?
Does it run on desktop when it should be mobile-only?
Does it have broad document-level observers or synthetic clicks?
Can it be removed from index.html?
Can it be merged into the current owner file?
```

Avoid multiple files owning the same state.

Final desired ownership:

```text
Catalog data + card render + progressive render:
catalog-v2-lite.js

Character state data repair before render if still needed:
catalog-character-state-repair.js or, better, corrected data-loader normalization

Desktop selected sidebar and detail state:
catalog-click-fast-authority.js

Mobile popup/details:
one mobile owner file only

Theme variables and theme registry:
central theme file/registry

Base reusable site styles:
style.css and current V2 CSS files only
```

---

## Old style / first-paint cleanup

The user has seen the original/old Catalog layout briefly before new overrides take over.

Find what causes this first paint.

Likely causes:

```text
base HTML is old structure and JS moves modules later
early CSS paints old layout
later JS injects current desktop structure CSS
old test-catalog-v2 files remain loaded
inline hard-lock CSS overrides after base CSS but before JS finishes
```

Preferred fix:

```text
Make the static HTML/CSS closer to the final intended structure.
Avoid depending on late JS module movement for the first paint.
Move stable visual rules from JS-injected CSS into CSS files.
Keep JS for behavior, not visual patching, where possible.
```

Do not break mobile.

---

## Theme system requirements

Make the theme system easy to expand and visually appealing.

Requirements:

1. Centralize theme definitions in one clear owner path.
2. Themes should use CSS variables rather than scattered hardcoded colors.
3. Theme definitions should support:
   - background gradients
   - primary accent
   - secondary accent
   - trim color
   - ink/text color
   - glow strength
   - surface tint
4. Adding a new theme should require adding one object/config, not touching many unrelated CSS files.
5. Existing seasonal themes should still work.
6. Theme colors should flow through:
   - topbar
   - panels
   - selected sidebar
   - card accents
   - buttons
   - scrollbars
   - awaken indicators
7. Themes should remain readable and accessible, especially text contrast.

Audit these files:

```text
seasonal-theme.js
test-catalog-v2-theme.css
style.css
```

Suggested direction:

```text
seasonal-theme.js = chooses active theme and sets body/data attributes + CSS vars
test-catalog-v2-theme.css = consumes CSS vars for Catalog V2 visuals
style.css = base shared structure only, no seasonal duplication where possible
```

---

## Acceptance criteria for full cleanup

### Catalog

- Current V2 style shows immediately, with no visible old-layout flash.
- Character cards show awaken state buttons where expected.
- SSR characters show 3 states.
- SR characters show 2 states.
- Sidebar awaken buttons reflect the selected card state.
- Sidebar image/stats/title/description follow the selected awaken state.
- Card catalog state buttons and sidebar buttons are separate but synced.
- Desktop and mobile behavior remain separate.

### Roster

- Roster still loads.
- Owned characters still display.
- Current style is preserved.
- No Catalog-only cleanup breaks roster.

### Optimizer

- Optimizer still loads.
- Platoons and story layout still work.
- No Catalog-only cleanup breaks optimizer.

### Themes

- Current theme works.
- Seasonal themes still work.
- Adding a new theme is straightforward.
- Theme visuals look intentional and not like old/default fallback styling.

### Code health

- No duplicate owner paths for the same state.
- No stale scripts loaded only to be overridden later.
- No document-wide observers unless explicitly justified.
- No synthetic clicks across unrelated controls.
- No per-click bundle fetching.
- Path index/changelog updated.

---

## Final deliverables requested from Codex

1. A concise report listing:
   - files kept
   - files retired
   - files merged
   - files changed
   - files intentionally left alone
2. A clear explanation of the Catalog awaken-state root cause.
3. A clear explanation of what caused the old layout/style flash.
4. A list of theme improvements and how to add a new theme.
5. A test checklist with desktop and mobile checks.
6. Updated path index/changelog.

---

## Hard rule

Do not mutate unrelated working systems. Clean up only after proving ownership and confirming the replacement path is active.
