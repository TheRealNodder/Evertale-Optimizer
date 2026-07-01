/* =========================================================
   optimizer-hook.js — Wiring between optimizer.js and engine
   =========================================================
   Load this AFTER optimizer engines and BEFORE optimizer.js.

   - Loads the V5 optimizer stack after V4 is available
   - Adds window.runOptimizer()
   - Auto-runs optimizer whenever refreshOptimizerFromOwned runs
   - Does not require modifying optimizer.js
   ========================================================= */

(function (global) {
  "use strict";

  if (!global.OptimizerV5LabLoader) {
    document.write('<script src="./optimizer-v5-lab/optimizer-v5-loader.js?v=5"><\/script>');
  }

  function runOptimizerSafe() {
    try {
      const owned = global.__optimizerOwnedUnits || [];
      if (!owned.length || !global.OptimizerEngine || typeof global.OptimizerEngine.run !== "function") return;

      const options = global.__optimizerOptions || {}; // optional injection point
      const result = global.OptimizerEngine.run(owned, options);
      global.__optimizerResult = result;

      // If render functions accept a payload, pass it; else call without args.
      if (typeof global.renderStory === "function") {
        try { global.renderStory(result.story); } catch { global.renderStory(); }
      }
      if (typeof global.renderPlatoons === "function") {
        try { global.renderPlatoons(result.platoons); } catch { global.renderPlatoons(); }
      }
    } catch (e) {
      console.error("[optimizer-hook] runOptimizer failed:", e);
    }
  }

  global.runOptimizer = runOptimizerSafe;

  // Monkeypatch refreshOptimizerFromOwned if present
  const original = global.refreshOptimizerFromOwned;
  if (typeof original === "function") {
    global.refreshOptimizerFromOwned = function () {
      const r = original.apply(this, arguments);
      runOptimizerSafe();
      return r;
    };
  } else {
    // fallback: run on DOMContentLoaded
    document.addEventListener("DOMContentLoaded", () => runOptimizerSafe());
  }

})(window);
