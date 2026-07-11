/* optimizerRuntimeBootstrap.js
   Loads split optimizer runtime and delays optimizer.js DOMContentLoaded init
   until the runtime has either loaded or safely failed.
*/
(function(){
  'use strict';

  function setStatus(text){
    const el = document.getElementById('optimizerRuntimeStatus');
    if (el) el.textContent = text;
  }

  async function loadRuntimeSafe(){
    try {
      if (typeof window.loadOptimizerRuntime === 'function') {
        setStatus('Runtime: loading...');
        const runtime = await window.loadOptimizerRuntime({ profile: 'optimizer-foundation' });
        const chunks = Object.keys(runtime && runtime.chunks ? runtime.chunks : {}).length;
        const contract = runtime && runtime.contracts ? runtime.contracts : {};
        const optimizerFoundationReady = contract.optimizerFoundationReady === true;
        const missing = Array.isArray(contract.missingFoundationChunks) ? contract.missingFoundationChunks : [];
        setStatus(optimizerFoundationReady
          ? 'Runtime: foundation ready (' + chunks + ' chunks)'
          : 'Runtime: incomplete (' + missing.join(', ') + ')');
        window.__optimizerRuntimeReady = optimizerFoundationReady;
        window.__optimizerRuntimeDiagnostics = { optimizerFoundationReady, missing, errors: { ...(runtime.errors || {}) } };
        return runtime;
      }
      setStatus('Runtime: loader unavailable');
      window.__optimizerRuntimeReady = false;
      return null;
    } catch (err) {
      console.error('[OptimizerRuntimeBootstrap]', err);
      setStatus('Runtime: failed to load');
      window.__optimizerRuntimeReady = false;
      return null;
    }
  }

  window.__optimizerRuntimeReadyPromise = window.__optimizerRuntimeReadyPromise || loadRuntimeSafe();

  const originalAddEventListener = document.addEventListener.bind(document);
  document.addEventListener = function(type, listener, options){
    if (type === 'DOMContentLoaded' && typeof listener === 'function') {
      const wrapped = function(event){
        Promise.resolve(window.__optimizerRuntimeReadyPromise)
          .catch(function(){ return null; })
          .then(function(){ return listener.call(this, event); }.bind(this));
      };
      return originalAddEventListener(type, wrapped, options);
    }
    return originalAddEventListener(type, listener, options);
  };
})();
