(function(g,d){
  'use strict';
  const legacy='./optimizer-legacy/optimizerEngineV4.js?v=1';
  const v5='./optimizer-v5-lab/optimizer-v5-loader.js?v=5';
  function write(src){d.write('<script src="'+src+'"><\/script>');}
  if(d.readyState==='loading'){
    write(legacy);
    if(!g.OptimizerV5LabLoader)write(v5);
  }else{
    const a=d.createElement('script');
    a.src=legacy;
    a.onload=function(){
      if(g.OptimizerV5LabLoader)return;
      const b=d.createElement('script');
      b.src=v5;
      d.head.appendChild(b);
    };
    d.head.appendChild(a);
  }
  g.OptimizerEngineV4Shim={legacy,v5,version:'v4'};
})(window,document);
