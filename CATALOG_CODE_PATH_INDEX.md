# Evertale Optimizer Connected Code Path Index

Purpose: this file is the working map for future edits. Before changing a visual, layout, data, roster, or optimizer behavior, use this map to identify the owning file instead of guessing or stacking another patch.

Last indexed after current `index.html` commit: `fb1342c715998cbcd3519ae81dd7ab5061bff1fb`.

---

## 2026-06-28 workflow, cleanup, theme, and loader addendum

This addendum supersedes older root-file and version lists below.

- Active GitHub data workflows are `.github/workflows/master-control.yml` and
  `.github/workflows/entry-safe-rebuild.yml`.
  - They use the Node 24 action generation: `checkout@v6`,
    `setup-python@v6`, and `upload-artifact@v7`.
  - Both data writers share one concurrency group.
  - Timestamp-only reports and markers are artifacts, not auto-committed data.
- The broken toolbox scraper workflow moved to
  `legacy/workflows/update_toolbox_data.yml`; its `scraper/` runtime no longer
  exists.
- Cleanup ownership and deletion boundaries are recorded in
  `legacy/CLEANUP_MANIFEST_2026-06-28.md`.
- Theme authority is `seasonal-theme.js?v=13` plus `site-menu.js?v=14` on
  Catalog, Roster, and Optimizer.
  - Auto mode uses the America/Los_Angeles calendar, seasonal fallbacks,
    calculated Easter, and calculated fourth-Thursday Thanksgiving dates.
  - The site menu contains an explicit `Auto · <resolved theme>` button.
  - Calendar, Pokémon by region, Gems & Minerals, DS & 3DS, and Signature
    themes have separate picker groups and visible swatch dividers.
  - Gold, Silver, Ruby, Sapphire, Emerald, Diamond, Pearl, and Platinum are the
    Pokémon group; Amethyst, Opal, Topaz, Jade, Obsidian, and Quartz remain in
    Gems & Minerals. Both groups retain the reduced-motion-safe material sheen.
  - Ruby, Sapphire, and Emerald use darkened palettes sampled from the original
    Generation III game covers so their hues stay recognizable without reducing readability.
  - Game-defining legendary themes run from Johto through Paldea/Z-A. Each
    palette stays fixed while panel outlines pulse between its energy color
    and a slightly darker shade; headings use a stable third detail color.
    Reduced-motion fallback is included. Hoenn also includes Shiny Primal
    Groudon, Shiny Primal Kyogre, and Shiny Mega Rayquaza themes.
  - The curated DS & 3DS group includes Crimson/Black, Cobalt/Black, Metallic
    Rose, Bronze XL, Pokémon Black & White DSi, Galaxy Style, and Super Famicom.
    Near-duplicates of existing gem and signature themes are intentionally omitted.
- Data authority remains `data-loader.js`, now loaded as `v=6`.
  - `live-data-config.js` separates its generated `DATA_VERSION_BASE` from the
    manually owned `RUNTIME_CACHE_REVISION`. The entry pipeline updates the
    base plus the versioned config URL in `index.html`, `roster.html`, and
    `optimizer.html`, so future Master Control runs cannot erase loader fixes
    or leave any page on a stale config URL.
  - Category bundles are fetched directly and concurrent duplicate requests
    are coalesced.
  - `character_families.bundle.json` is preferred before the full catalog
    fallback.
  - The 65 MB global localization table is disabled by default because current
    bundles already contain localized display and skill data. Set
    `useGlobalLocalization: true` only for legacy data recovery.
  - `data-loader-index-authority.js?v=2` trusts complete bundle metadata and
    only performs index repair requests when metadata is absent or short.
  - Character repair and desktop detail layers reuse the loader's cached image
    and family maps instead of parsing duplicate responses.
  - `characters.live.bundle.json` is the first-load Catalog/Roster projection.
    It preserves all 743 identities, visible fields, skills, refs, and state
    inputs at roughly 2.5 MB instead of parsing the 11.3 MB full authority.
    The full character bundle remains the automatic fallback.
  - Catalog and Roster preload the exact versioned live bundle; Master Control
    updates those preload URLs together with `live-data-config.js`.
- `catalog-v2-lite.js?v=29` warms only small accessory/weapon categories on
  capable connections. Boss data remains interaction-lazy.
- `run_entry_pipeline.py` version 10 updates the shared live-data token after
  rebuilding bundles. Both active workflows stage all three page references.

---

## 2026-06-19 live audit addendum

This addendum supersedes stale version numbers in the older load-order tables until the full index is regenerated.

Active state/data owners:

- Character state repair guard: `catalog-character-state-repair.js?v=1`
  - Loaded after `data-loader.js` and `test-catalog-v2-state-preprocess.js`.
  - Wraps only `EvertaleData.loadEntryCategory('characters')`.
  - Repairs sparse/new character rows in memory from `character_image_map.json` and `character_families.bundle.json`.
- Card renderer/state authority: `catalog-v2-lite.js?v=25`
  - Owns `data-state-rows`, `.stateRow`, `.stateBtn`, card image/title/stats/description state changes.
  - Emits `v2:hero-state-change` after real state changes.
- Card badge visibility authority: `test-catalog-v2-source-badge-authority.js?v=3`
  - Reads `data-state-rows`, not old `data-imgs`, before deciding SSR/SR visible state counts.
- Desktop sidebar behavior authority: `catalog-click-fast-authority.js?v=38`
  - Reads `data-state-rows`.
  - Calls `EvertaleCatalogV2.applyState()` for sidebar awaken clicks.
  - Listens to `v2:hero-state-change` so card-grid state clicks refresh the sidebar.
- Desktop layout helper: `test-catalog-v2-desktop-structure.js?v=10`
  - No longer synthetic-clicks unrelated awaken buttons.
  - Uses the selected card's real state count before creating/sidebar-syncing awaken tabs.
- Desktop sidebar visual authority: `test-catalog-v2-desktop-sidebar-authority.js?v=2`
  - Keeps selected info at content height so the details tab row sits immediately below sidebar stats.
- Mobile popup state guards: `test-catalog-v2-detail-fix.js?v=2` and `test-catalog-v2-mobile-detail-badge-tabs.js?v=3`
  - Use `EvertaleCatalogV2.applyState()` and `data-state-rows` instead of old `data-imgs`.

Retired from `index.html` load order after this audit:

- `test-catalog-v2-final-awaken-controller.js`
- `test-catalog-v2.js`
- `test-catalog-v2-state-descriptions.js`
- `test-catalog-v2-sidebar-detail-buttons.js`
- `test-catalog-v2-selected-detail-stability.js`

Theme/sitewide customization update:

- `seasonal-theme.js?v=5` centralizes the expanded theme registry.
- `site-menu.js?v=8` exposes the shared theme picker and swatches.
- `test-catalog-v2-theme.css?v=6` adds the current desktop sidebar visual pass and element-colored awaken badge illumination.
- `roster.html` and `optimizer.html` now load the same `seasonal-theme.js?v=5` and `site-menu.js?v=8` as Catalog.

---

## 0. Strict rules for future changes

1. Do not mutate unrelated systems.
2. Check this map first.
3. Desktop catalog and mobile catalog are separate experiences.
4. Desktop catalog owns the left selected-card sidebar.
5. Mobile catalog owns the card details popup.
6. Roster owns owned-unit storage.
7. Optimizer reads owned-unit storage and its own team layout storage.
8. Avoid adding more document-wide `MutationObserver` logic.
9. Avoid synthetic clicks across unrelated buttons.
10. Avoid per-click data fetches.
11. If an issue is visual-only, prefer CSS in the owning CSS/page block instead of JS.
12. If an issue is behavior-only, patch the owning behavior file and do not change layout.

---

## 1. Top-level pages and what they own

### 1.1 `index.html` = Catalog page

Owns the Catalog DOM shell and its load order.

Main DOM anchors:

- `body.page-catalog.page-catalog-v2.mobile-compact`
- `.v2-shell`
- `.v2-sidebar`
- `.controls`
- `.v2-main`
- `.v2-hero`
- `.v2-selected-card`
- `#v2FeatureArt`
- `#v2Kind`
- `#v2Name`
- `#v2Title`
- `#v2Pills`
- `.v2-stats`
- `#v2Hp`, `#v2Atk`, `#v2Spd`, `#v2Cost`
- `.v2-description`
- `#v2AwakenTabs`
- `#v2Desc`
- `#catalogGrid`
- `#catalogSearch`, `#catalogType`, `#catalogSort`

Important current inline block:

- `#v2-hard-desktop-layout-lock`
- Desktop-only hard layout lock for catalog cards.
- Currently also contains visible desktop awaken badge styling.
- Use this only for small emergency desktop visual locks that must bypass stale CSS/JS cache.
- Do not grow this into a full replacement stylesheet.

Current loaded Catalog CSS order:

1. `style.css?v=1770741090`
2. `element-watermark.css?v=1`
3. `test-catalog-v2.css?v=3`
4. `test-catalog-v2-elements.css?v=4`
5. `test-catalog-v2-theme.css?v=2`
6. `test-catalog-v2-mobile.css?v=2`
7. `test-catalog-v2-skill-expand.css?v=1`
8. `test-catalog-v2-layout-refine.css?v=2`
9. `test-catalog-v2-visual-fix.css?v=2`
10. `test-catalog-v2-duo-badges.css?v=6`
11. `test-catalog-v2-mobile-fluid.css?v=5`
12. `test-catalog-v2-mobile-detail.css?v=4`
13. inline `#v2-hard-desktop-layout-lock`

Current loaded Catalog JS order:

1. inline `window.EVERTALE_LIVE_CONFIG` seed
2. `seasonal-theme.js?v=2`
3. `site-menu.js?v=6`
4. `image-cache-reset.js?v=1`
5. `live-data-config.js?v=4`
6. `data-loader.js?v=4`
7. `leader-skill-resolver.js?v=2`
8. `test-catalog-v2-state-preprocess.js?v=1`
9. `catalog-v2-lite.js?v=19`
10. `test-catalog-v2-duo-badge-labels.js?v=1`
11. `test-catalog-v2-final-awaken-controller.js?v=4`
12. `test-catalog-v2.js?v=12`
13. `test-catalog-v2-source-badge-authority.js?v=2`
14. `test-catalog-v2-state-descriptions.js?v=4`
15. `test-catalog-v2-clean-generic-leader.js?v=1`
16. `test-catalog-v2-mobile-force.js?v=1`
17. `catalog-force-sort.js?v=2`
18. `test-catalog-v2-detail-fix.js?v=1`
19. `test-catalog-v2-desktop-structure.js?v=5`
20. `test-catalog-v2-sidebar-detail-buttons.js?v=1`
21. `test-catalog-v2-selected-detail-stability.js?v=2`
22. `test-catalog-v2-leader-detail-fix.js?v=1`
23. `test-catalog-v2-mobile-standalone.js?v=1`
24. `test-catalog-v2-mobile-leader-fix.js?v=1`
25. `test-catalog-v2-mobile-detail-toggle-fix.js?v=1`
26. `test-catalog-v2-mobile-detail-badge-tabs.js?v=2`
27. `test-catalog-v2-desktop-sidebar-authority.js?v=1`
28. `catalog-click-fast-authority.js?v=31`

Catalog load flow:

```text
index.html
  -> live-data-config.js
  -> data-loader.js exposes window.EvertaleData
  -> leader-skill-resolver.js enriches leader skill data
  -> test-catalog-v2-state-preprocess.js wraps EvertaleData.loadAllEntries
  -> catalog-v2-lite.js renders #catalogGrid cards
  -> supporting visual/behavior scripts decorate cards, mobile popup, desktop sidebar
  -> catalog-click-fast-authority.js loads last and owns desktop sidebar behavior
```

---

### 1.2 `roster.html` = Roster page

Owns owned-unit selection UI and writes owned state for Optimizer.

Main DOM anchors:

- `body.page-roster-v2`
- `#searchInput`
- `#elementSelect`
- `#raritySelect`
- `#viewToggle`
- `#deselectAll`
- `#teamTypeSelect`
- `#presetSelect`
- `#statusText`
- `#unitGrid`

Current roster CSS:

1. `style.css?v=1770741090`
2. `element-watermark.css?v=1`
3. `v2-site-ui-pass.css?v=1`
4. `v2-roster-decramp.css?v=4`
5. `v2-roster-progression-linefix.css?v=1`

Current roster JS:

1. `seasonal-theme.js`
2. `site-menu.js?v=6`
3. `live-data-config.js?v=4`
4. `data-loader.js?v=4`
5. `leader-skill-resolver.js?v=1`
6. `duo-source-collapse.js?v=2`
7. `duo-display.js?v=1`
8. `runtime-stat-engine.js?v=1`
9. `roster-profile-store.js?v=2`
10. `app.js?v=1770082379`
11. `roster-profile-ui.js?v=2`

Roster data flow:

```text
roster.html
  -> live-data-config.js
  -> data-loader.js exposes window.EvertaleData
  -> leader-skill-resolver.js
  -> duo-source-collapse.js / duo-display.js
  -> runtime-stat-engine.js
  -> roster-profile-store.js exposes window.EvertaleRosterProfiles
  -> app.js renders #unitGrid and writes owned IDs to localStorage
  -> roster-profile-ui.js renders profile controls around roster profile data
```

Roster storage keys:

- `evertale_owned_units_v1` = current owned IDs
- `evertale_owned` = legacy owned IDs, kept in sync
- `evertale_mobile_view_v1` = compact/detailed roster view
- `evertale_roster_profiles_v1` = roster profile stat settings

---

### 1.3 `optimizer.html` = Optimizer page

Owns story/platoon/team building and reads owned IDs from Roster.

Main DOM anchors:

- `body.page-optimizer`
- `#modeStory`
- `#modePlatoons`
- `#ownedCount`
- `#optimizerRuntimeStatus`
- `#primaryArchetypeSelect`
- `#secondaryArchetypeSelect`
- `#buildBest`
- `#buildExample`
- `#clearTeams`
- `#lockFilledStory`
- `#unlockAllLocks`
- `#storySection`
- `#storyMain`
- `#storyBack`
- `#platoonsSection`
- `#platoonsGrid`
- `#storageGrid`

Current optimizer CSS:

1. `style.css?v=1770741090`
2. `optimizer-layout.css?v=4`
3. `v2-optimizer-mainstyle.css?v=2`

Current optimizer JS:

1. `seasonal-theme.js?v=13`
2. `site-menu.js?v=14`
3. `theme-auto-route-authority.js?v=1`
4. `live-data-config.js`
5. `image-cache-reset.js?v=4`
6. `data-loader.js?v=6`
7. `duo-source-collapse.js?v=2`
8. `duo-display.js?v=1`
9. `optimizerRuntimeLoader.js?v=3`
10. `optimizer_doctrine.js?v=1770082381`
11. `runtime-stat-engine.js?v=2`
12. `roster-profile-store.js?v=4`
13. `optimizerEngine.js?v=1770082381`
14. `abilityScoreEngine.js?v=1`
15. `optimizerEngineV2.js?v=3`
16. `optimizerEngineV3.js?v=2`
17. `optimizer-legacy/optimizer-v4-fallback-loader.js?v=12`
18. `optimizer-v5-lab/optimizer-v5-loader.js?v=12`
19. `optimizer-hook.js?v=1770082379`
20. `optimizerRuntimeBootstrap.js?v=1`
21. `optimizer.js?v=1770082389`
22. `optimizer-showcase.js?v=4`

Optimizer data flow:

```text
optimizer.html
  -> data-loader.js exposes window.EvertaleData
  -> duo-source-collapse.js / duo-display.js normalize duo units
  -> optimizerRuntimeLoader.js exposes window.loadOptimizerRuntime and window.OptimizerRuntime
  -> optimizer_doctrine.js exposes doctrine weights/config
  -> runtime-stat-engine.js supports stat calculations
  -> roster-profile-store.js exposes stat profiles
  -> optimizerEngine.js / V2 / V3 provide earlier engine layers and enrichment
  -> abilityScoreEngine.js adds ability scoring
  -> optimizer-legacy/optimizer-v4-fallback-loader.js keeps V4 available as an explicit fallback
  -> optimizer-v5-lab/optimizer-v5-loader.js loads V5 modules once and makes V5 the live window.OptimizerEngine
  -> optimizer-hook.js keeps the compatibility run entrypoint
  -> optimizerRuntimeBootstrap.js starts runtime pieces
  -> optimizer.js owns DOM, localStorage layout, locks, story/platoons/storage render, and last-run diagnostics
  -> optimizer-showcase.js visual/presentation add-ons
```

Optimizer storage keys:

- `evertale_owned_units_v1` = read from Roster
- `evertale_owned` = legacy fallback
- `evertale_team_layout_v1` = story/platoon slot assignments
- `evertale_optimizer_teamType_v1`
- `evertale_optimizer_preset_v1`
- `evertale_optimizer_slotLocks_v1`
- `evertale_optimizer_primaryArchetype_v1`
- `evertale_optimizer_secondaryArchetype_v1`

---

## 2. Shared data layer

### 2.1 `live-data-config.js`

Owner: live data paths and cache version.

Exports:

- `window.EVERTALE_LIVE_CONFIG`

Important fields:

- `apkBase = './apkfiles'`
- `entryBase = './apkfiles/entries'`
- `bundlesBase = './apkfiles/entries/bundles'`
- `mapsBase = './apkfiles/entries/maps'`
- `runtimeBase = './apkfiles/entries/runtime'`
- `dataVersion = '2026-06-12-master-control-a4aef982'`

Connected to:

- `data-loader.js`
- `optimizerRuntimeLoader.js`
- any script that reads generated JSON bundles/maps/runtime chunks

Change this when generated data bundle versions change.

---

### 2.2 `data-loader.js`

Owner: generated APK-derived catalog data loading.

Reads:

- `window.EVERTALE_LIVE_CONFIG`
- `./apkfiles/entries/bundles/catalog.bundle.json`
- `./apkfiles/entries/bundles/{characters,weapons,accessories,bosses}.bundle.json`
- `./apkfiles/entries/bundles/character_families.bundle.json`
- `./apkfiles/entries/maps/explorer_character_order.json`
- `./apkfiles/entries/maps/character_image_map.json`
- `./apkfiles/entries/localization/localizable_groups.json`

Exports, expected:

- `window.EvertaleData`
- `EvertaleData.loadAllEntries()`
- `EvertaleData.loadCharactersMerged()`

Connected to:

- Catalog renderer: `catalog-v2-lite.js`
- Roster renderer: `app.js`
- Optimizer unit load: `optimizer.js`
- Preprocessors: `test-catalog-v2-state-preprocess.js`
- Leader resolution: `leader-skill-resolver.js`

Do not patch page layout here.

---

### 2.3 `leader-skill-resolver.js`

Owner: leader skill resolution/enrichment.

Connected to:

- `data-loader.js` output
- Catalog cards via `catalog-v2-lite.js`
- Roster cards via `app.js`
- Optimizer units via `optimizer.js`

Use this only for leader-skill data issues, not visual tab issues.

---

## 3. Catalog runtime ownership

### 3.1 `catalog-v2-lite.js` = Catalog grid renderer

Owner:

- Loads data through `window.EvertaleData.loadAllEntries()`
- Normalizes characters/weapons/accessories/bosses for Catalog
- Applies duo parent/child registry
- Renders cards into `#catalogGrid`
- Handles filters/search/sort basics
- Handles progressive loading
- Creates card HTML, including:
  - `.unitCard`
  - `.unitThumb img`
  - `.unitName`
  - `.unitTitle`
  - `.stateRow`
  - `.stateBtn`
  - `.duoFormBtn`
  - `.chipCol .tag.kind/.element/.rarity`
  - `.statLine`
  - `.leaderBlock`
  - `.skillMini`
  - `.descriptionPanel`
  - `.v2-detail-backdrop`

Connected to:

- Data: `data-loader.js`
- Duo map: `./apkfiles/entries/maps/character_parent_child_map.json`
- Fallback duo data: `./apkfiles/Duo.json`, `./apkfiles/DuoDisplay.json`
- Desktop sidebar authority: `catalog-click-fast-authority.js`
- Mobile popup/detail scripts: `test-catalog-v2-detail-fix.js`, `test-catalog-v2-mobile-detail-badge-tabs.js`, `test-catalog-v2-mobile-detail-toggle-fix.js`
- Visual card CSS: Catalog CSS files and inline layout lock

Do not change this for pure CSS problems.

Use this only when:

- card HTML is missing a needed attribute
- card render order is structurally wrong
- progressive loading breaks
- search/type/sort render behavior breaks
- data normalization is wrong

---

### 3.2 `test-catalog-v2-state-preprocess.js` = pre-render character state patch

Owner:

- Wraps `EvertaleData.loadAllEntries()` before `catalog-v2-lite.js` consumes it.
- Patches duplicate playable groups so character states do not collapse incorrectly.

Connected to:

- `data-loader.js`
- `catalog-v2-lite.js`

Do not use this for visual card state buttons.

---

### 3.3 `catalog-click-fast-authority.js` = desktop sidebar behavior authority

Owner:

- Desktop-only: exits immediately under `821px`.
- Selected-card state for desktop.
- Canonical desktop selected card:
  - `window.__EVERTALE_CATALOG_SELECTED_ID`
  - `window.__EVERTALE_FAST_SELECTED_CARD_ID`
- Desktop sidebar hero image.
- Desktop sidebar name/title/kind/pills/stats.
- Desktop sidebar awaken controls in `#v2AwakenTabs`.
- Desktop sidebar detail tabs:
  - Leader Skill
  - Active Skill
  - Passive Skill
  - Description
- Desktop sidebar description hydration from `character_families.bundle.json`.

Reads:

- `#catalogGrid .unitCard`
- card `data-id`, `data-source-id`, `data-family`
- card `data-active-skills`, `data-passive-skills`
- `.stateRow .stateBtn`
- `.unitThumb img[data-imgs]`
- `./apkfiles/entries/bundles/character_families.bundle.json`

Writes:

- `#v2FeatureArt`
- `#v2Kind`
- `#v2Name`
- `#v2Title`
- `#v2Pills`
- `#v2Hp`, `#v2Atk`, `#v2Spd`, `#v2Cost`
- `#v2AwakenTabs`
- `#v2Desc`
- `.v2-detail-scroll-panel`
- `.unitCard.v2-selected`
- `.stateBtn.active`

Connected to:

- `catalog-v2-lite.js` card markup
- `test-catalog-v2-desktop-structure.js` desktop sidebar layout
- `test-catalog-v2-desktop-sidebar-authority.js` desktop sidebar visual layout
- inline `#v2-hard-desktop-layout-lock`

Use this for:

- desktop sidebar wrong selected card
- sidebar awaken state wrong card
- sidebar details not updating
- desktop sidebar active tab behavior
- desktop selected card sync

Do not use this for mobile popup.

---

### 3.4 `test-catalog-v2-desktop-structure.js` = desktop sidebar layout/styling helper

Owner:

- Desktop-only structure pass.
- Converts left side into selected info/sidebar.
- Moves filters into top module.
- Moves description into selected card.
- Places `#v2AwakenTabs` in desktop sidebar.
- Creates detail tab container if missing.
- Applies desktop sidebar/card layout CSS.

Known risk:

- Contains legacy functions named `findNativeAwakenTargets()` and `proxyAwakenState()`.
- These functions previously caused the Lupin reset when they synthetic-clicked global awaken buttons.
- Do not reintroduce any global awaken routing.
- Prefer letting `catalog-click-fast-authority.js` own awaken behavior.

Connected to:

- `index.html` sidebar DOM
- `catalog-click-fast-authority.js`
- `test-catalog-v2-desktop-sidebar-authority.js`

Use this for:

- desktop sidebar placement
- filter panel placement
- desktop sidebar spacing
- desktop grid column count
- desktop-only layout fixes

Do not use this for selected-card behavior if `catalog-click-fast-authority.js` can handle it.

---

### 3.5 `test-catalog-v2-desktop-sidebar-authority.js` = desktop sidebar visual polish

Owner:

- Desktop-only visual shell around sidebar.
- Adds element-reactive gradients/sheen.
- Sets desktop page/sidebar/grid panel height and overflow.
- Tightens feature art and detail tab dimensions.

Connected to:

- `.v2-shell.v2-desktop-info-layout`
- `.v2-sidebar`
- `.v2-selected-card`
- `.v2-feature-art`
- `.v2-detail-tab-btn`
- `.v2-detail-scroll-panel`

Use this for:

- desktop sidebar visual polish
- sidebar height/overflow issues
- desktop page viewport lock issues

Do not use this for card click behavior.

---

### 3.6 `test-catalog-v2-sidebar-detail-buttons.js` = legacy/secondary desktop detail module

Owner currently claimed by file:

- Adds separate `#v2SidebarDetailMount`
- Adds `#v2SidebarDetailTabs`
- Adds `#v2SidebarDetailPanel`

Important conflict note:

- This overlaps with `catalog-click-fast-authority.js` and `test-catalog-v2-desktop-structure.js`, which already create and manage `.v2-detail-tabs` and `.v2-detail-scroll-panel`.
- It has its own active state and render path.
- It selects `#catalogGrid .unitCard.v2-selected` or falls back to first `#catalogGrid .unitCard`.
- It has a document-wide MutationObserver on `document.documentElement`.

Recommendation:

- Treat this as a conflict candidate.
- Do not build new features here.
- If desktop sidebar detail duplication or stale detail panel appears, retire this or make it visual-only.

---

## 4. Catalog mobile ownership

### 4.1 `test-catalog-v2-mobile-force.js` = major mobile card layout override

Owner:

- Mobile-only final runtime visual override.
- Mobile card order:
  - portrait
  - name
  - title
  - state bubbles
  - switch badge
  - badges
  - stats
- Injects CSS via JS.
- Cleans generic leader text.

Connected to:

- `#catalogGrid`
- `.unitCard`
- `.unitLeft`, `.unitThumb`, `.meta`, `.metaHeader`, `.metaMain`
- `.nameBlock`, `.unitName`, `.unitTitle`
- `.stateRow`, `.stateBtn`
- `.duoFormBtn`
- `.chipCol .tag`
- `.unitDetails`, `.leaderBlock`, `.statLine`

Known risk:

- Has a grid MutationObserver to reinject styles and clean generic leader text.
- Can override other mobile CSS because it uses many `!important` rules.

Use this for:

- mobile card layout order
- mobile portrait sizing
- mobile name/title placement
- mobile card badge/stat order

Do not use this for popup detail behavior.

---

### 4.2 `test-catalog-v2-detail-fix.js` = mobile popup behavior + separation

Owner:

- Strict desktop/mobile detail separation.
- Desktop hides card detail buttons.
- Mobile shows detail button / tapping card opens popup.
- Builds and opens `.v2-detail-backdrop` popup.
- Handles popup awaken buttons.
- Handles popup Leader/Active/Passive/Description section open state.
- Handles popup close/escape.

Connected to:

- `catalog-v2-lite.js` generated `.v2-detail-backdrop`
- `.v2-detail-card`
- `.v2-detail-section`
- `.v2-detail-tab`
- `.v2-detail-panel`
- `.stateRow .stateBtn`
- host `.unitCard`

Use this for:

- mobile popup not opening
- Details button missing on mobile
- popup awaken buttons not updating image
- popup detail tabs not opening/populating
- popup selected tab visual state

Do not use this for desktop sidebar.

---

### 4.3 `test-catalog-v2-mobile-detail-badge-tabs.js` = final mobile popup/card guard

Current role after recent change:

- Mobile-only popup/card guard.
- No MutationObserver.
- No data fetch.
- Forces Details button visible on mobile.
- Forces card awaken bubbles horizontal.
- Forces popup awaken bubbles horizontal.
- Keeps title under name.
- Handles detail button click and popup state/tab sync.

Connected to:

- `#catalogGrid .unitCard .v2-detail-btn`
- `.v2-detail-backdrop .stateRow .stateBtn`
- `.v2-detail-backdrop .v2-detail-section > .v2-detail-tab`

Use this for:

- final mobile popup/card guard issues
- mobile Detail button visibility
- horizontal mobile awaken states
- popup section active visuals

Do not use this for desktop.

---

### 4.4 `test-catalog-v2-mobile-detail-toggle-fix.js`

Owner:

- Mobile-only detail section toggle guard.
- Intercepts `.v2-detail-section > summary` and `.v2-detail-tab` inside popup.
- Toggles the native `details.open` state.

Connected to:

- `.v2-detail-backdrop`
- `.v2-detail-section`
- `.v2-detail-panel`

Potential overlap:

- Overlaps with `test-catalog-v2-detail-fix.js` and `test-catalog-v2-mobile-detail-badge-tabs.js` for popup tab behavior.
- If popup tabs double-toggle or close immediately, inspect this file first.

---

### 4.5 `test-catalog-v2-mobile-standalone.js`

Owner:

- Mobile-only hides `.v2-main > .v2-hero`.
- Desktop re-shows `.v2-main > .v2-hero`.

Connected to:

- `.v2-main > .v2-hero`

Use this if:

- mobile shows desktop selected-sidebar hero
- desktop hero is hidden incorrectly

---

### 4.6 `test-catalog-v2-mobile-leader-fix.js`

Owner:

- Mobile-specific leader text/detail adjustments.

Use this only for:

- mobile leader skill display issues
- mobile card/popover leader text quirks

---

## 5. Catalog badge/state helpers

### 5.1 `test-catalog-v2-source-badge-authority.js`

Owner:

- Lightweight badge/state authority.
- Hides state rows for weapons/accessories.
- Removes weapon/accessory element tags.
- Controls hidden state buttons based on rarity/image count.
- Sets smart state count.

Connected to:

- `.unitCard[data-kind="weapons"]`
- `.unitCard[data-kind="accessories"]`
- `.tag.element`
- `.stateRow .stateBtn`
- `#v2AwakenTabs`
- `#v2Pills`

Use this for:

- weapons/accessories showing character state buttons
- non-character entries showing element tags incorrectly
- SSR/SR/N state count visibility

Do not use this for active selected-state visual styling. That is page/CSS/desktop sidebar authority.

---

### 5.2 `test-catalog-v2-duo-badge-labels.js`

Owner:

- Visual label helper for `.duoFormBtn`.
- Changes button text to the next form's clean name.

Connected to:

- `.duoFormBtn[data-duo-forms]`
- `catalog-v2-lite.js` duo form rendering

Known risk:

- Has a `MutationObserver` on `#catalogGrid`.

Use this only for:

- parent/child badge label text
- duo button label not matching next form

---

### 5.3 `catalog-force-sort.js`

Owner:

- Forces visible catalog card order.
- Defaults first Catalog load to Characters.
- Injects runtime title-stack styling.

Connected to:

- `#catalogGrid`
- `#catalogSort`
- `#catalogType`
- `#catalogSearch`
- `.unitCard`
- `.unitName`, `.unitTitle`, `.nameBlock`

Known risk:

- Mutates card DOM order by reappending `.unitCard` nodes.
- Uses a `MutationObserver` on `#catalogGrid`.
- Injects padding into `.nameBlock` that may affect visual placement.

Use this for:

- visible sort order wrong
- default filter type wrong
- title/name stacking if no other file owns it

Do not use this for active state badges or sidebar behavior.

---

### 5.4 `test-catalog-v2-clean-generic-leader.js`

Owner:

- Removes fake/default leader text.
- Cleans generic leader description text in `#v2Desc`.

Connected to:

- `.leaderBlock`
- `#v2Desc`
- `#catalogGrid`

Known risk:

- Has a `MutationObserver` on `#catalogGrid`.

Use this only for:

- fake leader skill text appearing
- default generic leader text leaking into cards/sidebar

---

## 6. Retired/no-op files in Catalog stack

### 6.1 `test-catalog-v2-final-awaken-controller.js`

Current role:

- Disabled/no-op.
- Previous duplicate awaken controller.
- Do not reactivate unless explicitly replacing current architecture.

### 6.2 `test-catalog-v2.js`

Current role:

- Retired/no-op legacy bridge.
- Do not build new behavior here.

### 6.3 `test-catalog-v2-state-descriptions.js`

Current role:

- Retired/no-op legacy description hydrator.
- Do not build new behavior here.

### 6.4 `test-catalog-v2-selected-detail-stability.js`

Current role:

- Disabled/no-op from prior performance pass.
- Do not reactivate unless intentionally restoring that behavior.

---

## 7. Shared visual/theme CSS ownership

### 7.1 `style.css`

Owner:

- Global base UI: page, topbar, tabs, panels, cards, generic layout.

Connected to:

- Catalog, Roster, Optimizer.

Use this for:

- site-wide UI change that should affect every page.

Do not use this for Catalog-only card fixes.

---

### 7.2 `element-watermark.css`

Owner:

- Element visual/watermark layer.

Connected to:

- element classes such as `.el-fire`, `.el-water`, `.el-storm`, `.el-earth`, `.el-light`, `.el-dark`.

Use this for:

- element watermark appearance
- element tinting shared across pages

---

### 7.3 `test-catalog-v2.css`

Owner:

- Base Catalog V2 layout and card style.

Use this for:

- Catalog base card styles if not desktop-only or mobile-only.

---

### 7.4 `test-catalog-v2-elements.css`

Owner:

- Catalog element-specific styling.

Use this for:

- Fire/Water/Storm/Earth/Light/Dark card visuals.

---

### 7.5 `test-catalog-v2-theme.css`

Owner:

- Catalog full-page theme layer.
- Topbar/theme colors/glass panels.
- Base tag/stat/awaken button look.

Connected to:

- `.page-catalog-v2`
- `.v2-sidebar`, `.v2-panel`, `.v2-grid-panel`
- `.v2-pill`, `.tag`, `.v2-stat`, `.leaderBlock`, `.statLine`
- `.v2-awaken-tabs button`, `.stateBtn`

Use this for:

- Catalog-wide visual theme
- general tag/stat/state button appearance

Do not use for one-off urgent cache fixes; use `index.html` inline lock only as a last resort.

---

### 7.6 `test-catalog-v2-mobile.css`, `test-catalog-v2-mobile-fluid.css`, `test-catalog-v2-mobile-detail.css`

Owner:

- Mobile Catalog card and popup visual rules.

Use these for:

- mobile CSS-only issues
- mobile responsive layout
- mobile detail popup visual spacing

Check runtime JS overrides before changing these, because `test-catalog-v2-mobile-force.js` can override them with injected `!important` CSS.

---

### 7.7 `test-catalog-v2-layout-refine.css`, `test-catalog-v2-visual-fix.css`, `test-catalog-v2-duo-badges.css`, `test-catalog-v2-skill-expand.css`

Owner:

- Targeted Catalog refinements.

Use:

- `test-catalog-v2-duo-badges.css`: parent/child/duo badge visuals.
- `test-catalog-v2-skill-expand.css`: skill expansion visuals.
- `test-catalog-v2-layout-refine.css`: layout refinement.
- `test-catalog-v2-visual-fix.css`: visual correction patches.

Before changing any of these, check whether a newer runtime JS file is overriding the same selector.

---

## 8. Roster page ownership

### 8.1 `app.js` = Roster behavior authority

Owner:

- Loads roster characters from `EvertaleData.loadCharactersMerged()`.
- Renders `#unitGrid`.
- Owns `Owned` checkboxes.
- Tap card toggles owned.
- Long-press drag toggles multiple cards.
- Search/filter/list paste handling.
- Mobile compact/detailed class.

Writes:

- `localStorage.evertale_owned_units_v1`
- `localStorage.evertale_owned`
- `localStorage.evertale_mobile_view_v1`

Exports:

- `window.__evertaleRosterState`
- `window.renderImageStateControls`

Connected to:

- `roster-profile-store.js`
- `roster-profile-ui.js`
- Optimizer through shared owned localStorage

Use this for:

- owned card selection problems
- roster search/filter problems
- roster card rendering problems
- compact/detailed toggle behavior

Do not use for Optimizer output layout.

---

### 8.2 `roster-profile-store.js`

Owner:

- LocalStorage profile state.
- Account defaults.
- Roster stat estimation fallback.
- Applies `runtime-stat-engine.js` if available.

Exports:

- `window.EvertaleRosterProfiles`

Storage:

- `evertale_roster_profiles_v1`

Important math currently inside:

- awakening multipliers
- boost flat values
- level/limit-break multiplier
- fellowship account defaults
- fallback estimated HP/ATK/power

Use this for:

- profile save/load
- profile import/export
- roster stat estimate issues
- account/fellowship settings

---

### 8.3 `runtime-stat-engine.js`

Owner:

- More accurate stat calculation engine.
- Used by `roster-profile-store.js` when available.

Use this for:

- correcting the actual stat math engine.

Do not patch fallback math in `roster-profile-store.js` if runtime engine owns the real calculation.

---

### 8.4 `roster-profile-ui.js`

Owner:

- UI controls for roster profile editing.
- Reads/writes through `window.EvertaleRosterProfiles`.

Use this for:

- profile UI layout
- profile controls not saving
- profile import/export controls

---

## 9. Optimizer page ownership

### 9.1 `optimizer.js` = Optimizer DOM/page authority

Owner:

- Reads owned IDs from Roster localStorage.
- Loads characters.
- Reads/writes team layout.
- Reads/writes slot locks.
- Owns story/platoon/storage DOM render.
- Handles buttons:
  - `#buildBest`
  - `#buildExample`
  - `#clearTeams`
  - `#modeStory`
  - `#modePlatoons`
  - lock/unlock buttons
- Reads optimizer runtime equipment if available.

Storage:

- `evertale_team_layout_v1`
- `evertale_optimizer_teamType_v1`
- `evertale_optimizer_preset_v1`
- `evertale_optimizer_slotLocks_v1`
- `evertale_optimizer_primaryArchetype_v1`
- `evertale_optimizer_secondaryArchetype_v1`

Connected to:

- `optimizerEngine.js`
- `optimizerEngineV2.js`
- `optimizer-hook.js`
- `abilityScoreEngine.js`
- `optimizerRuntimeLoader.js`
- `roster-profile-store.js`

Use this for:

- story team layout bugs
- platoon layout bugs
- storage pool bugs
- lock button behavior
- owned units not appearing
- build button not refreshing DOM

---

### 9.2 `optimizerEngine.js`

Owner:

- Main scoring/building engine.
- Exposes `window.OptimizerEngine.run(ownedUnits, options)`.
- Uses `window.OPTIMIZER_DOCTRINE`.
- Expands tags and synergy tags.
- Scores team composition.

Connected to:

- `optimizer_doctrine.js`
- `abilityScoreEngine.js`
- `optimizerEngineV2.js`
- `optimizer-hook.js`
- `optimizer.js`

Use this for:

- optimizer choosing bad units
- tag/synergy scoring issues
- mono/rainbow/preset logic

Do not use for DOM slot layout.

---

### 9.3 `optimizer_doctrine.js`

Owner:

- Optimizer doctrine/weights/config.

Use this for:

- changing scoring policy or priority weights without changing engine code.

---

### 9.4 `abilityScoreEngine.js`

Owner:

- Ability-level scoring.

Use this for:

- correcting individual skill/passive valuation.

---

### 9.5 `optimizerEngineV2.js` and `optimizer-hook.js`

Owner:

- V2 optimizer integration/hooks around the base engine.

Use these for:

- upgraded engine integration bugs
- hook behavior around build process

---

### 9.6 `optimizerRuntimeLoader.js`

Owner:

- Runtime chunk loading from `./apkfiles/entries/runtime`.
- Exposes:
  - `window.OptimizerRuntime`
  - `window.loadOptimizerRuntime(options)`
  - `window.loadOptimizerRuntimeChunk`
- Loads fast chunks `weapons` and `accessories` when called with `skipHeavy:true`.
- Avoids duplicate concurrent runtime fetches.

Connected to:

- `optimizer.js`
- `optimizerRuntimeBootstrap.js`
- `optimizer-showcase.js`
- runtime JSON manifest/chunks

Use this for:

- runtime status stuck loading
- weapons/accessories not pairing
- runtime manifest/chunk fetch issues

---

### 9.7 `optimizerRuntimeBootstrap.js`

Owner:

- Starts or finalizes optimizer runtime loading/bootstrap.

Use this when runtime loads but does not attach to the page.

---

### 9.8 `optimizer-showcase.js`

Owner:

- Optimizer visual/showcase presentation layer.

Use this for optimizer presentation-only issues.

---

## 10. Data files and generated paths

Primary generated paths:

```text
./apkfiles/entries/bundles/catalog.bundle.json
./apkfiles/entries/bundles/characters.bundle.json
./apkfiles/entries/bundles/weapons.bundle.json
./apkfiles/entries/bundles/accessories.bundle.json
./apkfiles/entries/bundles/bosses.bundle.json
./apkfiles/entries/bundles/character_families.bundle.json
./apkfiles/entries/maps/explorer_character_order.json
./apkfiles/entries/maps/character_image_map.json
./apkfiles/entries/maps/character_parent_child_map.json
./apkfiles/entries/localization/localizable_groups.json
./apkfiles/entries/runtime/optimizer_runtime_manifest.json
```

Image paths:

```text
https://ik.imagekit.io/r8fsa98s9/characters/{SourceId}.png
https://ik.imagekit.io/r8fsa98s9/weapons/{SourceId}.png
https://ik.imagekit.io/r8fsa98s9/accessories/{SourceId}.png
```

Duo fallback paths:

```text
./apkfiles/Duo.json
./apkfiles/DuoDisplay.json
```

---

## 11. Request routing guide

### Catalog desktop

| User says | Look here first | Then check |
|---|---|---|
| desktop sidebar wrong character | `catalog-click-fast-authority.js` | `test-catalog-v2-desktop-structure.js` |
| desktop awaken changes wrong card | `catalog-click-fast-authority.js` | `test-catalog-v2-desktop-structure.js` legacy proxy functions |
| desktop sidebar tab text wrong | `catalog-click-fast-authority.js` | `test-catalog-v2-sidebar-detail-buttons.js` conflict |
| desktop sidebar visual layout | `test-catalog-v2-desktop-sidebar-authority.js` | `test-catalog-v2-desktop-structure.js` |
| desktop card badge visual state | `index.html` inline desktop lock or `test-catalog-v2-theme.css` | `catalog-click-fast-authority.js` if active class missing |
| desktop card layout/columns | `index.html` inline desktop lock | `test-catalog-v2-desktop-structure.js` |

### Catalog mobile

| User says | Look here first | Then check |
|---|---|---|
| mobile card order wrong | `test-catalog-v2-mobile-force.js` | `test-catalog-v2-mobile-fluid.css` |
| mobile title/name placement wrong | `test-catalog-v2-mobile-force.js` | `catalog-force-sort.js`, `test-catalog-v2-mobile-detail-badge-tabs.js` |
| Details button missing | `test-catalog-v2-detail-fix.js` | `test-catalog-v2-mobile-detail-badge-tabs.js` |
| popup does not open | `test-catalog-v2-detail-fix.js` | `catalog-v2-lite.js` popover markup |
| popup awaken buttons broken | `test-catalog-v2-detail-fix.js` | `test-catalog-v2-mobile-detail-badge-tabs.js` |
| popup tabs do not open | `test-catalog-v2-detail-fix.js` | `test-catalog-v2-mobile-detail-toggle-fix.js` |
| mobile awaken bubbles vertical | `test-catalog-v2-mobile-force.js` | `test-catalog-v2-detail-fix.js`, `test-catalog-v2-mobile-detail-badge-tabs.js` |

### Catalog data/render

| User says | Look here first | Then check |
|---|---|---|
| card missing from catalog | `data-loader.js` | generated bundle/map files |
| wrong newest/oldest order | `catalog-force-sort.js` | `catalog-v2-lite.js` sort |
| wrong images/states | `data-loader.js` image variant logic | `character_image_map.json`, `catalog-v2-lite.js` |
| parent/child forms wrong | `catalog-v2-lite.js` duo registry | `character_parent_child_map.json`, `test-catalog-v2-duo-badge-labels.js` |
| weapons/accessories have states | `test-catalog-v2-source-badge-authority.js` | `catalog-v2-lite.js` |

### Roster

| User says | Look here first | Then check |
|---|---|---|
| owned units not saving | `app.js` | localStorage keys |
| roster card layout | roster CSS files | `app.js` render markup |
| profile stats wrong | `runtime-stat-engine.js` | `roster-profile-store.js` fallback |
| profile UI broken | `roster-profile-ui.js` | `roster-profile-store.js` |

### Optimizer

| User says | Look here first | Then check |
|---|---|---|
| owned units missing in optimizer | `optimizer.js` | `app.js` owned localStorage |
| story/platoon layout broken | `optimizer.js` + optimizer CSS | `optimizer-showcase.js` |
| optimizer picks bad units | `optimizerEngine.js` | `optimizer_doctrine.js`, `abilityScoreEngine.js`, `optimizerEngineV2.js` |
| runtime stuck loading | `optimizerRuntimeLoader.js` | `optimizerRuntimeBootstrap.js`, runtime manifest |
| slot locks broken | `optimizer.js` | `evertale_optimizer_slotLocks_v1` |

---

## 12. Known conflict/risk registry

High-risk overlap files:

1. `test-catalog-v2-sidebar-detail-buttons.js`
   - Duplicates desktop detail tab/panel behavior.
   - Has document-wide MutationObserver.
   - Can conflict with `catalog-click-fast-authority.js`.

2. `test-catalog-v2-desktop-structure.js`
   - Contains old synthetic awaken functions.
   - Keep behavior ownership in `catalog-click-fast-authority.js`.

3. `test-catalog-v2-mobile-detail-toggle-fix.js`
   - May double-toggle popup tabs alongside `test-catalog-v2-detail-fix.js` / `test-catalog-v2-mobile-detail-badge-tabs.js`.

4. `test-catalog-v2-mobile-force.js`
   - Strong mobile CSS injection can override mobile stylesheets.

5. `catalog-force-sort.js`
   - Reorders DOM and injects title-stack style.
   - Can affect selection if another script assumes card order is stable.

6. `test-catalog-v2-duo-badge-labels.js`
   - Has grid MutationObserver and changes `.duoFormBtn` text.

7. `test-catalog-v2-clean-generic-leader.js`
   - Removes `.leaderBlock` nodes.
   - If leader skill disappears, check this before data-loader.

---

## 13. Current preferred ownership model

```text
Catalog data loading
  live-data-config.js
  data-loader.js
  leader-skill-resolver.js
  test-catalog-v2-state-preprocess.js

Catalog grid render
  catalog-v2-lite.js

Catalog desktop sidebar behavior
  catalog-click-fast-authority.js

Catalog desktop layout/visual shell
  test-catalog-v2-desktop-structure.js
  test-catalog-v2-desktop-sidebar-authority.js
  index.html inline hard desktop lock only as emergency visual/cache override

Catalog mobile card layout
  test-catalog-v2-mobile-force.js
  test-catalog-v2-mobile.css
  test-catalog-v2-mobile-fluid.css

Catalog mobile popup behavior
  test-catalog-v2-detail-fix.js
  test-catalog-v2-mobile-detail-badge-tabs.js
  test-catalog-v2-mobile-detail-toggle-fix.js

Roster
  app.js
  roster-profile-store.js
  runtime-stat-engine.js
  roster-profile-ui.js

Optimizer
  optimizer.js
  optimizerEngine.js
  optimizerEngineV2.js
  optimizer-hook.js
  abilityScoreEngine.js
  optimizerRuntimeLoader.js
  optimizerRuntimeBootstrap.js
  optimizer-showcase.js
```

---

## 14. Before-edit checklist

Before touching code:

1. Identify page: Catalog, Roster, or Optimizer.
2. Identify device: desktop or mobile.
3. Identify class/DOM node from the screenshot or bug report.
4. Use request routing table above.
5. Check conflict/risk registry.
6. Change the smallest owning file only.
7. Do not change renderer/data if bug is visual-only.
8. Do not change layout if bug is behavior-only.
9. Update this map if ownership changes.
