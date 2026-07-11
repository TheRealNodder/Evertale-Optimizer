# Optimizer V6 Foundation Audit

Branch: `codex/optimizer-v6-foundation`  
Baseline: `main` at `b379d6a6`

This checkpoint is limited to the data authorities required by a future V6
optimizer. It does not implement V6 search, alter layouts, change locked stat
formulas, change roster profiles, or activate a V4 fallback.

## Baseline results

- Python compilation passed for the seven requested pipeline entrypoints.
- `tools/validate-current-runtime.js` passed its structural checks.
- `tools/validate-recovered-formulas.mjs` passed; its only output beyond success
  was Node's existing module-type performance warning.
- Character bundle: 747 source entries.
- Family bundle: 426 families.
- Runtime `characterEntries`: 324 keys, demonstrating display-ID collapse.
- Individual character rarity: 747 of 747 entries are null.
- Runtime tags: 0; `usesTags` is false.
- Runtime feature evidence: not generated.
- Fast optimizer startup chunks: weapons and accessories only.
- `validation_report.json` has 0 errors and 937 warnings but no explicit status.
- The field-contract audit reports `status: ok` despite 500 retained warnings.

## Confirmed authority conflicts

1. Family rarity correctly uses base stars, but individual entries do not
   receive that resolved family rarity.
2. Family-state generation still uses hard-coded historical star templates.
3. Frontend fallback rarity uses `max(stars, evolvedStars)` and old thresholds.
4. Runtime character forms are indexed by display ID through a shared family
   key function, silently overwriting legitimate source entries.
5. Empty or missing tag inputs can still produce a successful sync and an
   empty authority.
6. Resolved skills/passives are not materialized as provenance-bearing feature
   evidence in the split runtime.
7. Runtime bootstrap reports readiness after loading only weapon/accessory
   chunks, while optimizer feature layers expect character intelligence.
8. Existing validation is predominantly structural and cannot detect the
   semantic failures above.

## Required passing contract

The executable checks in
`tools/new_structure/test_optimizer_foundation_authorities.py` define the first
passing gate. Full V6 search work must not begin until those checks and the
supported Master Control rebuild both pass.
