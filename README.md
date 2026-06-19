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
