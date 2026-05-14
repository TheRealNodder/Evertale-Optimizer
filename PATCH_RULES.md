# Patch Rules

These rules apply to all optimizer, runtime, bundle, and UI patches.

## Mandatory Rules

- Do not rewrite unrelated systems.
- Do not refactor entire files unless absolutely necessary.
- Do not simplify logic unless explicitly requested.
- Preserve existing structure whenever possible.
- Apply only minimal targeted patches.
- Cross-reference old and new files before output.
- Preserve schema compatibility.
- Preserve optimizer doctrine compatibility.
- Preserve mobile compatibility.
- Preserve desktop compatibility.
- Prevent overlapping cards/elements.
- Ensure text wraps correctly.
- Maintain consistent badge sizing.

## Data Mutation Rules

- Never mutate canonical character data at runtime.
- `characters.json` is canonical.
- `leaderSkill` must never be null.
- Preserve all tag namespaces.
- Preserve all schema keys unless explicitly instructed otherwise.
- New data must append/prepend without overwriting existing entries.
- Preserve numeric IDs/order unless intentionally rebuilding numbering.
- Keep newest entries correctly sorted.

## Runtime Migration Rules

Current migration architecture:

Legacy:

- `optimizerEngine.js`
- `optimizer.js`
- `optimizer-hook.js`
- `optimizer_doctrine.js`

Runtime-aware V2:

- `optimizerEngineV2.js`
- `abilityScoreEngine.js`
- `optimizerRuntimeLoader.js`
- `optimizerRuntimeBootstrap.js`
- runtime chunk system

During migration:

- Legacy files remain compatibility fallback.
- Do not delete fallback systems until fully replaced.
- Runtime loaders must fail safely.
- Runtime chunks must remain rebuildable.
- Runtime split manifest must remain valid JSON.
- Runtime chunk names must remain stable.

## Runtime Chunk Rules

Runtime chunks under:

`apkfiles/entries/runtime/`

should remain appendable and rebuildable.

Do not hardcode counts.

Runtime chunks may include:

- characters
- characterEntries
- weapons
- accessories
- bosses
- tags
- optimizerKnowledge
- abilityGraph

Future runtime chunks may include:

- statusGraph
- turnEngine
- aiWeights
- comboGraph
- metaBalance

Design new systems so they can be added through manifest chunk registration instead of hardcoded loader rewrites.

## Image Rules

Use ImageKit CDN URLs when applicable:

`https://ik.imagekit.io/r8fsa98s9/`

Folders:

- `characters/`
- `weapons/`
- `bosses/`
- `UI/`

Treat images as `.png` unless explicitly stated otherwise.

Do not break image cache invalidation logic.

## Optimizer Rules

Optimizer correctness is more important than UI aesthetics.

Required formats:

- Story = 5 main + 3 backline
- Platoons = 20 teams x 5 units

Do not swap functionality between pages.

Do not silently alter:

- leader skill parsing
- tag namespaces
- team generation structure
- synergy assumptions
- status interactions

## Cleanup Rules

Never permanently delete files directly from a dependency audit.

Correct cleanup order:

1. Audit
2. Quarantine (`legacy_unused/`)
3. GitHub Pages verification
4. Re-audit
5. Final deletion

Generated reports should be preserved under:

`apkfiles/entries/reports/`

## Output Standard

When making changes:

1. Explain root cause briefly.
2. List files changed.
3. Output full replacement files when manually patching.
4. Ensure syntax validity before output.
5. Preserve unrelated logic.

If context is missing:

Request the relevant file instead of inventing structure.
