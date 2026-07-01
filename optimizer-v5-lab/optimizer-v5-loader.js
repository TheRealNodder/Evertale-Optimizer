(function(g,d){
  'use strict';
  const base='./optimizer-v5-lab/';
  const files=[
    'optimizer-v5-shared.js',
    'optimizer-duplicate-guard.js',
    'optimizer-meta-priority.js',
    'optimizer-feature-model.js',
    'optimizer-synergy-graph.js',
    'optimizer-candidate-pool.js',
    'optimizer-team-builder.js',
    'optimizerEngineV5.js',
    'optimizer-v5-regression-fixtures.js',
    'optimizer-v5-test-harness.js'
  ];
  const loader={version:'v2',files:files.slice(),ready:null};
  function url(src){return base+src+'?v=2';}
  function loadSequential(index=0){
    if(index>=files.length)return Promise.resolve(g.OptimizerEngineV5);
    return new Promise((resolve,reject)=>{
      const s=d.createElement('script');s.src=url(files[index]);s.async=false;
      s.onload=()=>resolve(loadSequential(index+1));
      s.onerror=()=>reject(new Error('Optimizer V5 lab failed to load '+files[index]));
      d.head.appendChild(s);
    });
  }
  if(d.readyState==='loading'){
    files.forEach(src=>d.write('<script src="'+url(src)+'"><\/script>'));
    loader.ready=new Promise(resolve=>g.addEventListener('load',()=>resolve(g.OptimizerEngineV5),{once:true}));
  }else loader.ready=loadSequential();
  loader.ready.catch(err=>console.error('[Optimizer V5 Lab Loader]',err));
  g.OptimizerV5LabLoader=loader;
})(window,document);
