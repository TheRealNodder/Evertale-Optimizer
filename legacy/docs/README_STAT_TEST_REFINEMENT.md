# Stat Test Refinement: APK Raw Stats, RefStat200, and Locked Platoon Power

## Files changed

- `stat-test.html`
- `tools/stat-engine.js`

## What was wrong

The calculator was treating APK raw character stats from `apkfiles` as if they were `RefStat200`.

Example from Venus:

- APK raw HP: `7700`
- APK raw ATK: `1344`

Those values are not the engine's `RefStat200` anchors. They are the raw APK/library stat layer. When they are pasted directly into `RefStat200`, the card stats collapse too low.

The refined flow is now:

```text
APK raw HP/ATK
→ APK-to-RefStat200 estimate or observed-stat calibration
→ RefStat200
→ level curve
→ boost flats
→ fellowship flats
→ potential / awakening / ascension
→ card HP/ATK
→ equipment + locked platoon power
```

## New behavior

### 1. APK raw stats are displayed separately

`stat-test.html` now has read-only fields for:

- APK raw HP
- APK raw ATK

These are loaded from the selected character but are no longer treated as exact `RefStat200`.

### 2. RefStat200 can be derived safely

Two buttons were added:

- **Derive RefStat200 from APK estimate**
- **Calibrate RefStat200 from observed HP/ATK**

The calibration path is preferred when you have an in-game screenshot.

For Venus, the validated calibration values are approximately:

```text
RefStat200 HP ≈ 26832.823942
RefStat200 ATK ≈ 3707.548389
```

### 3. Observed stat comparison was added

The page now accepts:

- Observed in-game HP
- Observed in-game ATK
- Observed in-game Unit Power

The result cards show exact match or delta against observed values.

### 4. Locked platoon / weapon power support was added

The weapon equipped in the platoon cannot be ignored when comparing against the in-game platoon screen.

The equipment section was renamed to:

```text
Equipment / locked platoon additions
```

It now supports:

- selected weapon stats
- selected accessory stats
- observed Unit Power
- locked platoon BP offset
- **Calibrate BP Offset** button

Use the BP offset only when HP/ATK match but Unit Power still differs.

## Suggested validation workflow

1. Select the character.
2. Enter the in-game level, awakening, boost, potential, mastery, ascension, fellowship, and rank values.
3. Enter observed in-game HP and ATK.
4. Click **Calibrate RefStat200 from observed HP/ATK**.
5. Select or enter the locked weapon stats.
6. Enter observed Unit Power.
7. Click **Calibrate BP Offset** only if HP/ATK already match.

## Important note

Do not overwrite `RefStat200` with APK raw HP/ATK. APK raw values are useful source data, but they are not the same stat layer as the master engine's `RefStat200`.
