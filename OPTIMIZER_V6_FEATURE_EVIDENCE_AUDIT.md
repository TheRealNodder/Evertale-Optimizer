# Optimizer V6 Feature Evidence Audit

Date: 2026-07-11  
Branch: `main`  
Baseline: `383b7b8235e470b91ebd2d30d304e1465012ee8b`

## Outcome

The optimizer no longer derives team mechanics from arbitrary nested substrings. AI target hints, immunity lists, negative conditions, `healthy`, and Frostburn no longer invent normal status setup/payoff or role evidence. Direct skill/passive evidence remains authoritative across all six elements.

The imported roster now maps all 63 owned units. A reciprocal parent/child authority previously hid both Frankenstein and Mary; the generator now keeps the explicit `DuoDisplay.parentCards` direction, and the frontend revalidates the generated map instead of retaining a stale cached copy.

## Evidence counts

| Authority | Before | After |
| --- | ---: | ---: |
| Character families | 426 | 426 |
| Character form entries | 747 | 747 |
| Entries with feature evidence | 747 | 741 |
| Feature evidence records | 4,181 | 3,072 |
| `applies_burn` | 14 | 92 |
| `payoff_stun` | 442 | 65 |
| `role_healer` | 525 | 328 |
| `summon` | 747 | 149 |
| Suspicious feature sources | not reported | 0 |

Before the repair, `applies_burn` was Fire 4, Water 8, Light 2. After the repair it is Fire 80, Light 8, Storm 2, Dark 2, Water 0. This is not an element whitelist: cross-element direct mechanics remain valid, while element alone cannot create a status engine.

Curated tags remain empty (`usesTags: false`). The runtime truthfully uses 3,072 generated skill/passive evidence records instead.

## Imported-roster browser audit

| Plan | Format | Direct contributors | Score | Elements |
| --- | --- | ---: | ---: | --- |
| Burn | mono | 8/8 | 85.654 | Fire |
| Poison | rainbow | 7/8 | 85.313 | Dark, Light, Fire, Storm |
| Sleep | rainbow | 6/8 | 84.932 | Water, Fire, Storm, Light, Dark |
| Stun | mono | 7/8 | 86.143 | Storm |
| Blood | rainbow | 7/8 | 84.725 | Water, Dark, Storm, Light |
| Crisis | rainbow | 3/8 (all 3 available) | 71.477 | Storm, Water, Dark, Fire, Light |
| Survivor | rainbow | 4/8 (all 4 available) | 75.063 | Storm, Dark, Earth, Fire |

Burn Story result:

`FreyaNew`, `MyshaDark`, `SatanRegular`, `AstridNew`, `FreyaRegular`, `BurnedGirlRegular`, `NobunagaRegular`, `DonQuixoteRegular`

All eight are Fire and all eight directly contribute to the Burn plan. V6 was the public engine, `usedFallback` was false, all 63 imported profiles mapped, and the browser console had no warnings or errors.

## Verification

- `python tools/new_structure/MASTER_CONTROL.py --no-gui`: passed; supported full rebuild completed.
- `node tools/run_optimizer_v6_foundation_tests.js`: 24/24 passed (13 foundation, 6 Story, 5 Platoon).
- `python tools/new_structure/test_optimizer_foundation_authorities.py`: 9/9 passed.
- `python tools/new_structure/validate_entries.py`: 2,115 entries checked, 0 errors, 938 pre-existing metadata/order warnings.
- `node tools/validate-current-runtime.js`: passed.
- `node tools/validate-recovered-formulas.mjs`: passed.
- `python -m unittest discover -s services/strategy-research/tests -p 'test_*.py'`: 5/5 passed.
- Live browser: 397 playable parent cards, 63/63 imported owned units, V6 active, no V4 fallback, no console warnings/errors.

## Remaining warnings

- Curated tag files are empty or absent; generated evidence is the active and truthful authority.
- Six simple/training forms have no modeled strategic feature evidence and continue to receive only their normal stat/base value.
- The semantic validator reports 938 existing missing-title/order warnings; it reports zero errors and zero context-invalid feature records.
- Formula validation emits Node's existing package-module-type performance warning; formula results pass.

Stat formulas, roster profile calculations, team sizes, locks, identity guards, image handling, and unrelated layout/UI behavior were not changed. No V4 fallback was introduced or invoked.
