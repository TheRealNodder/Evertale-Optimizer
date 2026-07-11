# Evertale Optimizer V6 Implementation Report

Branch: `codex/optimizer-v6-foundation`

V6 is the public optimizer. V5 remains loaded for comparison fixtures. V4 is
present only as an explicitly loadable legacy module and is never activated by
the V5 or V6 loaders.

## Delivered architecture

- Central policy with 5+3 Story, 20x5 platoons, all-eight best-only leader
  scope, strict identity, mono, rainbow, evidence, component, penalty, and
  search-budget contracts.
- Provenance-filtered feature model backed by the generated runtime evidence.
  Element affinity is bounded support and cannot create an engine.
- Normalized 0-100 team components and penalties with diminishing returns.
- Deterministic Story beam search with mandatory setup/payoff pruning, exact
  locks, complete mono-element comparison, coherent rainbow relaxation, and
  optimized main/back placement.
- Auto tournament comparing complete mono, rainbow, hybrid, and explicit-plan
  teams under one evaluator.
- Two-stage platoon planning: candidate row generation followed by a global
  scarcity-aware set-packing allocator with row replacement and two-row swaps.
- Web Worker execution, real progress events, cancellation, result caching,
  safe failure behavior, and prior-layout preservation.
- Optional advisory-only research service with strict public-source validation,
  SSRF protections, bounded responses, rate limiting, SQLite caching, polling
  progress, and no deterministic optimizer dependency.
- GitHub Actions use Master Control as the supported orchestration entrypoint.
  Raw APK extraction is an explicit manual workflow mode. Generated outputs no
  longer trigger the automatic rebuild workflow.

## Real-data benchmark

Dataset: 393 frontend-visible character families backed by 747 source forms and
4,181 runtime evidence items.

| Scenario | V5 baseline | V6 result |
| --- | ---: | ---: |
| Story, hard Burn | 1,502 ms synchronous | first valid 240 ms; final 1,968 ms in worker |
| Story progress | page blocked during run | first progress 138 ms |
| Story cache | not policy-versioned | 2 ms deterministic cache hit |
| Forced rainbow Burn | not a four-contribution contract | 1,739 ms; 5 distinct contributing elements |
| Full Auto tournament | chooses plan before complete comparison | 3,133 ms; hybrid Stun selected |
| 20 platoons, hard Burn | 1,445 ms synchronous greedy | 4,950 ms worker/global allocation |
| Platoon allocation | sequential | 307 ms allocation phase after row generation |

The V5 and V6 numeric team scores are not comparable: V5 produced unbounded raw
totals (for example 1,175,400 for Story), while V6 reports a bounded 0-100 team
score (85.48 for the final hard-Burn benchmark).

The real V6 platoon result contained 20 rows, 100 filled unique units, zero
Story overlap, and 16 mechanically viable candidate rows before exhaustion
fill completed the remaining legal slots. Worker cancellation completed in
153 ms.

## Regression results

- V6 policy/evidence/evaluator/failure fixtures: 11/11.
- V6 Story/mono/rainbow/lock/placement fixtures: 5/5.
- V6 platoon/global-allocation/scarcity fixtures: 5/5.
- Existing V5 browser fixtures: 8/8.
- Foundation data-authority tests: 6/6.
- Optional research security/cache tests: 5/5.
- Existing runtime structural validation: passed.
- Locked stat-formula validation: passed.
- Public browser startup: V6 active, runtime ready, no loader error, no console
  warning/error, and V5 `usedFallback` false.

## Data counts

- Character families: 426 generated / 393 frontend-visible.
- Character source entries: 747.
- Runtime character entries: 747; identity collisions: 0.
- Curated tags: 0; `usesTags: false` is reported truthfully.
- Feature evidence: 747 entries / 4,181 evidence items.
- Rarity and state-star semantic mismatches: 0.

## Material commands

```text
python -m py_compile <pipeline, validator, research service, and test files>
python tools/new_structure/MASTER_CONTROL.py --extract --force
python tools/new_structure/MASTER_CONTROL.py --no-gui
python tools/new_structure/MASTER_CONTROL.py --no-gui --dry-run
python tools/new_structure/validate_entries.py
python tools/new_structure/test_optimizer_foundation_authorities.py
python -m unittest discover -s services/strategy-research/tests -v
node --check <changed JavaScript files>
node tools/run_optimizer_v6_foundation_tests.js
node tools/validate-current-runtime.js
node tools/validate-recovered-formulas.mjs
git diff --check
```

Browser verification also exercised V5 and V6 real-data Story runs, forced
rainbow, Auto tournament, 20 platoons, cache hits, cancellation, public-loader
activation, runtime chunk readiness, disabled research configuration, and
console diagnostics. Read-only repository inspection used `rg`, `Get-Content`,
and Git status/diff/log commands throughout.

## Remaining warnings and risks

- Curated tag authorities remain empty/missing. V6 relies on resolved runtime
  evidence and reports the missing curated source instead of concealing it.
- The semantic entry validator retains 938 source-data warnings, primarily
  missing visible text and existing weapon-order diagnostics, with zero errors.
- The optional research backend is source-only and not deployed. The frontend
  button and advisory-prior toggle remain disabled until an API base and source
  list are explicitly configured. Research observations never change V6
  weights in this release.
- CI workflow syntax was reviewed and its Master Control command was dry-run
  locally; GitHub-hosted Actions themselves require a pushed branch to execute.
- The platoon worker is slower in elapsed time than V5 greedy, but it remains
  responsive and performs global allocation rather than sequential selection.
- Node retains the existing module-type performance warning during the locked
  formula test.

## Confirmations

- Stat formulas and roster profile logic were not changed. V6 calls the existing
  `EvertaleRosterProfiles.estimateUnitStats` authority.
- Raw APK JSON is not mutated at runtime.
- Parent-child/family corrections remain intact.
- Story and platoon slot locks are exact hard constraints.
- Story units are excluded from platoons.
- V4 is never silently or automatically used.
- No unrelated visual redesign or broad formatting rewrite was performed.

## Browser checklist

1. Serve the repository over HTTP and open `optimizer.html`.
2. Confirm the runtime reports foundation-ready and the document engine is V6.
3. Build Story in Auto, Mono, and Rainbow modes.
4. Confirm five main and three back slots, exact locks, and a selected leader
   from those eight.
5. Build platoons and confirm 20x5 shape, no duplicates, no Story overlap, and
   internally mono rows when Mono is forced.
6. Start a platoon build, cancel it, and confirm the prior layout remains.
7. Repeat an unchanged build and confirm the cached result returns immediately.
8. Confirm the research button is disabled unless a backend is explicitly
   configured.
