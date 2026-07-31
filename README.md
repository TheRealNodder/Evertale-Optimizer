# Evertale Optimizer — Clean Live Build

This build keeps raw APK data immutable and wires the site into the existing `apkfiles/entries` and `apkfiles/entries/runtime` payloads.

## Live entry points

- `index.html`
- `roster.html`
- `optimizer.html`

## Data layout

```text
apkfiles/entries/          Raw split entity files. Do not mutate.
apkfiles/entries/runtime/  Existing resolved optimizer runtime files.
apkfiles/derived/          Thin generated runtime/calibration layer.
legacy/                    Old checkpoints, docs, and retired files.
```

## Performance changes

- Runtime chunks load in parallel.
- Cache-busting no longer uses `Date.now()`.
- Heavy optimizer chunks can be skipped during first paint.
- Derived indexes are prebuilt so pages do not need to scan huge source files on load.

## Stat-engine policy

White stats are character-only. Blue stats are white stats plus equipment. Raw entries are never overwritten; calibration and hidden runtime anchors belong in `apkfiles/derived`.

## Optimizer V6 search controls

- **Standard** runs the smallest complete-team beam search.
- **Deep** is the balanced default.
- **Ultra** probes every eligible format and plan, then applies the widest refinement pass to the strongest complete candidates in a Web Worker.
- Hard constraints, evidence requirements, locked slots, identity guards, Story exclusion, and mono/rainbow contracts are identical at every intelligence level.
- Newer-unit weighting remains a bounded 0%, 5%, or 10% score slice; it cannot replace required setup, payoff, safety, or leader mechanics.

## Local latest-unit advisory

`Refresh Latest Unit Cache` reads the generated character-family authority and stores a schema-, policy-, and data-version-bound snapshot in `localStorage`. The feature uses no cookies and is opt-in through `Use advisory meta prior`.

The local snapshot represents generated release order, not a live strategy ranking. Optional configured public-research results remain separate, expire at their source deadline, and cannot override hard constraints or direct skill evidence.

## Dynamic themes

Legendary themes use a dedicated, pointer-inert ambient layer with effect families inspired by official descriptions of each Pokemon's powers. Console themes reproduce hardware color and finish relationships. These are visual interpretations rather than claims that every Pokemon emits a permanent canonical aura.

Theme motion pauses when the page is hidden, honors `prefers-reduced-motion`, removes the secondary particle layer on narrow screens, and leaves page overlays outside theme stacking contexts.
