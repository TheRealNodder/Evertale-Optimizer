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

## Foundation checkpoint

Status: **passing with retained source-data warnings**

- Supported forced rebuild: `MASTER_CONTROL.py --extract --force` completed
  after correcting non-character source-key handling.
- Supported normal rebuild: `MASTER_CONTROL.py --no-gui` completed successfully.
- Incremental authority build: 0 entries rewritten and all 2,115 source entries
  skipped after category-scoped invalidation was introduced.
- Character bundle entries: 747 before, 747 after.
- Character families: 426 before, 426 after.
- Runtime character form entries: 324 before, 747 after.
- Runtime character identity collisions: 0 after repair.
- Individual character entries with null rarity: 747 before, 0 after.
- Family rarity mismatches: 0 after repair.
- Entry/family rarity mismatches: 0 after repair.
- Raw-form/family-state star mismatches: 0 after repair.
- Curated tags: 0 before, 0 after; the absence is now reported as a warning and
  `usesTags` remains truthfully false.
- Generated feature evidence: absent before; 747 character entries and 4,181
  provenance-bearing evidence items after repair.
- Leader authority: present on 571 character entries.
- Semantic validator: explicit `warning` status, 0 errors, 938 retained warnings.
  The warnings are primarily pre-existing missing visible text and weapon order
  diagnostics rather than foundation authority failures.
- Field-contract audit: explicit `warning` status and 0 errors. Its retained
  warnings are source completeness diagnostics.

## Verification

- Requested Python entrypoint compilation: passed.
- Changed Python and JavaScript syntax checks: passed.
- Foundation authority tests: 6 of 6 passed.
- Existing runtime structural validation: passed.
- Locked stat-formula validation: passed; the existing Node module-type warning
  remains.
- Existing V5 browser regression fixtures: 8 of 8 passed.
- Frontend-visible merged families: 393, with 0 base-star rarity mismatches.
- Optimizer startup loaded exactly `characters`, `featureEvidence`,
  `optimizerKnowledge`, and `tags`.
- `characterEntries` and `abilityGraph` remained lazy at startup.
- Runtime readiness was true, missing required chunks was empty, and runtime
  failures was empty.
- Public optimizer engine remained V5. No V4 fallback was invoked.

## Deferred work and risks

- Full V6 Story, rainbow, mono, platoon allocation, worker, and performance
  benchmarks are intentionally not implemented in this checkpoint.
- Curated tag authorities are still empty/missing. Generated resolved-skill,
  passive, AI, and localization evidence now supplies the mechanical foundation,
  but curated observations remain unavailable.
- Existing source completeness and weapon-order warnings remain visible and must
  not be mistaken for successful clean data.
- GitHub Actions orchestration alignment remains a later handoff item; the local
  supported Master Control paths are now validated.
