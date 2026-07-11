(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const P=root.policy,F=root.featureModel,S=root.storySearch;
  if(!P||!F||!S)return;

  const rows=value=>Array.isArray(value)?value:[];
  const uid=unit=>P.txt(unit?.id||unit?.sourceId||unit?.family||unit?.name);

  function selectedMode(options){
    const value=options?.format||options?.doctrineOverrides?.monoVsRainbow?.selectionMode||'auto';
    if(value==='mono')return'force_mono';if(value==='rainbow')return'force_rainbow';return value;
  }

  function selectedPlan(options,prepared){
    const explicit=P.key(options?.plan||options?.presetTag||'');
    if(explicit&&explicit!=='auto'&&explicit!=='none')return explicit;
    const v5=g.OptimizerV5Lab?.candidatePool;
    if(v5&&typeof v5.selectPlan==='function')return P.key(v5.selectPlan(options||{},prepared))||'hybrid';
    return'hybrid';
  }

  function prepare(units,options={}){
    if(g.OptimizerRuntime?.contracts?.optimizerFoundationReady!==true)throw new Error('Optimizer V6 runtime foundation is not ready');
    if(!g.OptimizerRuntime?.chunks?.featureEvidence)throw new Error('Optimizer V6 feature-evidence chunk is missing');
    let prepared=rows(units);
    const v5=g.OptimizerV5Lab?.engine;
    if(v5&&typeof v5.prepare==='function')prepared=v5.prepare(prepared,options);
    return F.attach(prepared);
  }

  function candidateRecord(kind,plan,result){
    const best=result?.best;if(!best)return null;
    return{kind,format:kind==='mono'?'mono':kind==='rainbow'?'rainbow':'hybrid',plan,element:best.element||best.evaluation?.element?.elements&&Object.keys(best.evaluation.element.elements)[0]||'',score:best.evaluation.score,best,result};
  }

  function tournament(prepared,options={}){
    const mode=selectedMode(options),hard=options?.presetMode==='hard',primary=selectedPlan(options,prepared),plans=hard?[primary]:['burn','poison','sleep','stun','blood','crisis','survivor','guardian','tempo','hybrid'];
    const candidates=[];let completed=0;
    const add=(kind,plan,result)=>{const row=candidateRecord(kind,plan,result);if(row)candidates.push(row);completed++;if(typeof options.onProgress==='function')options.onProgress({type:'progress',stage:'format-tournament',completed,total:plans.length,percent:Math.round(completed/Math.max(1,plans.length)*100),message:`Evaluating ${kind} ${plan}`});};
    if(mode==='force_mono')for(const plan of plans)add('mono',plan,S.bestMono(prepared,{...options,plan}));
    else if(mode==='force_rainbow')for(const plan of plans)add('rainbow',plan,S.rainbow(prepared,{...options,plan}));
    else{
      add('mono',primary,S.bestMono(prepared,{...options,plan:primary}));
      add('rainbow',primary,S.rainbow(prepared,{...options,plan:primary}));
      for(const plan of plans)add(plan==='hybrid'?'hybrid':'plan',plan,S.search(prepared,{...options,plan,format:'auto',strictFormat:false}));
    }
    candidates.sort((a,b)=>b.score-a.score||a.format.localeCompare(b.format)||a.plan.localeCompare(b.plan)||a.element.localeCompare(b.element));
    return{selected:candidates[0]||null,alternatives:candidates.slice(1,6),candidates};
  }

  function emptyResult(error){return{story:{main:[],back:[]},platoons:[],totalScore:0,engineVersion:'optimizerEngineV6-error-no-fallback',diagnostics:{v6Failed:true,v6Error:P.txt(error?.message||error),usedFallback:false}};}

  function run(units,options={}){
    const started=Date.now();
    try{
      const prepared=prepare(units,options);if(prepared.length<P.story.total)throw new Error(`Insufficient owned roster: ${prepared.length}/${P.story.total}`);
      const contest=tournament(prepared,options),winner=contest.selected;if(!winner)throw new Error('No legal V6 Story team was found');
      const story={main:winner.best.story.main.map(uid),back:winner.best.story.back.map(uid)};
      const diagnostics={
        selectedFormat:winner.format,selectedPlan:winner.plan,selectedElement:winner.element,score:winner.score,
        alternatives:contest.alternatives.map(row=>({format:row.format,plan:row.plan,element:row.element,score:row.score})),
        scoreComponents:winner.best.evaluation.components,penalties:winner.best.evaluation.penalties,leader:winner.best.evaluation.leader,
        elementStrategy:winner.best.evaluation.element,unmetNeeds:winner.best.evaluation.unmetNeeds,
        storySearch:winner.result.diagnostics||winner.best.searchDiagnostics||{},preparedUnits:prepared.length,
        durationMs:Date.now()-started,usedFallback:false,policyVersion:P.version,selectedEngine:winner.plan
      };
      return{story,platoons:[],totalScore:winner.score,score:winner.score,plan:winner.plan,format:winner.format,alternatives:diagnostics.alternatives,engineVersion:'optimizerEngineV6-foundation',diagnostics};
    }catch(error){console.error('[Optimizer V6] failed without fallback.',error);return emptyResult(error);}
  }

  root.engine={prepare,selectedMode,selectedPlan,tournament,run,emptyResult};
  g.OptimizerEngineV6=root.engine;
})(window);
