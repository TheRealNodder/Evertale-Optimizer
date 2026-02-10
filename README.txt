Patch: Fix slot auto-populate / slot dropdown wiring

What was wrong:
- optimizer.js had slotCardHTML() signature changed to expect a slot object (slotId/value/unit/locked),
  but renderStory/renderPlatoons still called it with (slotKey, idx, id, ownedUnits, locked).
- Result: slot HTML was malformed (missing data-idx, wrong data-slot), so slots never populated correctly.

What this patch does:
- Replaces slotCardHTML() with a version that matches the existing calls and wireSelects() expectations:
  - select.slotSelect has data-slot and data-idx
  - input.slotLock has data-slot and data-idx
  - options are built from state.ownedUnits

Install:
- Replace your existing Evertale-Optimizer-main/optimizer.js with the one in this zip.
