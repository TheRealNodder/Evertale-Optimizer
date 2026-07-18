(function(g,d){
  'use strict';
  if(g.OptimizerV6Loader)return;
  const base='./optimizer-v6/',files=[
    'optimizer-v6-policy.js','optimizer-v6-evidence.js','optimizer-v6-resource-reasoner.js','optimizer-v6-feature-model.js','optimizer-v6-team-evaluator.js','optimizer-v6-explanations.js',
    'optimizer-v6-story-search.js','optimizer-v6-platoon-generator.js','optimizer-v6-platoon-allocator.js','optimizer-v6-engine.js',
    'optimizer-v6-controller.js','optimizer-v6-regression-fixtures.js','optimizer-v6-story-regression-fixtures.js','optimizer-v6-platoon-regression-fixtures.js'
  ];
  const loader={version:'v4',files:[...files],ready:null,error:null,active:false,publicEnabled:g.__OPTIMIZER_V6_PUBLIC__!==false};
  const url=file=>`${base}${file}?v=4`;
  loader.activate=function(){if(!g.OptimizerV6?.controller)throw new Error('Optimizer V6 controller unavailable');g.OptimizerEngine={run:(units,options)=>g.OptimizerV6.controller.run(units,options)};loader.active=true;d.documentElement.dataset.optimizerEngine='v6';return g.OptimizerEngine;};
  function finish(){if(!g.OptimizerEngineV6||!g.OptimizerV6?.controller)throw new Error('Optimizer V6 modules loaded without engine/controller');d.documentElement.dataset.optimizerV6Loader='v4';if(loader.publicEnabled)loader.activate();return g.OptimizerEngineV6;}
  function sequential(index=0){if(index>=files.length)return Promise.resolve().then(finish);return new Promise((resolve,reject)=>{const script=d.createElement('script');script.src=url(files[index]);script.async=false;script.onload=()=>resolve(sequential(index+1));script.onerror=()=>reject(new Error(`Optimizer V6 failed to load ${files[index]}`));d.head.appendChild(script);});}
  if(d.readyState==='loading'){files.forEach(file=>d.write(`<script data-optimizer-v6-module="${file}" src="${url(file)}"><\/script>`));loader.ready=new Promise((resolve,reject)=>g.addEventListener('load',()=>{try{resolve(finish());}catch(error){reject(error);}},{once:true}));}
  else loader.ready=sequential();
  loader.ready=loader.ready.catch(error=>{loader.error=String(error?.message||error);console.error('[Optimizer V6 Loader] V6 remains inactive.',error);throw error;});
  g.OptimizerV6Loader=loader;
})(window,document);
