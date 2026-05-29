# Ludmilla / Clarice Ballet merge + order fix

## What changed

- Added explicit duo/merged-card metadata for:
  - `LudmillaBallet`
  - `YandereMaidBallet`

- Ludmilla Ballet is now the visible parent card.
- Clarice Ballet is now attached as a switchable form/card, matching the existing SnowWhiteNew-style merge behavior.
- Added robust source-id mappings for:
  - `LudmillaBallet01 -> YandereMaidBallet01`
  - `LudmillaBallet02 -> YandereMaidBallet02`
  - `LudmillaBallet03 -> YandereMaidBallet03`

- Updated duo collapse scoring so `LudmillaBallet` wins parent selection over `YandereMaidBallet`.
- Updated `tools/new_structure/repair_ballet_active_skills.py` so future rebuilds preserve the duo links.
- Rebuilt entry bundles using the existing `tools/new_structure` pipeline.

## Validation

- `tools/new_structure/repair_ballet_active_skills.py`: passed
- `tools/new_structure/validate_entries.py`: passed with 0 errors / 0 warnings
- `npm run validate:clean`: passed

Note:
`npm run validate` still reports the pre-existing root `/data` live-mode warning from the base project.
