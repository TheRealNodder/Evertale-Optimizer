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
    const aliases={heal:'guardian',cleanse:'guardian',hp_buff:'guardian',hpbuff:'guardian',turn:'tempo',spirit:'tempo',atk_buff:'hybrid',atkbuff:'hybrid',offense:'hybrid'};
    const raw=P.key(options?.plan||options?.presetTag||''),explicit=aliases[raw]||raw;
    if(explicit&&explicit!=='auto'&&explicit!=='none')return explicit;
    const v5=g.OptimizerV5Lab?.candidatePool;
    if(v5&&typeof v5.selectPlan==='function')return P.key(v5.selectPlan(options||{},prepared))||'hybrid';
    return'hybrid';
  }

  function prepare(units,options={}){
    if(options.preparedV6===true&&rows(units).every(unit=>unit?.__v6))return rows(units);
    if(g.OptimizerRuntime?.contracts?.optimizerFoundationReady!==true)throw new Error('Optimizer V6 runtime foundation is not ready');
    if(!g.OptimizerRuntime?.chunks?.featureEvidence)throw new Error('Optimizer V6 feature-evidence chunk is missing');
    const source=rows(units),shared=g.OptimizerV5Lab?.shared;let profileState=null;
    try{profileState=g.EvertaleRosterProfiles?.loadState?.()||null;}catch{}
    const orders=source.map(unit=>Number(shared?.metaOrder?.(unit))||0).filter(value=>value>0),minimum=orders.length?Math.min(...orders):0,maximum=orders.length?Math.max(...orders):0,span=Math.max(1,maximum-minimum);
    const prepared=source.map(unit=>{
      let estimated=unit?.stats||{};try{estimated=g.EvertaleRosterProfiles?.estimateUnitStats?.(unit,undefined,profileState)||estimated;}catch{}
      const order=Number(shared?.metaOrder?.(unit))||0;
      return{...unit,__v5:{...(unit?.__v5||{}),identity:P.identity(unit),stats:{atk:Number(estimated?.atk)||0,hp:Number(estimated?.hp)||0,spd:Number(estimated?.spd)||0,cost:Math.max(1,Number(estimated?.cost)||1),power:Number(estimated?.power||estimated?.unitPower)||0},meta:{order,newer:order>0?(order-minimum)/span:0}}};
    });
    return F.attach(prepared);
  }

  function candidateRecord(kind,plan,result){
    const best=result?.best;if(!best)return null;
    return{kind,format:kind==='mono'?'mono':kind==='rainbow'?'rainbow':'hybrid',plan,element:best.element||best.evaluation?.element?.elements&&Object.keys(best.evaluation.element.elements)[0]||'',score:best.evaluation.score,best,result};
  }

  function tournament(prepared,options={}){
    const mode=selectedMode(options),hard=options?.presetMode==='hard',primary=selectedPlan(options,prepared),plans=hard?[primary]:['burn','poison','sleep','stun','blood','crisis','survivor','guardian','tempo','hybrid'];
    const candidates=[];let completed=0;const total=mode==='force_mono'||mode==='force_rainbow'?plans.length:plans.length+2;
    const add=(kind,plan,result)=>{const row=candidateRecord(kind,plan,result);if(row)candidates.push(row);completed++;if(typeof options.onProgress==='function')options.onProgress({type:'progress',stage:'format-tournament',completed,total,percent:Math.min(100,Math.round(completed/Math.max(1,total)*100)),message:`Evaluating ${kind} ${plan}`,firstValid:candidates.length===1,candidate:row?{format:row.format,plan:row.plan,element:row.element,score:row.score}:null});};
    if(mode==='force_mono')for(const plan of plans)add('mono',plan,S.bestMono(prepared,{...options,plan}));
    else if(mode==='force_rainbow')for(const plan of plans)add('rainbow',plan,S.rainbow(prepared,{...options,plan}));
    else{
      add(primary==='hybrid'?'hybrid':'plan',primary,S.search(prepared,{...options,plan:primary,format:'auto',strictFormat:false}));
      add('mono',primary,S.bestMono(prepared,{...options,plan:primary}));
      add('rainbow',primary,S.rainbow(prepared,{...options,plan:primary}));
      for(const plan of plans)if(plan!==primary)add(plan==='hybrid'?'hybrid':'plan',plan,S.search(prepared,{...options,plan,format:'auto',strictFormat:false}));
    }
    candidates.sort((a,b)=>b.score-a.score||a.format.localeCompare(b.format)||a.plan.localeCompare(b.plan)||a.element.localeCompare(b.element));
    const distinct=[];for(const candidate of candidates){const ids=new Set(candidate.best.ordered.map(uid));if(distinct.every(other=>other.best.ordered.filter(unit=>ids.has(uid(unit))).length<=6))distinct.push(candidate);if(distinct.length>=6)break;}
    return{selected:candidates[0]||null,alternatives:distinct.filter(row=>row!==candidates[0]).slice(0,5),candidates};
  }

  function emptyResult(error){return{story:{main:[],back:[]},platoons:[],totalScore:0,engineVersion:'optimizerEngineV6-error-no-fallback',diagnostics:{v6Failed:true,v6Error:P.txt(error?.message||error),usedFallback:false}};}

  function run(units,options={}){
    const started=Date.now();
    try{
      const prepared=prepare(units,options);if(prepared.length<P.story.total)throw new Error(`Insufficient owned roster: ${prepared.length}/${P.story.total}`);
      const contest=tournament(prepared,options),winner=contest.selected;if(!winner)throw new Error('No legal V6 Story team was found');
      const story={main:winner.best.story.main.map(uid),back:winner.best.story.back.map(uid)};
      let platoons=[],platoonDiagnostics=null;
      if(options.buildScope!=='story'){
        const storyUnits=winner.best.ordered,remaining=prepared.filter(unit=>!storyUnits.some(selected=>P.identityConflicts(unit,selected)));
        if(typeof options.onProgress==='function')options.onProgress({type:'progress',stage:'platoon-generation',completed:0,total:1,percent:0,message:'Generating platoon rows'});
        const generated=root.platoonGenerator?.generate(remaining,options);if(!generated)throw new Error('Optimizer V6 platoon generator is unavailable');
        if(typeof options.onProgress==='function')options.onProgress({type:'progress',stage:'platoon-allocation',completed:0,total:1,percent:0,message:'Allocating scarce units'});
        const allocation=root.platoonAllocator?.allocate(generated,remaining,options);if(!allocation)throw new Error('Optimizer V6 platoon allocator is unavailable');
        platoons=allocation.platoons;platoonDiagnostics=allocation.diagnostics;
      }
      const diagnostics={
        selectedFormat:winner.format,selectedPlan:winner.plan,selectedElement:winner.element,score:winner.score,
        alternatives:contest.alternatives.map(row=>({format:row.format,plan:row.plan,element:row.element,score:row.score})),
        scoreComponents:winner.best.evaluation.components,penalties:winner.best.evaluation.penalties,leader:winner.best.evaluation.leader,
        elementStrategy:winner.best.evaluation.element,unmetNeeds:winner.best.evaluation.unmetNeeds,
        storySearch:winner.result.diagnostics||winner.best.searchDiagnostics||{},preparedUnits:prepared.length,
        platoons:platoonDiagnostics,durationMs:Date.now()-started,usedFallback:false,policyVersion:P.version,selectedEngine:winner.plan
      };
      const platoonScore=platoonDiagnostics?.objective?.total||0;
      return{story,platoons,totalScore:winner.score+platoonScore,score:winner.score,plan:winner.plan,format:winner.format,alternatives:diagnostics.alternatives,engineVersion:'optimizerEngineV6-live',diagnostics};
    }catch(error){console.error('[Optimizer V6] failed without fallback.',error);return emptyResult(error);}
  }

  root.engine={prepare,selectedMode,selectedPlan,tournament,run,emptyResult};
  g.OptimizerEngineV6=root.engine;
})(window);
