Fixes:
- Restores APK element names in data/characters.json (Air, Life, Death, etc.).
- Keeps color grouping: Air/Thunder/Electric = Storm yellow, Life = Light white, Death = Dark purple.
- Fixes runtime error: normalizeElementDisplay was missing on roster/app.js.
- Stops data-loader from converting displayed element names to canonical names.
- Keeps optimizer canonical element matching internally so team logic still works.
Replace only the included files.
