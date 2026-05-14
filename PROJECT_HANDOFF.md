# Evertale Optimizer Project Handoff

This repository is the GitHub Pages project for the Evertale Optimizer.

## Required Reading Order

Before making any code or data change, read these files in order:

1. `PROJECT_HANDOFF.md`
2. `PATCH_RULES.md`
3. `OPTIMIZER_DOCTRINE.json`
4. `TAGGING_GUIDE.md`

If any canonical file is missing or moved, stop and verify the correct path before patching.

## Primary Goal

Maintain optimizer accuracy and preserve existing functionality while applying only minimal targeted patches.

Core priorities:

- Optimizer logic accuracy
- Team synergy correctness
- Tagging consistency
- Leader skill parsing
- Story team generation integrity: 5 main + 3 backline
- Platoon generation integrity: 20 platoons x 5 units
- Strict schema preservation

UI polish is secondary to optimizer correctness.

## Canonical Data and Logic Sources

Treat these as canonical unless explicitly instructed otherwise:

- `characters.json`
- `OPTIMIZER_DOCTRINE.json`
- `TAGGING_GUIDE.md`
- `data/character_tags.json`
- `data/character_tags_additions.json`
- `apkfiles/entries/` generated/new-structure data

Never mutate character data at runtime.

`leaderSkill` must never be null.

Preserve all tag namespaces and schema structures.

## Current Migration Context

The project is migrating from the legacy optimizer stack into a runtime-aware V2 optimizer architecture.

Current active optimizer page stack:

- `optimizer.html`
- `optimizer.js`
- `optimizerEngine.js` — legacy fallback scorer, still required
- `optimizerEngineV2.js` — runtime-aware bridge, currently active
- `abilityScoreEngine.js` — ability/scaler scoring helper
- `optimizerRuntimeLoader.js` — split runtime loader
- `optimizerRuntimeBootstrap.js` — gates optimizer init until runtime load finishes or safely fails
- `optimizer-hook.js` — legacy wiring bridge, still required during migration
- `optimizer_doctrine.js` — still required by legacy fallback scorer

Do not delete or rename any of those files until a dependency audit confirms they are unused.

## Runtime Data Architecture

The optimizer runtime now uses split runtime chunks under:

`apkfiles/entries/runtime/`

Important runtime files:

- `optimizer_runtime_model.json` — large source runtime model
- `optimizer_runtime_manifest.json` — chunk manifest
- `optimizer_runtime_characters.json`
- `optimizer_runtime_character_entries.json`
- `optimizer_runtime_weapons.json`
- `optimizer_runtime_accessories.json`
- `optimizer_runtime_bosses.json`
- `optimizer_runtime_tags.json`
- `optimizer_runtime_knowledge.json`
- `optimizer_ability_graph.json` — generated ability graph when available

The manifest should expose counts similar to:

- characters: 418
- characterEntries: 318
- weapons: 324
- accessories: 105
- bosses: 290
- tags: 958
- optimizerKnowledge: 3

Counts may change when new game data is added.

## Current Toolchain

Important tools under `tools/new_structure/`:

- `run_entry_pipeline.py`
- `build_entry_bundles.py`
- `build_character_image_map.py`
- `build_optimizer_runtime_model.py`
- `split_optimizer_runtime_model.py`
- `audit_optimizer_sources.py`
- `extract_optimizer_knowledge.py`
- `build_optimizer_ability_graph.py`
- `renumber_entry_files.py`
- `deep_dependency_audit.py`

Recommended runtime rebuild commands:

```powershell
python tools/new_structure/build_optimizer_runtime_model.py
python tools/new_structure/build_optimizer_ability_graph.py
python tools/new_structure/split_optimizer_runtime_model.py
```

Recommended deep cleanup audit command:

```powershell
python tools/new_structure/deep_dependency_audit.py --include-name-hits
```

Do not delete files directly from the dependency audit. Move safe candidates to quarantine first.

## Image Rules

Use ImageKit URLs when applicable:

`https://ik.imagekit.io/r8fsa98s9/`

Image folders:

- `characters/`
- `weapons/`
- `bosses/`
- `UI/`

Treat images as `.png` unless explicitly stated otherwise.

Element UI color scheme:

- Fire = Red
- Water = Blue
- Storm = Yellow
- Earth = Green
- Light = White
- Dark = Purple

## Recent Important Fixes

- Character image map overrides were added for special cases such as:
  - `BeautyBeastRegular`
  - `BeautyRegular`
  - `BeastRegular`
- `character_image_overrides.json` supports manual exact CDN URL overrides.
- `build_character_image_map.py` applies overrides after generated image map creation.
- `build_entry_bundles.py` was fixed to resolve character family paths correctly.
- Bad image cache reset/disable logic was added to avoid stale localStorage image failures.
- Runtime split architecture was added for the optimizer.
- Runtime tags now populate correctly from `data/character_tags.json`, additions, and maps.
- V2 optimizer bridge is active but still uses legacy scorer as compatibility fallback.
- Ability graph and ability power scoring migration has started.

## Cleanup/Migration Direction

The next migration phase should not delete files directly.

Use this staged process:

1. Run `deep_dependency_audit.py --include-name-hits`
2. Review `apkfiles/entries/reports/deep_dependency_audit.json`
3. Move only `unused_candidate_review_before_delete` files into `legacy_unused/`
4. Test GitHub Pages
5. Run another audit
6. Delete only after verified unused from quarantine

Potential future folders:

- `legacy_unused/`
- `legacy_unused/old_optimizer/`
- `legacy_unused/data_json/`
- `legacy_unused/temp/`

Do not move active runtime files, optimizer bridge files, or source data files yet.

## Safety Rule

If unsure whether a file is used, do not delete it. Create an audit report and ask for confirmation before quarantine or deletion.
