Evertale Optimizer Engine (Drop-in)

FILES
- optimizerEngine.js   : full optimizer logic engine (implements OPTIMIZER_DOCTRINE)
- optimizer-hook.js    : wiring to run the engine without editing optimizer.js

HOW TO INSTALL
1) Copy optimizerEngine.js and optimizer-hook.js into the same folder where optimizer.js is served.
2) Include them AFTER optimizer.js in your HTML:

<script src="optimizer.js"></script>
<script src="optimizerEngine.js"></script>
<script src="optimizer-hook.js"></script>

3) Ensure OPTIMIZER_DOCTRINE is available on window before optimizerEngine.js runs.
   - If you have it in a separate file, load it before optimizerEngine.js:
     <script src="optimizerDoctrine.js"></script>

OPTIONAL: LOCKS/BANS
You can inject options by setting:
  window.__optimizerOptions = {
    lockedUnitIds: [...],
    bannedUnitIds: [...],
    storyLockedMainIds: [...],
    storyLockedBackIds: [...]
  };

OUTPUT
- window.__optimizerResult = {
    story: { main[], back[], leaderId, explain{...} },
    platoons: [ { units[], score, explain{...} }, ... ]
  }

NOTES
- This engine never mutates characters.json objects.
- If your character schema uses different stat/leader fields, the engine tries multiple common keys.