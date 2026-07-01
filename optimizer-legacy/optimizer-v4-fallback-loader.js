(function(g,d){
  'use strict';
  const src='./optimizer-legacy/optimizerEngineV4.js?v=3';
  const loader={version:'v12',src,ready:null,engine:null,active:false,error:null};
  function finish(){
    if(!g.OptimizerEngineV4||typeof g.OptimizerEngineV4.run!=='function')throw new Error('Legacy Optimizer V4 did not load.');
    loader.engine=g.OptimizerEngineV4;
    g.OptimizerFallbackEngine=loader.engine;
    d.documentElement.dataset.optimizerV4Fallback='ready';
    return loader.engine;
  }
  function activate(reason){
    const engine=loader.engine||g.OptimizerEngineV4;
    if(!engine||typeof engine.run!=='function')throw new Error('Optimizer V4 fallback is unavailable.');
    loader.active=true;
    loader.error=reason?String(reason):null;
    g.OptimizerEngine=engine;
    d.documentElement.dataset.optimizerEngine='v4-fallback';
    d.documentElement.dataset.optimizerV4Fallback='active';
    console.warn('[Optimizer] V4 legacy fallback activated explicitly.',loader.error||'manual activation');
    return engine;
  }
  if(d.readyState==='loading'){
    d.write('<script src="'+src+'"><\/script>');
    loader.ready=new Promise((resolve,reject)=>g.addEventListener('load',()=>{try{resolve(finish());}catch(err){reject(err);}},{once:true}));
  }else{
    const script=d.createElement('script');
    script.src=src;
    loader.ready=new Promise((resolve,reject)=>{script.onload=()=>{try{resolve(finish());}catch(err){reject(err);}};script.onerror=()=>reject(new Error('Failed to load '+src));});
    d.head.appendChild(script);
  }
  loader.activate=activate;
  loader.ready.catch(err=>{loader.error=String(err?.message||err);console.error('[Optimizer] V4 fallback loader failed.',err);});
  g.OptimizerEngineV4FallbackLoader=loader;
})(window,document);
