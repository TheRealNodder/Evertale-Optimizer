# Replacement Plan

## Phase 1 (Current)
- Build entry-based structure
- Validate entries
- Keep old data/ intact

## Phase 2
- Introduce new loader (js/new-data-loader.js)
- Test rendering using entries instead of data/

## Phase 3
- Swap UI data source from data/ to entries/
- Keep fallback toggle if needed

## Phase 4
- Remove dependency on:
  - characters.json
  - weapons.json
  - accessories.json
  - bosses.json

## Phase 5
- Fully entry-driven system
- Integrate optimizer directly with entries

## Fail-safe guarantees
- One entry failure does NOT break entire load
- Missing files are skipped
- Validation script ensures integrity

## Future
- Add scraper → raw/
- Auto rebuild entries
- Auto deploy
