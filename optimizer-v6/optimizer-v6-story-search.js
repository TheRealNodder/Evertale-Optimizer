(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const P=root.policy,F=root.featureModel,T=root.teamEvaluator;
  if(!P||!F||!T)return;

  const rows=value=>Array.isArray(value)?value:[];
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const uid=unit=>P.txt(unit?.id||unit?.sourceId||unit?.family||unit?.name);
  const modeOf=options=>options?.format||options?.doctrineOverrides?.monoVsRainbow?.selectionMode||'auto';
  const pairedPlan=plan=>['burn','poison','sleep','stun','blood'].includes(plan);
  const payoffOnlyPlan=plan=>['crisis','survivor'].includes(plan);
  const mechanicalPlan=plan=>pairedPlan(plan)||payoffOnlyPlan(plan);
  const signalCache=new WeakMap(),potentialCache=new WeakMap();

  function progress(options,stage,completed,total,message){
    if(typeof options?.onProgress==='function')options.onProgress({type:'progress',stage,completed,total,percent:total?Math.round(completed/total*100):0,message});
  }

  function abortIfNeeded(options){if(options?.signal?.aborted||options?.cancelled?.())throw new Error('Optimizer V6 search cancelled');}

  function lockedSlots(options){
    const layout=options?.currentLayout||{},locks=options?.slotLocks||{},slots=[];
    const add=(values,flags,offset)=>rows(values).forEach((id,index)=>{if(flags?.[index]&&id)slots.push({position:offset+index,id:P.txt(id)});});
    add(layout.storyMain,locks.storyMain,0);add(layout.storyBack,locks.storyBack,P.story.main);
    return slots;
  }

  function byAnyId(units){
    const map=new Map();
    for(const unit of rows(units))for(const value of [unit?.id,unit?.sourceId,unit?.family,unit?.internal?.sourceId]){const text=P.txt(value);if(text&&!map.has(text))map.set(text,unit);}
    return map;
  }

  function lockedSeed(units,options){
    const map=byAnyId(units),slots=lockedSlots(options),selected=[];
    for(const slot of slots){const unit=map.get(slot.id);if(!unit)throw new Error(`Locked Story unit is invalid or unowned: ${slot.id}`);if(!selected.includes(unit))selected.push(unit);}
    if(!P.distinctIdentity(selected))throw new Error('Locked Story units contain a duplicate identity');
    return{slots,selected};
  }

  function planSignals(unit,plan){
    if(unit&&typeof unit==='object'){
      const key=P.key(plan),cached=signalCache.get(unit);
      if(cached?.has(key))return cached.get(key);
      const evidence=unit?.__v6?.evidence||{},value={setup:F.mechanical(evidence,key,'setup'),payoff:F.mechanical(evidence,key,'payoff')};
      const next=cached||new Map();next.set(key,value);if(!cached)signalCache.set(unit,next);return value;
    }
    const evidence=unit?.__v6?.evidence||{};
    return{setup:F.mechanical(evidence,plan,'setup'),payoff:F.mechanical(evidence,plan,'payoff')};
  }

  function unitPotential(unit,plan,options={}){
    const profile=P.metaProfile(options),key=`${P.key(plan)}|${profile.level}`,cached=unit&&typeof unit==='object'?potentialCache.get(unit):null;
    if(cached?.has(key))return cached.get(key);
    const roles=unit?.__v6?.roles||{},signals=planSignals(unit,plan);
    const role=Math.max(num(roles.damage),num(roles.protection),num(roles.sustain),num(roles.control),num(roles.tempo),num(roles.setup));
    const direct=Math.min(100,(signals.setup+signals.payoff)*36);
    const core=mechanicalPlan(plan)?(num(unit?.__v6?.baseValue)*.28+direct*.45+role*.22)/.95:(num(unit?.__v6?.baseValue)*.48+direct*.27+role*.20)/.95;
    const value=P.clamp(core*(1-profile.searchWeight)+num(unit?.__v6?.metaPrior)*profile.searchWeight);
    if(unit&&typeof unit==='object'){const next=cached||new Map();next.set(key,value);if(!cached)potentialCache.set(unit,next);}
    return value;
  }

  function candidatePool(units,plan,format,targetElement,options){
    let source=rows(units).filter(unit=>uid(unit));
    if(targetElement)source=source.filter(unit=>(unit?.__v6?.element||P.key(unit?.element))===targetElement);
    const intelligence=P.intelligenceProfile(options),cap=Math.max(P.story.total,Number(options?.candidateCap)||intelligence.storyCandidateCap),chosen=new Map();
    const add=unit=>{if(unit&&!chosen.has(uid(unit))&&chosen.size<cap)chosen.set(uid(unit),unit);};
    const profile=P.metaProfile(options),sorted=[...source].sort((a,b)=>unitPotential(b,plan,options)-unitPotential(a,plan,options)||P.identity(a).entry.localeCompare(P.identity(b).entry));
    lockedSeed(units,options).selected.forEach(add);
    sorted.slice(0,Math.ceil(cap*.45)).forEach(add);
    if(profile.candidateReserve>0)[...source].sort((a,b)=>num(b?.__v6?.metaPrior)-num(a?.__v6?.metaPrior)||P.identity(a).entry.localeCompare(P.identity(b).entry)).slice(0,Math.ceil(cap*profile.candidateReserve)).forEach(add);
    if(mechanicalPlan(plan)){
      if(pairedPlan(plan))[...sorted].sort((a,b)=>planSignals(b,plan).setup-planSignals(a,plan).setup).slice(0,12).forEach(add);
      [...sorted].sort((a,b)=>planSignals(b,plan).payoff-planSignals(a,plan).payoff).slice(0,12).forEach(add);
    }
    for(const role of ['damage','protection','sustain','control','tempo','setup']){
      [...sorted].sort((a,b)=>num(b?.__v6?.roles?.[role])-num(a?.__v6?.roles?.[role])||unitPotential(b,plan,options)-unitPotential(a,plan,options)).slice(0,6).forEach(add);
    }
    if(format==='rainbow'||format==='force_rainbow')for(const element of P.elements)sorted.filter(unit=>(unit?.__v6?.element||P.key(unit?.element))===element).slice(0,8).forEach(add);
    sorted.forEach(add);
    return [...chosen.values()].sort((a,b)=>unitPotential(b,plan,options)-unitPotential(a,plan,options)||P.identity(a).entry.localeCompare(P.identity(b).entry));
  }

  function stateSummary(selected,plan,options={}){
    const elements=new Set(),roles={damage:0,protection:0,sustain:0,control:0,tempo:0,setup:0};
    let base=0,setup=0,payoff=0,contributors=0,confidence=0,meta=0;
    for(const unit of selected){
      elements.add(unit?.__v6?.element||P.key(unit?.element));base+=num(unit?.__v6?.baseValue);confidence+=num(unit?.__v6?.evidence?.confidence)*100;meta+=num(unit?.__v6?.metaPrior);
      const signals=planSignals(unit,plan);setup+=signals.setup;payoff+=signals.payoff;if(signals.setup||signals.payoff)contributors++;
      for(const role of Object.keys(roles))roles[role]=Math.max(roles[role],num(unit?.__v6?.roles?.[role]));
    }
    const roleCoverage=Object.values(roles).reduce((sum,value)=>sum+value,0)/Object.keys(roles).length;
    let engine;
    if(pairedPlan(plan))engine=(setup>0?18:0)+(payoff>0?20:0)+Math.min(22,contributors*3.2);
    else if(payoffOnlyPlan(plan))engine=(payoff>0?30:0)+Math.min(30,contributors*7.5);
    else engine=Math.max(setup,payoff)*24;
    const core=(selected.length?base/selected.length:0)*.32+roleCoverage*.23+engine*.40+(selected.length?confidence/selected.length:0)*.05,profile=P.metaProfile(options),metaPrior=selected.length?meta/selected.length:0;
    const heuristic=P.clamp(core*(1-profile.searchWeight)+metaPrior*profile.searchWeight);
    return{elements,roles,base,setup,payoff,contributors,confidence,meta,metaPrior,heuristic};
  }

  function canAdd(selected,unit){return !selected.some(other=>P.identityConflicts(other,unit));}

  function partialFeasible(selected,pool,remaining,plan,format,targetElement,preparedSummary=null){
    const summary=preparedSummary||stateSummary(selected,plan);
    if(targetElement&&[...summary.elements].some(element=>element!==targetElement))return false;
    if(pairedPlan(plan)){
      if(!summary.setup&&!pool.some(unit=>canAdd(selected,unit)&&planSignals(unit,plan).setup))return false;
      if(!summary.payoff&&!pool.some(unit=>canAdd(selected,unit)&&planSignals(unit,plan).payoff))return false;
    }else if(payoffOnlyPlan(plan)){
      if(!summary.payoff&&!pool.some(unit=>canAdd(selected,unit)&&planSignals(unit,plan).payoff))return false;
    }
    if(format==='rainbow'||format==='force_rainbow'){
      const available=new Set(summary.elements);
      for(const unit of pool)if(canAdd(selected,unit))available.add(unit?.__v6?.element||P.key(unit?.element));
      if(available.size<P.rainbow.preferredDistinct||summary.elements.size+remaining<P.rainbow.preferredDistinct)return false;
    }
    return true;
  }

  function stateToken(selected){return selected.map(unit=>P.identity(unit).entry).sort().join('|');}

  function expandBeam(units,plan,format,targetElement,options={}){
    const intelligence=P.intelligenceProfile(options),seed=lockedSeed(units,options),pool=candidatePool(units,plan,format,targetElement,options),width=Math.max(10,Number(options.beamWidth)||intelligence.storyBeamWidth);
    if(seed.selected.length>P.story.total)return{teams:[],diagnostics:{reason:'too-many-locked-units'}};
    let beam=[{selected:seed.selected,summary:stateSummary(seed.selected,plan,options)}],generated=0,pruned=0;
    for(let depth=seed.selected.length;depth<P.story.total;depth++){
      abortIfNeeded(options);const next=new Map(),remaining=P.story.total-(depth+1);
      for(const state of beam){
        for(const unit of pool){
          if(!canAdd(state.selected,unit))continue;
          const selected=[...state.selected,unit],summary=stateSummary(selected,plan,options);generated++;
          if(!partialFeasible(selected,pool,remaining,plan,format,targetElement,summary)){pruned++;continue;}
          const token=stateToken(selected),existing=next.get(token);
          if(!existing||existing.summary.heuristic<summary.heuristic)next.set(token,{selected,summary});
        }
      }
      beam=[...next.values()].sort((a,b)=>b.summary.heuristic-a.summary.heuristic||stateToken(a.selected).localeCompare(stateToken(b.selected))).slice(0,width);
      progress(options,'story-search',depth+1,P.story.total,`Searching Story candidates (${depth+1}/${P.story.total})`);
      if(!beam.length)break;
    }
    return{teams:beam.map(state=>state.selected),diagnostics:{poolSize:pool.length,beamWidth:width,generatedStates:generated,prunedStates:pruned,completeStates:beam.length,lockedUnits:seed.selected.length,targetElement:targetElement||'',searchIntelligence:intelligence.level}};
  }

  function scoreRank(values,value){const sorted=[...values].sort((a,b)=>a-b),index=sorted.filter(row=>row<=value).length;return sorted.length?index/sorted.length*100:0;}
  function placementValues(units){
    const speeds=units.map(unit=>num(unit?.__v6?.stats?.spd));
    return new Map(units.map(unit=>{
      const role=unit?.__v6?.roles||{},blob=P.key([unit?.description,unit?.passiveSkills,unit?.passiveSkillDetails].map(value=>{try{return JSON.stringify(value);}catch{return P.txt(value);}}).join(' '));
      const entry=/entry|reinforce|from_reserve|when_entering|revenge|reviv/.test(blob)?45:0;
      return[unit,{front:scoreRank(speeds,num(unit?.__v6?.stats?.spd))*.38+num(role.control)*.28+num(role.protection)*.22+num(role.setup)*.12-entry*.55,back:num(role.damage)*.38+num(role.sustain)*.28+num(role.tempo)*.14+entry}];
    }));
  }

  function combinations(values,count,start=0,picked=[],out=[]){
    if(picked.length===count){out.push([...picked]);return out;}
    for(let i=start;i<=values.length-(count-picked.length);i++){picked.push(values[i]);combinations(values,count,i+1,picked,out);picked.pop();}
    return out;
  }

  function fillSlots(fixed,positions,units,scoreKey,values=null){
    const out=Array(positions.length).fill(null),open=[];positions.forEach((position,index)=>{if(fixed.has(position))out[index]=fixed.get(position);else open.push(index);});
    const scores=values||placementValues([...fixed.values(),...units]);
    [...units].sort((a,b)=>num(scores.get(b)?.[scoreKey])-num(scores.get(a)?.[scoreKey])||P.identity(a).entry.localeCompare(P.identity(b).entry)).forEach((unit,index)=>{out[open[index]]=unit;});
    return out;
  }

  function optimizePlacement(selected,options){
    const intelligence=P.intelligenceProfile(options);
    const map=byAnyId(selected),fixed=new Map();for(const slot of lockedSlots(options)){const unit=map.get(slot.id);if(unit)fixed.set(slot.position,unit);}
    const lockedUnits=new Set(fixed.values()),remaining=selected.filter(unit=>!lockedUnits.has(unit));
    const mainFixed=[...fixed.keys()].filter(position=>position<P.story.main).length,backFixed=fixed.size-mainFixed,needMain=P.story.main-mainFixed,needBack=P.story.back-backFixed;
    if(needMain<0||needBack<0||needMain+needBack!==remaining.length)return null;
    const candidates=combinations(remaining,needMain),mainPositions=[0,1,2,3,4],backPositions=[5,6,7],values=placementValues(selected),placements=[];let best=null;
    for(const mainPick of candidates){
      const mainSet=new Set(mainPick),backPick=remaining.filter(unit=>!mainSet.has(unit));
      const main=fillSlots(fixed,mainPositions,mainPick,'front',values),back=fillSlots(fixed,backPositions,backPick,'back',values),ordered=[...main,...back];
      const quick=main.reduce((sum,unit)=>sum+num(values.get(unit)?.front),0)+back.reduce((sum,unit)=>sum+num(values.get(unit)?.back),0);placements.push({main,back,ordered,quick});
    }
    placements.sort((a,b)=>b.quick-a.quick||stateToken(a.ordered).localeCompare(stateToken(b.ordered)));
    const placementLimit=Math.max(1,Number(options?.placementCombinations)||intelligence.placementCombinations);
    for(const placement of placements.slice(0,placementLimit)){const evaluation=T.evaluate(placement.ordered,options);if(evaluation.valid&&(!best||evaluation.score>best.evaluation.score))best={...placement,story:{main:placement.main,back:placement.back},evaluation};}
    return best;
  }

  function search(units,options={}){
    const started=Date.now(),intelligence=P.intelligenceProfile(options),plan=P.key(options.plan||'hybrid')||'hybrid',format=modeOf(options),target=P.key(options.targetElement||'');
    const beam=expandBeam(units,plan,format,target,options),complete=[];
    const finalistLimit=Math.max(1,Number(options?.placementFinalists)||intelligence.storyPlacementFinalists);
    const placementLimit=Math.max(1,Number(options?.placementCombinations)||intelligence.placementCombinations);
    for(const selected of beam.teams.slice(0,finalistLimit)){abortIfNeeded(options);const placed=optimizePlacement(selected,{...options,plan,format});if(placed)complete.push(placed);}
    complete.sort((a,b)=>b.evaluation.score-a.evaluation.score||stateToken(a.ordered).localeCompare(stateToken(b.ordered)));
    const distinct=[];for(const candidate of complete){const ids=new Set(candidate.ordered.map(uid));if(distinct.every(other=>other.ordered.filter(unit=>ids.has(uid(unit))).length<=6))distinct.push(candidate);if(distinct.length>=P.search.alternatives)break;}
    return{best:complete[0]||null,alternatives:distinct.slice(1),diagnostics:{...beam.diagnostics,plan,format,durationMs:Date.now()-started,evaluatedTeams:complete.length,placementFinalists:finalistLimit,placementCombinations:placementLimit}};
  }

  function bestMono(units,options={}){
    const candidates=[];for(const element of P.elements){const result=search(units,{...options,format:'force_mono',targetElement:element,strictFormat:true});if(result.best)candidates.push({...result.best,element,searchDiagnostics:result.diagnostics});}
    candidates.sort((a,b)=>b.evaluation.score-a.evaluation.score||a.element.localeCompare(b.element));
    return{best:candidates[0]||null,alternatives:candidates.slice(1,4),diagnostics:{evaluatedElements:P.elements,candidateElements:candidates.map(row=>row.element)}};
  }

  function rainbow(units,options={}){
    const strict=search(units,{...options,format:'force_rainbow',strictFormat:true});
    if(strict.best)return{...strict,rainbowStrict:true,requestedDistinctElements:P.rainbow.preferredDistinct,actualDistinctElements:strict.best.evaluation.element.distinctElements};
    const relaxed=search(units,{...options,format:'force_rainbow',strictFormat:false});
    return{...relaxed,rainbowStrict:false,requestedDistinctElements:P.rainbow.preferredDistinct,actualDistinctElements:relaxed.best?.evaluation?.element?.distinctElements||0,relaxationReason:relaxed.best?'fourth element breaks engine or role coherence':'no legal eight-unit rainbow team'};
  }

  root.storySearch={pairedPlan,payoffOnlyPlan,mechanicalPlan,lockedSlots,lockedSeed,planSignals,unitPotential,candidatePool,stateSummary,expandBeam,placementValues,optimizePlacement,search,bestMono,rainbow};
})(window);
