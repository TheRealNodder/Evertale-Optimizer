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
    'optimizerEngineV5.js'
  ];
  function load(src){
    const url=base+src+'?v=1';
    if(d.readyState==='loading')d.write('<script src="'+url+'"><\/script>');
    else{const s=d.createElement('script');s.src=url;d.head.appendChild(s);}
  }
  files.forEach(load);
  g.OptimizerV5LabLoader={version:'v1',files:files.slice()};
})(window,document);
