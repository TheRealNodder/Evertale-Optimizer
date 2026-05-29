# Ludmilla / Ballet Entry Active Skill Fix

## What changed

This patch uses the `tools/new_structure` pipeline instead of hand-editing runtime output.

Fixes:
- Repairs the Ballet Ludmilla / Clarice family metadata.
- Keeps `LudmillaBallet03` and `YandereMaidBallet03` as final-art states while using `02` as the real data source.
- Repairs missing active-skill localization for `YandereMaidBallet` by aliasing the matching Ludmilla Ballet skill text while preserving the Yandere raw ability/config IDs.
- Regenerates character families, character image map, tags, entry bundles, and catalog bundle.
- Removes stale `force-cache` usage for `character_families.bundle.json` in `data-loader.js`.

## Command used

```bash
python tools/new_structure/repair_ballet_active_skills.py
```

That script then runs:

```bash
python tools/new_structure/sync_category_order_canonical.py
python tools/new_structure/build_character_image_map.py
python tools/new_structure/sync_character_tags.py
python tools/new_structure/build_entry_bundles.py
python tools/new_structure/validate_entries.py
```

## Validation

Validation passed:
- characters: 737
- weapons: 326
- accessories: 106
- bosses: 413
- errors: 0
- warnings: 0

## Confirmed fixed entries

- `0734_LudmillaBallet01.json`
- `0735_LudmillaBallet02.json`
- `0736_YandereMaidBallet01.json`
- `0737_YandereMaidBallet02.json`

Confirmed active skill names:
- Quick Strike
- Elegant Thrust
- Deadly Dance
- Lead the Dance

