(function(g,d){
  'use strict';
  if(g.OptimizerV5LabLoader?.version==='v12')return;
  const base='./optimizer-v5-lab/';
  const files=[
    'optimizer-v5-shared.js',
    'optimizer-duplicate-guard.js',
    'optimizer-meta-priority.js',
    'optimizer-feature-model.js',
    'optimizer-v5-entry-intent-layer.js',
    'optimizer-v5-battle-intent-layer.js',
    'optimizer-v5-selector-feature-bridge.js',
    'optimizer-v5-doctrine-layer.js',
    'optimizer-synergy-graph.js',
    'optimizer-candidate-pool.js',
    'optimizer-team-builder.js',
    'optimizerEngineV5.js',
    'optimizer-v5-mono-platoon-fix.js',
    'optimizer-v5-regression-fixtures.js',
    'optimizer-v5-test-harness.js'
  ];
  const loader={version:'v12',files:files.slice(),ready:null,engine:null,error:null,usedFallback:false};
  function url(src){return base+src+'?v=12';}
  function finish(){
    if(!g.OptimizerEngineV5||typeof g.OptimizerEngineV5.run!=='function')throw new Error('Optimizer V5 modules finished loading without an engine.');
    loader.engine=g.OptimizerEngineV5;
    g.OptimizerEngine=loader.engine;
    d.documentElement.dataset.optimizerEngine='v5';
    d.documentElement.dataset.optimizerV5Loader='v12';
    return loader.engine;
  }
  function fallback(err){
    loader.error=String(err?.message||err);
    loader.usedFallback=true;
    console.error('[Optimizer V5 Loader] V5 failed to load; activating the explicit V4 legacy fallback.',err);
    const legacy=g.OptimizerEngineV4FallbackLoader;
    if(legacy&&typeof legacy.activate==='function')return legacy.activate(loader.error);
    throw err;
  }
  function loadSequential(index=0){
    if(index>=files.length)return Promise.resolve().then(finish);
    return new Promise((resolve,reject)=>{
      const s=d.createElement('script');s.src=url(files[index]);s.async=false;s.dataset.optimizerV5Module=files[index];
      s.onload=()=>resolve(loadSequential(index+1));
      s.onerror=()=>reject(new Error('Optimizer V5 lab failed to load '+files[index]));
      d.head.appendChild(s);
    });
  }
  if(d.readyState==='loading'){
    files.forEach(src=>d.write('<script data-optimizer-v5-module="'+src+'" src="'+url(src)+'"><\/script>'));
    loader.ready=new Promise((resolve,reject)=>g.addEventListener('load',()=>{try{resolve(finish());}catch(err){reject(err);}},{once:true}));
  }else loader.ready=loadSequential();
  loader.ready=loader.ready.catch(fallback);
  g.OptimizerV5LabLoader=loader;
})(window,document);
