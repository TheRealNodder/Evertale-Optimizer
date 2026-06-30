(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  const previous=g.OptimizerEngine;

  function missing(){
    return ['shared','duplicateGuard','metaPriority','featureModel','synergyGraph','candidatePool','teamBuilder'].filter(k=>!root[k]);
  }
  function prepare(units,options){
    const profileState=g.EvertaleRosterProfiles&&typeof g.EvertaleRosterProfiles.loadState==='function'?g.EvertaleRosterProfiles.loadState():null;
    let rows=S.arr(units).map(unit=>{
      const clone={...unit};
      clone.id=S.txt(unit?.id||unit?.sourceId||unit?.family||unit?.name);
      clone.__v5={...(clone.__v5||{}),identity:S.identity(unit),stats:S.stats(unit,profileState)};
      return clone;
    });
    rows=root.metaPriority.normalize(rows);
    rows=root.featureModel.attach(rows);
    return rows;
  }
  function run(units,options){
    try{
      const miss=missing();
      if(!S||miss.length)throw new Error('Optimizer V5 lab missing modules: '+miss.join(', '));
      const opts={...(options||{}),optimizerSearchMode:'v5-lab'};
      const prepared=prepare(units||[],opts);
      const candidate=root.candidatePool.build(prepared,opts);
      const result=root.teamBuilder.build(candidate.rows,prepared,opts);
      result.engineVersion='optimizerEngineV5-lab';
      result.plan=candidate.plan;
      result.aiAware=true;
      result.duplicateKey='entry-family-name';
      result.diagnostics={...(result.diagnostics||{}),preparedUnits:prepared.length,candidateCap:candidate.cap,plan:candidate.plan,lab:true};
      try{console.info('[Optimizer V5 Lab]',result.diagnostics);}catch{}
      return result;
    }catch(err){
      console.warn('[Optimizer V5 Lab] failed; falling back.',err);
      if(previous&&typeof previous.run==='function')return previous.run(units,options);
      return{story:{main:[],back:[]},platoons:[],totalScore:0,engineVersion:'optimizerEngineV5-lab-empty'};
    }
  }

  root.engine={run,prepare,missing};
  g.OptimizerEngineV5=root.engine;
  // Intentional: do not assign g.OptimizerEngine here yet. The lab engine is not live-wired.
})(window);
