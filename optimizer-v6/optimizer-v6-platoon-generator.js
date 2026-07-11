(function(g){
  'use strict';
  const root=g.OptimizerV6=g.OptimizerV6||{},P=root.policy,F=root.featureModel,T=root.teamEvaluator,S=root.storySearch;
  if(!P||!F||!T||!S)return;
  const rows=value=>Array.isArray(value)?value:[],num=value=>Number.isFinite(Number(value))?Number(value):0,uid=unit=>P.txt(unit?.id||unit?.sourceId||unit?.family||unit?.name);

  function rowEvaluation(units,plan){
    const engine=T.engineState(units,plan),roles=T.roleCoverage(units),pairs=T.pairSynergy(units,plan),base=units.length?units.reduce((sum,unit)=>sum+num(unit?.__v6?.baseValue),0)/units.length:0;
    const score=P.clamp(base*.30+engine.score*.30+roles.score*.25+pairs.score*.15-(engine.required&&!engine.complete?35:0));
    return{score,engine,roles,pairs,complete:units.length===P.platoons.size&&(!engine.required||engine.complete)};
  }

  function lockedForRow(options,rowIndex){
    const layout=rows(options?.currentLayout?.platoons?.[rowIndex]).slice(0,P.platoons.size),locks=rows(options?.slotLocks?.platoons?.[rowIndex]).slice(0,P.platoons.size),out=[];
    layout.forEach((id,index)=>{if(locks[index]&&id)out.push({index,id:P.txt(id)});});return out;
  }

  function mapUnits(units){const map=new Map();for(const unit of units)for(const id of [unit?.id,unit?.sourceId,unit?.family,unit?.internal?.sourceId])if(P.txt(id)&&!map.has(P.txt(id)))map.set(P.txt(id),unit);return map;}
  function token(units){return units.map(unit=>P.identity(unit).entry).sort().join('|');}
  function canAdd(selected,unit){return !selected.some(other=>P.identityConflicts(other,unit));}

  function generateRows(units,{plan='hybrid',element='',format='auto',locked=[],limit=P.search.platoonRowsPerPlan,beamWidth=60}={}){
    const map=mapUnits(units),seed=[];
    for(const slot of locked){const unit=map.get(slot.id);if(!unit)throw new Error(`Invalid locked platoon unit: ${slot.id}`);if(!seed.includes(unit))seed.push(unit);}
    if(!P.distinctIdentity(seed))throw new Error('Locked platoon row contains duplicate identity');
    const strictMono=format==='force_mono'||format==='mono',target=P.key(element||seed[0]?.element||'');
    if(strictMono&&seed.some(unit=>(unit?.__v6?.element||P.key(unit?.element))!==target))throw new Error('Locked mono platoon row contains multiple elements');
    const sorted=rows(units).filter(unit=>!strictMono||(unit?.__v6?.element||P.key(unit?.element))===target)
      .sort((a,b)=>S.unitPotential(b,plan)-S.unitPotential(a,plan)||P.identity(a).entry.localeCompare(P.identity(b).entry));
    const chosen=new Map(),add=unit=>{if(unit&&!chosen.has(uid(unit))&&chosen.size<55)chosen.set(uid(unit),unit);};seed.forEach(add);sorted.slice(0,28).forEach(add);
    if(['burn','poison','sleep','stun','blood'].includes(plan)){
      [...sorted].sort((a,b)=>S.planSignals(b,plan).setup-S.planSignals(a,plan).setup).slice(0,8).forEach(add);
      [...sorted].sort((a,b)=>S.planSignals(b,plan).payoff-S.planSignals(a,plan).payoff).slice(0,8).forEach(add);
    }
    for(const role of ['damage','protection','sustain','control','tempo'])[...sorted].sort((a,b)=>num(b?.__v6?.roles?.[role])-num(a?.__v6?.roles?.[role])).slice(0,4).forEach(add);
    sorted.forEach(add);const pool=[...chosen.values()];
    let beam=[seed];
    for(let depth=seed.length;depth<P.platoons.size;depth++){
      const next=new Map();for(const selected of beam)for(const unit of pool){if(!canAdd(selected,unit))continue;const value=[...selected,unit],key=token(value),evaluation=rowEvaluation(value,plan),existing=next.get(key);if(!existing||rowEvaluation(existing,plan).score<evaluation.score)next.set(key,value);}
      beam=[...next.values()].sort((a,b)=>rowEvaluation(b,plan).score-rowEvaluation(a,plan).score||token(a).localeCompare(token(b))).slice(0,beamWidth);if(!beam.length)break;
    }
    return beam.map(selected=>{const evaluation=rowEvaluation(selected,plan);return{units:selected,unitIds:selected.map(uid),plan,element:strictMono?target:'',format,score:evaluation.score,viable:evaluation.complete,evaluation,token:token(selected),locked:[...locked]};})
      .filter(row=>row.units.length===P.platoons.size).sort((a,b)=>b.score-a.score||a.token.localeCompare(b.token)).slice(0,limit);
  }

  function generate(units,options={}){
    const planOptions=options?.presetMode==='hard'?[P.key(options?.presetTag||'hybrid')]:['burn','poison','sleep','stun','blood','crisis','survivor','guardian','tempo','hybrid'];
    const format=options?.format||options?.doctrineOverrides?.monoVsRainbow?.selectionMode||'auto',mono=format==='force_mono'||format==='mono',all=[],seen=new Set();
    const add=row=>{if(row&&!seen.has(row.token)){seen.add(row.token);all.push(row);}};
    for(const plan of planOptions){
      if(mono)for(const element of P.elements)generateRows(units,{plan,element,format:'force_mono'}).forEach(add);
      else{
        generateRows(units,{plan,format:'auto'}).forEach(add);
        for(const element of P.elements)generateRows(units,{plan,element,format:'force_mono',limit:3,beamWidth:35}).forEach(add);
      }
    }
    const lockedRows={};for(let rowIndex=0;rowIndex<P.platoons.rows;rowIndex++){const locked=lockedForRow(options,rowIndex);if(!locked.length)continue;const element=mono?P.key(mapUnits(units).get(locked[0].id)?.element):'';const candidates=[];for(const plan of planOptions)generateRows(units,{plan,element,format:mono?'force_mono':'auto',locked,limit:5}).forEach(row=>candidates.push({...row,rowIndex}));lockedRows[rowIndex]=candidates.sort((a,b)=>b.score-a.score||a.token.localeCompare(b.token));}
    return{candidates:all.sort((a,b)=>b.score-a.score||a.token.localeCompare(b.token)),lockedRows,diagnostics:{inputUnits:units.length,candidateRows:all.length,plans:planOptions,format,mono}};
  }

  root.platoonGenerator={rowEvaluation,lockedForRow,mapUnits,token,canAdd,generateRows,generate};
})(window);
