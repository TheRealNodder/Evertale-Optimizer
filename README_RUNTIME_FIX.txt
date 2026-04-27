Replace-only runtime fix for Roster and Catalog.

Files:
- app.js: adds the missing renderSkillBoxes helper for Roster detailed mode.
- catalog.js: fixes malformed normalizeElementClass syntax.

This fixes:
- Roster error: Can't find variable: renderSkillBoxes
- Catalog stuck/loading from invalid JS syntax.
