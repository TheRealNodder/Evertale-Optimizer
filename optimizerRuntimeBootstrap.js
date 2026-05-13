/* optimizerRuntimeBootstrap.js */
(async function(){
  'use strict';

  function setStatus(text){
    const el = document.getElementById('optimizerRuntimeStatus');
    if (el) el.textContent = text;
  }

  try {
    if (typeof window.loadOptimizerRuntime === 'function') {
      setStatus('Runtime: loading...');
      const runtime = await window.loadOptimizerRuntime();
      const chunks = Object.keys(runtime && runtime.chunks ? runtime.chunks : {}).length;
      setStatus('Runtime: loaded (' + chunks + ' chunks)');
      window.__optimizerRuntimeReady = true;
    } else {
      setStatus('Runtime: loader unavailable');
    }
  } catch (err) {
    console.error('[OptimizerRuntimeBootstrap]', err);
    setStatus('Runtime: failed to load');
  }
})();
