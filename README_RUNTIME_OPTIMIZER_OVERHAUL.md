# Runtime Optimizer Overhaul Checkpoint

This build wires the GitHub project to the real runtime architecture discovered from the decompiled Evertale core runtime.

## What changed

- Added `runtime-stat-engine.js`.
  - Central runtime-style stat engine.
  - Mirrors the decompiled architecture: `MonsterInstance` cached stats, training state, limit break tiers, awakening, potential, stat pluses, fellowship, rank BP.
  - Keeps all raw APK files read-only.
- Rebuilt `apkfiles/derived/character-seed-index.json`.
  - 733 raw character forms.
  - 419 character families.
  - Fast lookup for sourceId/family/baseAttack/baseMaxHp/speed/cost.
- Added `apkfiles/derived/runtime-engine-class-map.json`.
  - Captures the important runtime class/method/field map from the decompiled core runtime.
- Patched `roster-profile-store.js`.
  - Uses `window.EvertaleRuntimeStatEngine.calculateUnit()` when available.
  - Falls back to the previous estimator safely.
- Patched `roster-profile-ui.js`.
  - Loads the derived seed index once and refreshes previews.
- Patched `roster.html` and `optimizer.html`.
  - Loads `runtime-stat-engine.js` before roster profile storage.

## Confirmed runtime architecture

From the decompiled runtime:

```text
MonsterInstance
→ cachedStats
→ ValueForCachedStat(...)
→ Monster.CalculateStat(...)
→ WeaponInstance / EquipmentInstance
→ MonsterUnitTrainingState
→ LimitBreakHelper
→ MonsterRanker
```

The website should follow the same pattern:

```text
raw apkfiles/entries
→ derived runtime lookup
→ local roster profile state
→ runtime stat engine
→ optimizer scoring
```

## Important note

The level/stat engine is now centralized, but exact native formulas are still marked estimated unless a unit has calibrated anchors.
The UI should present this as accurate architecture with WIP exact level math.
