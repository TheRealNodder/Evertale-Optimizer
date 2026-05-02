# apkfiles Extracted Structure

This folder is the sandbox staging area for unzipping and exposing generated catalog files. Live website files are not touched.

## Folder Layout

```text
apkfiles/
  raw/
    Monster.json
    Weapon.json
    Equipment.json
    Boss.json
    GCodes.json
    AbilityConfig.json
    AbilityEffect.json
    AbilityComponent.json
    AttackScalor.json
    TargetingData.json
    Buff.json
    MonsterConditions.json
    AbilityAI.json
    AbilityAISequence.json
    AIThreat.json
    BattleBehavior.json

  entries/
    characters/
    weapons/
    accessories/
    bosses/
    gcodes/

  CatalogOrder/
    character_order.txt
    weapon_order.txt
    accessory_order.txt
    boss_order.txt
    gcode_order.txt

  maps/
    characters_image_map.json
    weapons_image_map.json
    accessories_image_map.json
    bosses_image_map.json
    character_logic_map.json
    character_optimizer_tag_map.json
    optimizer_tag_map.json
    optimizer_skill_tag_rules.json
    catalog_manifest.json

  bridge/
    optimizer_manifest.json
    character_resolver_schema.json
    dependency_manifest.json
    website_expected_fields.json

  reports/
    bridge_compatibility_report.txt
    character_resolver_report.txt
    missing_images.txt
    missing_tags.txt
    unresolved_character_refs.txt
    unresolved_optimizer_refs.txt

  bundles/
    MonsterEntries.zip
    WeaponEntries.zip
    EquipmentEntries.zip
    BossEntries.zip
    GCodesEntries.zip
    ProcessedCatalogBundle.zip
    CharacterMappingBundle.zip
```

## Rule

ZIP files are archive/source bundles. The extracted folders are the reviewable working files.

## Next Step

Expose the zip contents into `entries/`, `CatalogOrder/`, `maps/`, and `reports/`, then run validation against `dependency_manifest.json`.
