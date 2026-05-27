# Stat Engine Live Migration

## What changed

- Rebuilt `stat-test.html` into a live-ready Master Stat Engine test lab.
- Switched the calculator to load from:
  - `apkfiles/entries/characters/index.json`
  - `apkfiles/entries/weapons/index.json`
  - `apkfiles/entries/accessories/index.json`
- Moved the older experimental `stat-test.html` into:
  - `legacy/stat-test/stat-test.previous.html`
- Added reusable engine reference:
  - `tools/stat-engine.js`

## Formula behavior implemented

The calculator now follows the Ultimate Master Engine specification:

1. Level scaling uses:
   `RawStat = (RefStat200 / 294) * (Level + 10) * MLB`

2. MLB tiering:
   - 1-100: `1.00`
   - 101-120: `1.08`
   - 121-140: `1.16`
   - 141-160: `1.24`
   - 161-180: `1.32`
   - 181-200: `1.40`

3. Boost flat scaling:
   - Boost 0-90: `HP = boost * 14`, `ATK = boost * 3`
   - Boost 91-300: `HP = 1260 + ((boost - 90) * 311)`, `ATK = 270 + ((boost - 90) * 73)`

4. Fellowship flats are applied before percentage/stat power conversion:
   - Default HP: `4900`
   - Default ATK: `750`

5. Mastery is calculated from the unawakened anchor track to avoid awakening double-dipping:
   `MasteryPower = AnchorBasePower * 0.0025 * MasteryLevel`

6. Card stats are calculated on the awakened track:
   - Awakening multipliers: `[1.00, 1.22, 1.44, 1.66, 1.88]`
   - Ascension premium: `5%` of original `RefStat200`, added at the end.

7. Equipment power uses isolated weights:
   - Weapon HP × 6
   - Weapon ATK × 30
   - Accessory HP × 6
   - Accessory ATK × 30
   - Accessory SPD × 180

8. Optional account rank BP uses:
   `RankBP = (2000000 / 27000000) * PlayerRank^3`

## Important note

The APK character `stats.hp` and `stats.atk` values are currently treated as default `RefStat200` inputs. If later validation proves those fields represent a different stat layer, keep the calculator intact and adjust only the adapter that fills `RefStat200`.

## Suggested next steps

- Add a known-good validation fixture file with screenshots/game values.
- Add automated tests comparing expected `cardHP`, `cardATK`, and `unitPower`.
- Add a character stat adapter that clearly labels whether APK stats are RefStat200, base level stats, or display stats.
- Add export/import of stat test presets for sharing calculation cases.
