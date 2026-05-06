# New Structure Runtime Wiring Plan

## Goal
Move the website fully onto the new APK entry structure without creating separate desktop/mobile data paths.

The site should use one universal data source and one normalized runtime object. Desktop and mobile should only differ through CSS/layout rules.

---

## Final Runtime Architecture

```text
apkfiles/entries/
  characters/
  weapons/
  accessories/
  bosses/
  maps/
  bundles/
  reports/
```

```text
raw APK files
  -> build_apk_entry_folders.py
  -> individual entry JSON files
  -> build_entry_bundles.py
  -> bundled runtime JSON files
  -> data-loader.js
  -> catalog/roster/optimizer renderers
```

---

## Data Loading Rule

`data-loader.js` remains the only data-loader.

It should load in this order:

```text
1. Try bundle files first
2. If a bundle fails, fall back to individual entry index/files
3. If character entry loading fails completely, fall back to legacy data files temporarily
```

Bundle paths:

```text
apkfiles/entries/bundles/characters.bundle.json
apkfiles/entries/bundles/weapons.bundle.json
apkfiles/entries/bundles/accessories.bundle.json
apkfiles/entries/bundles/bosses.bundle.json
```

---

## Character Runtime Shape

Each character card must represent one family, not one awaken form.

Example:

```text
SnowWhiteNew01
SnowWhiteNew02
SnowWhiteNew03
```

must render as:

```text
One Snow White card
```

with:

```text
forms[]
imageVariants[]
statsByForm[]
skillsByForm[]
```

---

## Image State Rules

### SSR

```text
01 = 5 star/base
02 = 6 star/evolved
03 = final awakened
```

### SR

```text
01 = 3 star/base
02 = 4 star/evolved
```

### N/R

```text
01 only
```

Image variants should be generated from the family name, not only from whichever form files are present.

---

## Stats and Skill Rules

- Each awaken state keeps its own stats.
- Each awaken state keeps its own active skills/passives.
- Base state may hide the last four passives when they exist.
- Final state must show all active skills and all passives.
- The merged card may default to strongest/final stats for optimizer logic, but UI must have access to per-form stats.

---

## Title Rules

Character title must survive generation and runtime merging.

Runtime card should expose:

```text
title
subtitle
forms[].title
```

Catalog/roster card should display title underneath the main character name.

---

## Passive Name Rules

Generated entries must resolve passive names/descriptions from localization even when the passive is not fully defined in Ability.json.

Required runtime fields:

```text
passiveSkillDetails[].name
passiveSkillDetails[].description
passiveSkills[]
forms[].passiveSkillDetails[]
forms[].passiveSkills[]
```

---

## Ordering Rule

Character display order must come from:

```text
apkfiles/entries/maps/character_order_map.json
```

Order must be applied after character forms are merged.

Unknown/new entries go to the bottom unless added to the map.

---

## Mobile/Desktop Rule

Do not create separate mobile and desktop loaders.

Use:

```text
data-loader.js = universal data
catalog.js = universal card render
style.css = responsive layout only
```

Mobile-specific JavaScript should only be added later for touch-only UI behavior, not for data loading.

---

## Next Implementation Steps

1. Run `build_entry_bundles.py` locally.
2. Push `apkfiles/entries/bundles/` and `apkfiles/entries/reports/bundle_report.json`.
3. Update `data-loader.js` to try bundle files first.
4. Keep individual entry loading as fallback.
5. Verify:
   - SnowWhiteNew appears near top.
   - Washington/Chopin show 3 image states.
   - titles display under names.
   - passives show names/descriptions.
   - mobile uses same runtime data as desktop.

---

## Do Not Mutate

Avoid broad changes to:

```text
style.css
catalog card layout
optimizer scoring logic
legacy data files
```

unless a specific visual or runtime bug requires it.
