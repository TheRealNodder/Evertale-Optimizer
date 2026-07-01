# Optimizer V5 Lab

This folder is a staged sandbox for the next optimizer engine. It is intentionally not wired into `optimizer.html` yet.

Goal:

- Keep V4 working as the live fallback.
- Build V5 as smaller modules that work together.
- Make the optimizer faster, easier to tune, and smarter about synergy.
- Keep newer entry priority strong without breaking duplicate protection or roster profile stats.

Planned module order:

1. `optimizer-v5-shared.js`
2. `optimizer-duplicate-guard.js`
3. `optimizer-meta-priority.js`
4. `optimizer-feature-model.js`
5. `optimizer-synergy-graph.js`
6. `optimizer-candidate-pool.js`
7. `optimizer-team-builder.js`
8. `optimizerEngineV5.js`
9. `optimizer-v5-regression-fixtures.js`
10. `optimizer-v5-test-harness.js`

Optional test wire later:

```html
<script src="./optimizer-v5-lab/optimizer-v5-loader.js?v=1"></script>
```

Do not add that line until we are ready to test V5 on the live optimizer page.

After loading the lab manually and waiting for `OptimizerV5LabLoader.ready`, run:

```js
await runOptimizerV5LabTest()
```

The harness only prints diagnostics and does not apply either result to the page.

Run the isolated engine regression fixtures with:

```js
runOptimizerV5RegressionFixtures()
```

The fixtures cover real extracted skill-ID vocabulary, Mono Burn, Multitype Blood,
Spirit/Void and Sleep/AoE conflicts, strict duplicate keys, and exhausted platoons.

Design rules:

- Do not change formulas.
- Do not mutate generated data.
- Do not use display name/title as the only identity.
- Keep V4 fallback.
- Keep parent-child fixes outside this folder.
- Keep global duplicate protection by entry, family, and name.
- Let lower platoon slots stay empty if unique owned units run out.
- Newer units should get first chance to become anchors.

Runtime idea:

```text
owned units
→ shared normalize/stats helpers
→ meta priority
→ feature model
→ synergy graph
→ candidate pool
→ team builder
→ V5 result
→ V4 fallback if anything fails
```
