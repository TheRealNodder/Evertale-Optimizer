# Original Idea Basis

This project direction is based on the original catalog idea:

- Raw APK JSON data is the source of truth.
- Main website files are not touched until a generated system is verified.
- Every unit, weapon, accessory, and boss is organized through index/order files instead of hardcoded placement.
- File names stay clean and practical.
- Awaken/evolution suffixes such as 01, 02, and 03 belong to forms/images/raw entries, not the clean catalog family name.
- Mapping JSON files translate raw game IDs into website-ready display data.
- New entries are detected and placed at the top of their order file.
- Existing entries keep their established order.
- Anything added later must benefit this basis, not replace it.

## Current Sandbox Rule

`apkfiles/` is the raw/generated sandbox.

Live website files remain untouched unless explicitly approved:

- `data/`
- `index.html`
- `roster.html`
- `optimizer.html`
- `catalog.js`
- `optimizer.js`
- `optimizerEngine.js`
- `style.css`

## Intended Data Flow

```text
Raw APK JSON
  -> split entries
  -> order text files
  -> family/form mapping
  -> image mapping
  -> manifest
  -> website display layer
```

## Required Output Pattern

```text
apkfiles/
  MonsterEntries.zip
  WeaponEntries.zip
  EquipmentEntries.zip
  BossEntries.zip
  ProcessedCatalogBundle.zip
  CharacterMappingBundle.zip

  CatalogOrder/
    character_order.txt
    weapon_order.txt
    accessory_order.txt
    boss_order.txt

  maps/
    characters_image_map.json
    weapons_image_map.json
    accessories_image_map.json
    bosses_image_map.json
    catalog_manifest.json
```

## Implementation Rule

Build tools and generated files first. Only integrate with the live optimizer after reports confirm mappings are complete and safe.
