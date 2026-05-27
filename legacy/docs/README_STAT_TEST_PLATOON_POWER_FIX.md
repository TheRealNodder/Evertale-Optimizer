# Stat Test Platoon Power Fix

## What changed

Updated `stat-test.html` so the equipment section matches the way the game behaves in platoon view:

- The equipped weapon is treated as a locked platoon addition.
- Weapon HP/ATK are included in Unit Power using the existing engine weights:
  - Weapon HP × 6
  - Weapon ATK × 30
- Added `Observed in-game Unit Power`.
- Added `Locked platoon BP offset`.
- Added a `Calibrate BP Offset` button.

## Why this was needed

After adding the visible weapon stats, Venus matched HP exactly and ATK was only off by 1, but Unit Power was still short by `61,053`.

That means the core card-stat engine is working, and the remaining mismatch is not level/boost/awakening/potential. It is an additional platoon/equipment/hidden BP layer that is attached to the in-game platoon state.

## How to use it

1. Enter the character stats from the game.
2. Enter the visible weapon stats.
3. Enter the in-game Unit Power.
4. Click `Calibrate BP Offset`.

For the Venus test case shown:

```text
Weapon HP: 4875
Weapon ATK: 917
Observed Unit Power: 2155042
```

The inferred locked BP offset should be approximately:

```text
61053
```

## Notes

Do not remove the weapon values unless the weapon is actually removed or changed in the game platoon. The game keeps the weapon attached to the character in platoon context.
