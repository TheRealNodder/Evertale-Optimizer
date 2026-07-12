(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const P=root.policy;
  if(!P)return;

  const FEATURE_MAP={
    applies_burn:['engines','burn','setup'],payoff_burn:['engines','burn','payoff'],
    applies_poison:['engines','poison','setup'],payoff_poison:['engines','poison','payoff'],
    applies_sleep:['engines','sleep','setup'],payoff_sleep:['engines','sleep','payoff'],
    applies_stun:['engines','stun','setup'],payoff_stun:['engines','stun','payoff'],
    summon:['engines','blood','setup'],payoff_blood:['engines','blood','payoff'],
    payoff_crisis:['engines','crisis','payoff'],payoff_survivor:['engines','survivor','payoff'],
    role_guardian:['roles','guardian'],role_healer:['roles','healer'],role_cleanser:['roles','cleanser'],
    role_reviver:['roles','reviver'],resource_spirit:['resources','spirit'],tempo_turn:['roles','tempo'],
    leader:['leader']
  };

  function sourceQuality(source){
    const value=P.key(source);
    if(value.startsWith('raw_')||value.startsWith('refs_active')||value.startsWith('refs_passive'))return 1;
    if(value.includes('abilityconfig')||value.includes('resolved_activeskills')||value.includes('resolved_passives'))return .96;
    if(value.includes('abilityai')||value.includes('aisequence'))return .9;
    if(value.includes('localization')||value.includes('description'))return .84;
    if(value.includes('tag'))return .72;
    if(value.includes('element'))return .12;
    return .65;
  }

  function rejectedSource(source,feature=''){
    const value=P.key(source);
    if(P.evidence.rejectedSourceFragments.some(fragment=>value.includes(P.key(fragment))))return true;
    const kind=P.key(feature);
    if(kind==='applies_burn'&&value.includes('frostburn'))return true;
    if(kind==='role_healer'&&value.includes('healthy'))return true;
    return false;
  }

  function normalizeItem(item){
    const feature=P.key(item?.feature);
    const sources=(Array.isArray(item?.sources)?item.sources:[]).map(P.txt).filter(Boolean);
    const usable=sources.filter(source=>!rejectedSource(source,feature));
    const quality=usable.length?Math.max(...usable.map(sourceQuality)):0;
    const confidence=P.clamp(Math.min(Number(item?.confidence)||0,quality||0)/.01)/100;
    return{
      feature,
      strength:Math.max(0,Number(item?.strength)||0),
      confidence,
      sources:usable,
      rejectedSources:sources.filter(rejectedSource),
      authoritative:quality>=P.evidence.minimumMechanicalConfidence
    };
  }

  function unitSourceIds(unit){
    const ids=new Set();
    const add=value=>{const text=P.txt(value);if(text)ids.add(text);};
    add(unit?.sourceId);add(unit?.internal?.sourceId);add(unit?.id);
    (Array.isArray(unit?.formSourceIds)?unit.formSourceIds:[]).forEach(add);
    for(const collection of [unit?.forms,unit?.statsByForm,unit?.skillsByForm,unit?.imageVariants]){
      for(const row of (Array.isArray(collection)?collection:[])){add(row?.sourceId);add(row?.dataSourceId);add(row?.imageSourceId);}
    }
    return [...ids];
  }

  function recordsFor(unit,store){
    const out=[];
    for(const sourceId of unitSourceIds(unit))for(const item of (Array.isArray(store?.[sourceId])?store[sourceId]:[])){
      const normalized=normalizeItem(item);
      if(normalized.feature&&normalized.sources.length)out.push({...normalized,sourceId});
    }
    const unique=new Map();
    for(const row of out){
      const token=[row.feature,row.sourceId,row.sources.join('|')].join('::');
      if(!unique.has(token)||unique.get(token).confidence<row.confidence)unique.set(token,row);
    }
    return [...unique.values()];
  }

  function setNested(target,path,value){
    let cursor=target;
    for(let i=0;i<path.length-1;i++)cursor=cursor[path[i]]=cursor[path[i]]||{};
    const key=path[path.length-1];
    cursor[key]=cursor[key]||[];
    cursor[key].push(value);
  }

  function summarize(unit,store){
    const model={engines:{},roles:{},resources:{},leader:[],records:[],affinities:{},confidence:0};
    const records=recordsFor(unit,store);
    for(const record of records){
      const path=FEATURE_MAP[record.feature];
      if(path)setNested(model,path,record);
    }
    const element=P.key(unit?.element);
    if(element==='fire')model.affinities.burn=P.evidence.elementAffinityMaximum;
    model.records=records;
    const authoritative=records.filter(row=>row.authoritative);
    model.confidence=authoritative.length?authoritative.reduce((sum,row)=>sum+row.confidence,0)/authoritative.length:0;
    return model;
  }

  function best(records,minimum=0){
    return (Array.isArray(records)?records:[]).filter(row=>row.authoritative&&row.confidence>=minimum)
      .sort((a,b)=>(b.strength*b.confidence)-(a.strength*a.confidence))[0]||null;
  }

  function strength(records,minimum=P.evidence.minimumMechanicalConfidence){
    const row=best(records,minimum);
    return row?Math.min(2,row.strength)*row.confidence:0;
  }

  function runtimeStore(){return g.OptimizerRuntime?.chunks?.featureEvidence||{};}

  root.evidence={FEATURE_MAP,sourceQuality,rejectedSource,normalizeItem,unitSourceIds,recordsFor,summarize,best,strength,runtimeStore};
})(window);
