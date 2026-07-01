/* =========================================================
   optimizer-hook.js — Wiring between optimizer.js and engine
   =========================================================
   Load this AFTER optimizer engines and BEFORE optimizer.js.

   - Adds window.runOptimizer()
   - Auto-runs optimizer whenever refreshOptimizerFromOwned runs
   - V5 is loaded directly by optimizer-v5-lab/optimizer-v5-loader.js
   - V4 remains available through optimizer-legacy only
   ========================================================= */

(function (global) {
  "use strict";

  function runOptimizerSafe() {
    try {
      const owned = global.__optimizerOwnedUnits || [];
      if (!owned.length || !global.OptimizerEngine || typeof global.OptimizerEngine.run !== "function") return;

      const options = global.__optimizerOptions || {};
      const result = global.OptimizerEngine.run(owned, options);
      global.__optimizerResult = result;

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

  const original = global.refreshOptimizerFromOwned;
  if (typeof original === "function") {
    global.refreshOptimizerFromOwned = function () {
      const r = original.apply(this, arguments);
      runOptimizerSafe();
      return r;
    };
  } else {
    document.addEventListener("DOMContentLoaded", () => runOptimizerSafe());
  }

})(window);
