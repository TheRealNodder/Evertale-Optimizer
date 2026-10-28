# Warning repair checkpoint — 2026-10-27

Scope: generated-data warning causes only. Themes, animations, optimizer weights,
stat formulas, and roster-profile calculations were not changed.

## Before / after

| Authority | Before | After |
| --- | ---: | ---: |
| Entry validator errors | 0 | 0 |
| Entry validator warnings | 966 | 1 |
| Field-contract errors | 0 | 0 |
| Field-contract warnings | 2,534 | 617 |
| Form entries with feature evidence | 762 / 765 | 765 / 765 |
| Feature evidence items | 5,831 | 6,192 |
| Form entries / families | 765 / 435 | 765 / 435 |

## Repairs

- Corrected 868 false weapon-order warnings: weapons intentionally sort by
  descending chronological file handle, as declared by the canonical-order tool.
- Corrected 96 false boss-order warnings: canonical display order is ascending,
  but chronological file handles need not be. Duplicate orders, inconsistent
  metadata, and real out-of-order rows are still detected and regression-tested.
- Followed explicit raw ability `nameKey`, `descriptionKey`, and `selectedKey`
  aliases when direct localization is absent. This restores Dojo skill text and
  evidence coverage without guessing aliases from ability names.
- Generated 1,416 equipment/boss rarity values using exactly the frontend's
  existing raw-star display mapping. `evolvedStars` is not used. Character
  family rarity remains under its existing separate authority.
- Restored 501 weapon-form descriptions from their explicit raw weapon family's
  real base form. Exact form descriptions take precedence; inherited text records
  its localization key and source entry in `fieldSources`.
- Field-contract reports now retain every warning, include counts by category,
  and list every missing field with the exact sources checked. Previously the
  report declared 2,534 warnings but stored only the first 500 strings.
- A recoverable display-generation gap now fails the source audit. Genuinely
  absent optional source text remains a warning, never fabricated content.
- Added eleven regression tests and wired them into Entry Safe Rebuild CI and
  `npm run validate:foundation`.

## Remaining source gaps

| Missing optional text | Count |
| --- | ---: |
| Boss descriptions | 430 |
| Character titles | 70 |
| Weapon descriptions | 66 |
| Character descriptions | 49 |
| Accessory descriptions | 2 |
| **Total** | **617** |

All 617 records have `reason: source_unavailable` in
`apkfiles/entries/reports/master_field_contract_audit_report.json`. No currently
recoverable generation gaps remain. The entry validator's one remaining warning
is absent curated tags; deterministic generated skill evidence is active for
all 765 forms. Missing optional tag additions/maps are also reported truthfully
by tag-sync/runtime reports. Generated evidence is not relabeled as curated tags.

These gaps require additional authoritative localization/tag sources, not
invented text, cross-character prose copying, or warning suppression.

## Verification commands

Run from the repository root:

```text
python -m py_compile tools/new_structure/build_apk_entry_folders.py tools/new_structure/validate_entries.py tools/new_structure/audit_master_field_contract.py tools/new_structure/test_entry_warning_repairs.py
python tools/new_structure/MASTER_CONTROL.py --extract --force --no-gui
python tools/new_structure/test_optimizer_foundation_authorities.py
python tools/new_structure/test_entry_warning_repairs.py
node tools/validate-current-runtime.js --strict
node tools/test-theme-runtime.mjs
node tools/run_optimizer_v6_foundation_tests.js
node tools/validate-recovered-formulas.mjs
node tools/audit_optimizer_v6_catalog.js --intelligence probe
node tools/audit_optimizer_v6_catalog.js --profile C:\Users\josue\Downloads\evertale-roster-profiles-2026-07-12T02-10-55-343Z.json --intelligence probe
```

Results: Python authority tests 13/13; warning-repair tests 11/11; V6 fixtures
59/59; strict runtime, theme, and stat-formula checks passed. Full-catalog
strategy audit passed with no plan conflicts and all six legal mono elements.
The user's 63-profile roster audit retained its expected insufficient-Earth
warning and explicit Frostburn relaxation; its Burn tournament returned eight
direct Fire/Burn contributors, no conflicts, in approximately 1.58 seconds.
The full-catalog Burn tournament took approximately 5.13 seconds.

An automated comparison of all changed individual entries confirmed no changes
to `raw`, `stats`, `hp`, `atk`, `spd`, `cost`, `stars`, or `evolvedStars`.
Timestamp-only generated changes were removed from the final diff.

The host's bundled Node executable is available but npm is not on its PATH;
the npm scripts were therefore executed using their equivalent direct commands.
The formula check still emits the pre-existing Node module-type warning for
`tools/stat-engine.js`; no global package module-type change was made because
that would affect unrelated CommonJS tools.

## Browser check after deployment

1. Hard-refresh the catalog and verify weapon descriptions and rarity displays.
2. Verify Dojo skills show localized names/descriptions where raw aliases exist.
3. Build Burn from the owned roster and inspect explanation evidence.
4. Confirm missing optional lore remains blank, rather than showing invented text.

No silent V4 fallback was introduced. Runtime-size reduction and theme animation
work are deliberately deferred.
