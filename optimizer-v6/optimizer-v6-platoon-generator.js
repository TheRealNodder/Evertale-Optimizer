(function(g){
  'use strict';
  const root=g.OptimizerV6=g.OptimizerV6||{},P=root.policy,F=root.featureModel,T=root.teamEvaluator,S=root.storySearch;
  if(!P||!F||!T||!S)return;
  const rows=value=>Array.isArray(value)?value:[],num=value=>Number.isFinite(Number(value))?Number(value):0,uid=unit=>P.txt(unit?.id||unit?.sourceId||unit?.family||unit?.name);

  function rowEvaluation(units,plan,options={}){
    const engine=T.engineState(units,plan,options),roles=T.roleCoverage(units),pairs=T.pairSynergy(units,plan),archetypes=T.archetypeState(units,options),base=units.length?units.reduce((sum,unit)=>sum+num(unit?.__v6?.baseValue),0)/units.length:0,vulnerability=units.length?units.reduce((sum,unit)=>sum+F.antiSynergy(unit,plan)*50,0)/units.length:0;
    const core=P.clamp(base*.27+engine.score*.29+roles.score*.22+pairs.score*.14+archetypes.score*.08-(engine.required&&!engine.coherent?35:0)-vulnerability*.08),metaPrior=units.length?units.reduce((sum,unit)=>sum+num(unit?.__v6?.metaPrior),0)/units.length:0,metaWeighting=P.metaProfile(options);
    const score=P.clamp(core*(1-metaWeighting.scoreWeight)+metaPrior*metaWeighting.scoreWeight);
    return{score,engine,roles,pairs,archetypes,vulnerability,metaPrior,metaWeighting,complete:units.length===P.platoons.size&&(!engine.required||engine.coherent)&&archetypes.valid};
  }

  function lockedForRow(options,rowIndex){
    const layout=rows(options?.currentLayout?.platoons?.[rowIndex]).slice(0,P.platoons.size),locks=rows(options?.slotLocks?.platoons?.[rowIndex]).slice(0,P.platoons.size),out=[];
    layout.forEach((id,index)=>{if(locks[index]&&id)out.push({index,id:P.txt(id)});});return out;
  }

  function mapUnits(units){const map=new Map();for(const unit of units)for(const id of [unit?.id,unit?.sourceId,unit?.family,unit?.internal?.sourceId])if(P.txt(id)&&!map.has(P.txt(id)))map.set(P.txt(id),unit);return map;}
  function token(units){return units.map(unit=>P.identity(unit).entry).sort().join('|');}
  function canAdd(selected,unit){return !selected.some(other=>P.identityConflicts(other,unit));}

  function generateRows(units,configuration={}){
    const intelligence=P.intelligenceProfile(configuration);
    const {plan='hybrid',element='',format='auto',locked=[]}=configuration;
    const limit=Math.max(1,Number(configuration.limit)||intelligence.platoonRowsPerPlan);
    const beamWidth=Math.max(12,Number(configuration.beamWidth)||intelligence.platoonBeamWidth);
    const map=mapUnits(units),seed=[];
    for(const slot of locked){const unit=map.get(slot.id);if(!unit)throw new Error(`Invalid locked platoon unit: ${slot.id}`);if(!seed.includes(unit))seed.push(unit);}
    if(!P.distinctIdentity(seed))throw new Error('Locked platoon row contains duplicate identity');
    const strictMono=format==='force_mono'||format==='mono',target=P.key(element||seed[0]?.element||'');
    if(strictMono&&seed.some(unit=>(unit?.__v6?.element||P.key(unit?.element))!==target))throw new Error('Locked mono platoon row contains multiple elements');
    let eligible=rows(units).filter(unit=>!strictMono||(unit?.__v6?.element||P.key(unit?.element))===target);
    if(configuration?.presetMode==='hard'&&P.pairedPlans.includes(P.normalizeArchetype(plan))){const compatible=eligible.filter(unit=>seed.includes(unit)||!F.hardPlanConflict(unit,plan));if(compatible.length>=P.platoons.size)eligible=compatible;}
    const sorted=eligible
      .sort((a,b)=>S.unitPotential(b,plan,configuration)-S.unitPotential(a,plan,configuration)||P.identity(a).entry.localeCompare(P.identity(b).entry));
    const candidateCap=Math.max(P.platoons.size,Number(configuration.platoonCandidateCap)||intelligence.platoonCandidateCap);
    const chosen=new Map(),add=unit=>{if(unit&&!chosen.has(uid(unit))&&chosen.size<candidateCap)chosen.set(uid(unit),unit);};seed.forEach(add);sorted.slice(0,Math.ceil(candidateCap*.55)).forEach(add);
    if(P.pairedPlans.includes(P.normalizeArchetype(plan))){
      [...sorted].sort((a,b)=>S.planSignals(b,plan).setup-S.planSignals(a,plan).setup).slice(0,8).forEach(add);
      [...sorted].sort((a,b)=>S.planSignals(b,plan).payoff-S.planSignals(a,plan).payoff).slice(0,8).forEach(add);
    }
    for(const archetype of P.requestedArchetypes(configuration))[...sorted].sort((a,b)=>F.archetypeSignal(b,archetype).score-F.archetypeSignal(a,archetype).score).slice(0,8).forEach(add);
    for(const role of ['damage','protection','sustain','control','tempo'])[...sorted].sort((a,b)=>num(b?.__v6?.roles?.[role])-num(a?.__v6?.roles?.[role])).slice(0,4).forEach(add);
    sorted.forEach(add);const pool=[...chosen.values()];
    let beam=[{units:seed,evaluation:rowEvaluation(seed,plan,configuration)}];
    for(let depth=seed.length;depth<P.platoons.size;depth++){
      const next=new Map();for(const state of beam)for(const unit of pool){if(!canAdd(state.units,unit))continue;const value=[...state.units,unit],key=token(value),evaluation=rowEvaluation(value,plan,configuration),existing=next.get(key);if(!existing||existing.evaluation.score<evaluation.score)next.set(key,{units:value,evaluation});}
      beam=[...next.values()].sort((a,b)=>b.evaluation.score-a.evaluation.score||token(a.units).localeCompare(token(b.units))).slice(0,beamWidth);if(!beam.length)break;
    }
    return beam.map(state=>{const selected=state.units,evaluation=state.evaluation;return{units:selected,unitIds:selected.map(uid),plan,element:strictMono?target:'',format,score:evaluation.score,viable:evaluation.complete,evaluation,token:token(selected),locked:[...locked]};})
      .filter(row=>row.units.length===P.platoons.size).sort((a,b)=>b.score-a.score||a.token.localeCompare(b.token)).slice(0,limit);
  }

  function generate(units,options={}){
    const intelligence=P.intelligenceProfile(options);
    const planOptions=options?.presetMode==='hard'?[P.normalizeArchetype(options?.presetTag||'hybrid')]:P.plans;
    const format=options?.format||options?.doctrineOverrides?.monoVsRainbow?.selectionMode||'auto',mono=format==='force_mono'||format==='mono',all=[],seen=new Set();
    const add=row=>{if(row&&!seen.has(row.token)){seen.add(row.token);all.push(row);}};
    const useProbe=options?.presetMode!=='hard'&&planOptions.length>1&&['standard','deep','ultra'].includes(intelligence.level);
    const archetypeContract=options?.archetypeContract||T.archetypeAvailability(units,options,P.platoons.size),generationOptions=useProbe?{...options,archetypeContract,searchIntelligence:'probe'}:{...options,archetypeContract};
    for(const plan of planOptions){
      if(mono)for(const element of P.elements)generateRows(units,{...generationOptions,plan,element,format:'force_mono'}).forEach(add);
      else{
        generateRows(units,{...generationOptions,plan,format:'auto'}).forEach(add);
        const generationIntelligence=P.intelligenceProfile(generationOptions);
        for(const element of P.elements)generateRows(units,{...generationOptions,plan,element,format:'force_mono',limit:Math.max(3,Math.ceil(generationIntelligence.platoonRowsPerPlan*.4)),beamWidth:Math.max(24,Math.ceil(generationIntelligence.platoonBeamWidth*.72))}).forEach(add);
      }
    }
    let refinedGroups=0;
    if(useProbe&&all.length){
      const groups=[],groupSeen=new Set(),refineLimit=intelligence.level==='ultra'?5:intelligence.level==='deep'?3:1;
      for(const row of [...all].sort((a,b)=>b.score-a.score||a.token.localeCompare(b.token))){
        const key=`${row.plan}|${row.format}|${row.element||''}`;if(groupSeen.has(key))continue;
        groupSeen.add(key);groups.push({plan:row.plan,format:row.format,element:row.element||''});if(groups.length>=refineLimit)break;
      }
      for(const group of groups){
        generateRows(units,{...options,archetypeContract,...group}).forEach(add);refinedGroups++;
      }
    }
    const lockedRows={};for(let rowIndex=0;rowIndex<P.platoons.rows;rowIndex++){const locked=lockedForRow(options,rowIndex);if(!locked.length)continue;const element=mono?P.key(mapUnits(units).get(locked[0].id)?.element):'';const candidates=[];for(const plan of planOptions)generateRows(units,{...options,archetypeContract,plan,element,format:mono?'force_mono':'auto',locked,limit:5}).forEach(row=>candidates.push({...row,rowIndex}));lockedRows[rowIndex]=candidates.sort((a,b)=>Number(b.viable)-Number(a.viable)||b.score-a.score||a.token.localeCompare(b.token));}
    return{candidates:all.sort((a,b)=>Number(b.viable)-Number(a.viable)||b.score-a.score||a.token.localeCompare(b.token)),lockedRows,diagnostics:{inputUnits:units.length,candidateRows:all.length,plans:planOptions,requestedPlan:options?.presetMode==='hard'?planOptions[0]:'',format,mono,archetypeContract,metaWeighting:P.metaProfile(options),searchIntelligence:intelligence,probeLevel:useProbe?'probe':intelligence.level,refinedGroups}};
  }

  root.platoonGenerator={rowEvaluation,lockedForRow,mapUnits,token,canAdd,generateRows,generate};
})(window);
