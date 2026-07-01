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
    let source=S.arr(units);
    if(g.OptimizerEngineV2&&typeof g.OptimizerEngineV2.enrichOwnedUnits==='function'){
      try{
        const originalByKey=new Map();
        source.forEach(unit=>[unit?.id,unit?.sourceId,unit?.family].map(S.clean).filter(Boolean).forEach(key=>originalByKey.set(key,unit)));
        source=g.OptimizerEngineV2.enrichOwnedUnits(source).map(unit=>{
          const original=[unit?.id,unit?.sourceId,unit?.family].map(S.clean).filter(Boolean).map(key=>originalByKey.get(key)).find(Boolean)||unit;
          const tags=[...new Set([...S.arr(original?.derivedTags),...S.arr(original?.tags)].map(S.txt).filter(Boolean))];
          return{...unit,derivedTags:tags,tags:tags,__runtimeV2:{...(unit.__runtimeV2||{}),tagText:tags.map(S.keyText).join(' '),aiTags:[],v5TagsSanitized:true}};
        });
      }catch{}
    }
    let rows=source.map(unit=>{
      const clone={...unit};
      clone.id=S.txt(unit?.id||unit?.sourceId||unit?.family||unit?.name);
      clone.__v5={...(clone.__v5||{}),identity:S.identity(unit),stats:S.stats(unit,profileState)};
      return clone;
    });
    rows=root.metaPriority.normalize(rows);
    rows=root.featureModel.attach(rows);
    if(root.doctrine&&typeof root.doctrine.attach==='function')rows=root.doctrine.attach(rows,options||{});
    return rows;
  }
  function run(units,options){
    try{
      const miss=missing();
      if(!S||miss.length)throw new Error('Optimizer V5 lab missing modules: '+miss.join(', '));
      const opts={...(options||{}),optimizerSearchMode:'v5-lab'};
      const prepared=prepare(units||[],opts);
      const candidate=root.candidatePool.build(prepared,opts);
      const result=root.teamBuilder.build(candidate.rows,prepared,{...opts,v5Plan:candidate.plan,v5MonoElement:candidate.diagnostics?.monoElement||'',v5CandidateDiagnostics:candidate.diagnostics});
      result.engineVersion='optimizerEngineV5-live-doctrine';
      result.plan=candidate.plan;
      result.aiAware=true;
      result.duplicateKey='entry-family-name';
      result.diagnostics={...(result.diagnostics||{}),preparedUnits:prepared.length,candidateCap:candidate.cap,candidatePool:candidate.diagnostics,plan:candidate.plan,doctrine:true,lab:true,active:true,fallbackAvailable:!!previous};
      root.lastError=null;
      try{console.info('[Optimizer V5]',result.diagnostics);}catch{}
      return result;
    }catch(err){
      root.lastError=err;
      console.error('[Optimizer V5] failed. V4 was not applied silently.',err);
      return{story:{main:[],back:[]},platoons:[],totalScore:0,engineVersion:'optimizerEngineV5-error-no-v4-fallback',diagnostics:{v5Failed:true,v5Error:S?.txt(err?.message||err)||'Unknown V5 error',fallbackAvailable:!!previous,usedFallback:false}};
    }
  }

  root.engine={run,prepare,missing,previous};
  g.OptimizerEngineV5=root.engine;
  g.OptimizerEngine=g.OptimizerEngineV5;
})(window);
