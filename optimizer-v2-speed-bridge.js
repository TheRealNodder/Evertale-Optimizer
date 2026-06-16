/* optimizer-v2-speed-bridge.js
   Speed pass for optimizer page.
   Defers heavy runtime/equipment and hidden platoon rendering until needed.
*/
(function(){
  const runAfterReady=(fn)=>{try{fn();}catch(err){console.warn('[optimizer-v2-speed-bridge]',err);}};

  runAfterReady(()=>{
    const originalRuntime=window.loadOptimizerRuntimeIfAvailable;
    if(typeof originalRuntime==='function'&&!window.__optimizerV2RuntimeDeferred){
      window.__optimizerV2RuntimeDeferred=true;
      window.loadOptimizerRuntimeIfAvailable=async function deferredOptimizerRuntime(){
        const status=document.getElementById('optimizerRuntimeStatus');
        if(status)status.textContent='Runtime: loading after first paint...';
        setTimeout(()=>{
          Promise.resolve()
            .then(()=>originalRuntime())
            .then(()=>{
              if(typeof window.renderAll==='function')window.renderAll();
            })
            .catch(err=>console.warn('[Optimizer] deferred runtime failed',err));
        },120);
        return Promise.resolve();
      };
    }

    const originalPlatoons=window.renderPlatoons;
    if(typeof originalPlatoons==='function'&&!window.__optimizerV2PlatoonDeferred){
      window.__optimizerV2PlatoonDeferred=true;
      window.renderPlatoons=function deferredPlatoons(){
        const section=document.getElementById('platoonsSection');
        const grid=document.getElementById('platoonsGrid');
        const isVisible=section&&!section.classList.contains('hidden');
        if(!isVisible){
          if(grid&&!grid.dataset.v2DeferredBlanked){
            grid.innerHTML='';
            grid.dataset.v2DeferredBlanked='1';
          }
          return;
        }
        if(grid)delete grid.dataset.v2DeferredBlanked;
        return originalPlatoons();
      };
    }

    const originalStorage=window.renderStorage;
    if(typeof originalStorage==='function'&&!window.__optimizerV2StorageLazy){
      window.__optimizerV2StorageLazy=true;
      window.renderStorage=function lazyStorage(){
        const result=originalStorage();
        document.querySelectorAll('#storageGrid img:not([loading])').forEach(img=>{
          img.loading='lazy';
          img.decoding='async';
        });
        return result;
      };
    }
  });
})();
