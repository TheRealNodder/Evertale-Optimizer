(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  const base=root.engine;
  if(!S||!base||typeof base.prepare!=='function')return;
  const fallback=base.previous||g.OptimizerEngineV4||g.OptimizerEngine;
  function isPlatoonScope(opts){return opts?.buildScope==='platoons'||opts?.buildScope==='all'||opts?.buildScope==='full';}
  function run(units,options){
    try{
      const miss=typeof base.missing==='function'?base.missing():[];
      if(miss.length)throw new Error('Optimizer V5 missing modules: '+miss.join(', '));
      const opts={...(options||{}),optimizerSearchMode:'v5-live'};
      const prepared=base.prepare(units||[],opts);
      const candidate=root.candidatePool.build(prepared,opts);
      const monoElement=isPlatoonScope(opts)?'':(candidate.diagnostics?.monoElement||'');
      const result=root.teamBuilder.build(candidate.rows,prepared,{...opts,v5Plan:candidate.plan,v5MonoElement:monoElement,v5CandidateDiagnostics:candidate.diagnostics});
      result.engineVersion='optimizerEngineV5-live-mono-row';
      result.plan=candidate.plan;
      result.aiAware=true;
      result.duplicateKey='entry-family-name';
      result.diagnostics={...(result.diagnostics||{}),preparedUnits:prepared.length,candidateCap:candidate.cap,candidatePool:candidate.diagnostics,plan:candidate.plan,monoElementMode:monoElement?'global':'row-scoped',lab:true,active:true,fallbackAvailable:!!fallback};
      return result;
    }catch(err){
      root.lastError=err;
      console.warn('[Optimizer V5 mono platoon fix] failed; falling back.',err);
      if(fallback&&typeof fallback.run==='function')return fallback.run(units,options);
      return{story:{main:[],back:[]},platoons:[],totalScore:0,engineVersion:'optimizerEngineV5-fix-empty'};
    }
  }
  root.engine={...base,run,isPlatoonScope};
  g.OptimizerEngineV5=root.engine;
  g.OptimizerEngine=root.engine;
})(window);
