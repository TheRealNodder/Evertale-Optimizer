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
3. Enter the in-game **white HP/ATK** values.
4. Click **Reverse RefStat200 from WHITE Stats**.
5. Enter the in-game **blue HP/ATK** values.
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
