// optimizer-hook_refined.js
(function(){
  function runSafe(){
    if (!window.OptimizerEngine) return;
    const owned = window.__optimizerOwnedUnits || [];
    if (!owned.length) return;

    const result = window.OptimizerEngine.run(owned, {});
    window.__optimizerResult = result;

    if (window.renderStory) window.renderStory(result.story);
    if (window.renderPlatoons) window.renderPlatoons(result.platoons);
  }

  function patch(){
    if (window.refreshOptimizerFromOwned){
      const original = window.refreshOptimizerFromOwned;
      window.refreshOptimizerFromOwned = function(){
        const r = original.apply(this, arguments);
        runSafe();
        return r;
      };
    }
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    patch();
    runSafe();
  });
})();
