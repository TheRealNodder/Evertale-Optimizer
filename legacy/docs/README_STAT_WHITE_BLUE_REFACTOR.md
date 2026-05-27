# Stat Test White/Blue Refactor

## Changed files

- `stat-test.html`
- `tools/stat-engine.js`

## What changed

The stat page now separates the two values visible in the game screenshots:

- **White HP/ATK** = character-only stats at the selected level, awakenings, boost, potential, and ascension state.
- **Blue HP/ATK** = white stats plus locked equipment/platoon HP and ATK.

This prevents weapon stats from being mixed into the character stat engine.

## New workflow

1. Select the character.
2. Enter level, awakening orbs, boost, potential, mastery, and ascension.
3. Enter the in-game **white ATK/HP** values exactly as the card shows them: ATK first, HP second.
4. Click **Reverse RefStat200 from WHITE Stats**.
5. Enter the in-game **blue ATK/HP** values if equipment-modified blue values are visible.
6. Click **Derive Equipment from BLUE − WHITE** if you want the page to infer weapon HP/ATK.
7. Compare white stat diffs, blue stat diffs, and Unit Power diff.

## Important discovery implemented

APK raw stats are **not** automatically treated as RefStat200 anymore.

The page shows APK raw HP/ATK for reference, but the hidden RefStat200 value is derived from observed white stats.

## Limit break correction

The level state is now represented as:

```text
1–80    Normal
81–100  Limit Break 1
101–120 Limit Break 2
121–140 Limit Break 3
141–160 Limit Break 4
161–180 Limit Break 5
181–200 Limit Break 6
```

The multiplier values remain:

```text
1–100   1.00
101–120 1.08
121–140 1.16
141–160 1.24
161–180 1.32
181–200 1.40
```

## Reverse formula

```js
RefStat200 =
  (observedWhiteStat - ((boostFlat + fellowshipFlat) * awakening * potentialScalar))
  /
  ((((level + 10) / 294) * limitBreakMultiplier * awakening * potentialScalar) + ascensionRate)
```

Ascension rate is `0.05` when ascended, otherwise `0`.

## Notes

Use **white text** from screenshots for character stat calibration.
Use **blue text** only to validate or infer locked equipment.


## Cleanup check notes

The cleanup issue was not the master formula. The implementation was easy to misuse because the game card displays stats in this visual order:

```text
Attack
HP
Speed
```

Most calculator code and result panels usually use:

```text
HP
ATK
```

That caused Venus-style test values to be entered into the wrong fields, which produced impossible hidden RefStat200 values such as negative HP and huge ATK.

## New guardrails added

- Observed input section now follows the game card order: **ATK first, HP second**.
- Added a **Fix Swapped HP/ATK Inputs** button.
- Reverse and gear-derivation actions now auto-detect likely swapped HP/ATK pairs.
- Added warning text when observed HP is lower than observed ATK.
- Kept internal engine outputs in HP/ATK order so BP formulas remain clean.

## Correct Venus reference example

```text
White ATK: 16054
White HP:  84952

Blue ATK:  16971
Blue HP:   89827

Weapon ATK: 917
Weapon HP:  4875
```

The hidden RefStat200 fields should be derived from the white values only.
