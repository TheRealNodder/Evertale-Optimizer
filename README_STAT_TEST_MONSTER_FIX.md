# Stat Test Monster.json Fix

## What changed

- `stat-test.html` now reads live raw character data directly from `/apkfiles/Monster.json`.
- The APK fields `baseMaxHp` and `baseAttack` are now displayed as raw APK stats, not silently treated as `RefStat200`.
- Added an in-game observed calibration panel.
- Added a `Calibrate RefStat200` button that solves the hidden RefStat200 HP/ATK anchors from the actual game card values.
- Preserved the official split-track engine:
  - flat boosts + fellowship before percentage multipliers
  - mastery uses the unawakened anchor
  - awakening only affects visible card stats
  - ascension adds 5% of RefStat200 at the end
  - equipment stays isolated from character scaling

## Why the previous numbers did not match

The page was using Venus `baseMaxHp = 7700` and `baseAttack = 1344` from the APK entry as if they were the final level-200 reference anchors. They are not the same thing as the formula's required `RefStat200` values.

That caused the page to calculate roughly:

- HP: `54,663`
- ATK: `11,869`
- Power: `1,406,301`

while the game screenshot showed much higher values.

## How to use

1. Open `stat-test.html`.
2. Select Venus or another character.
3. Enter the exact in-game card values into:
   - Observed Game HP
   - Observed Game ATK
   - Observed Game Power
4. Press `Calibrate RefStat200`.
5. The page will solve the hidden RefStat200 HP/ATK values and recalculate.

## Notes

The calibration flow is the safest way forward until the exact APK field that maps to RefStat200 is identified for every character. `Monster.json` is still the correct raw source, but `baseMaxHp` and `baseAttack` should be treated as raw APK fields, not the master formula anchor.
