# PATCH_NOTES.md

## Surgical cleanup applied

This patch keeps the uploaded project structure intact and only changes the stat test calculation layer.

### Changed files
- `stat-engine.js`
- `stat-test.html`

### What changed

1. Added a checkpoint-safe `projectWhiteStatFromRef(...)` helper.
   - This mirrors the forward engine exactly.
   - It rounds the visible white card stat before BP weighting.

2. Rebuilt `reverseRefStat200(...)` to avoid mutation drift.
   - It still follows the spec order:
     `RawStat -> Boost/Fellowship -> Potential -> Awakening -> Round`
   - It no longer relies only on a fragile algebraic reverse.
   - It now uses the algebraic result as a seed, then refines by binary search until the forward engine reproduces the observed in-game white stat.

3. Added equipment consistency warnings in `stat-test.html`.
   - If observed blue minus white does not match entered weapon/accessory stats, the page now warns you.
   - This catches mistakes like entering `16504` instead of `16054` for Venus white ATK when blue ATK is `16971` and weapon ATK should be `917`.

4. Kept the white/blue separation intact.
   - White HP/ATK = character-only stats.
   - Blue HP/ATK = white stats + weapon/accessory stats.
   - Equipment still never feeds back into RefStat200.

5. Kept the spec execution order intact.
   - Boost and fellowship are fused into BaseStack before percentage multipliers.
   - Mastery uses the unawakened anchor track.
   - Character BP uses rounded white HP/ATK checkpoints.

## Notes

The page intentionally keeps the game input labels as:
- Observed WHITE ATK — game top stat line
- Observed WHITE HP — game second stat line

because the game card displays ATK first and HP second, while the engine internally computes HP then ATK.

## Validation target

For Venus:
- White HP: `84952`
- White ATK: `16054`
- Blue HP: `89827`
- Blue ATK: `16971`

The blue-white equipment delta should be:
- Weapon HP: `4875`
- Weapon ATK: `917`


## Retry patch applied

This retry stops double-applying the level curve after reverse calibration.

### Important correction

The values shown in the page as hidden stats are now treated as **current-level RawBase anchors**:

```text
RawBase HP/ATK -> + Boost/Fellowship -> Potential -> Awakening -> Round -> White stats
```

The previous retry still treated the solved hidden values like literal `RefStat200` values and then applied:

```text
(ref / 294) * (level + 10) * limitBreakMultiplier
```

again. That under-scaled the character layer and forced a fake platoon offset.

### Current forward model

```js
rawHP = hiddenRawBaseHP;
rawATK = hiddenRawBaseATK;

baseStackHP = rawHP + boostHP + fellowshipHP;
baseStackATK = rawATK + boostATK + fellowshipATK;

whiteHP = Math.round(baseStackHP * awakening * potential) + Math.round(rawHP * 0.05 if ascended);
whiteATK = Math.round(baseStackATK * awakening * potential) + Math.round(rawATK * 0.05 if ascended);

blueHP = whiteHP + weaponHP + accessoryHP;
blueATK = whiteATK + weaponATK + accessoryATK;
```

### Added

- `Calibrate Platoon BP Offset` button.
- Trace now says `Hidden RawBase`, not `RefStat200`.
- The level/limit-break state is preserved for dataset tracking, but it is not re-applied to an already-reversed RawBase.
