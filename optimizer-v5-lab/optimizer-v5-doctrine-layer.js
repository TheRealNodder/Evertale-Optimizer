(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  if(!S)return;
  const ENGINE_ELEMENTS={
    burn:['fire'],
    poison:['dark','earth'],
    sleep:['water','dark'],
    stun:['storm'],
    stealth:['dark'],
    guardian:['light','earth'],
    heal:['light','water'],
    turn:['storm','light'],
    blood:['dark','fire'],
    crisis:['fire','dark'],
    survivor:['earth','light'],
    offense:['fire','dark','storm']
  };
  const ENGINE_KEYS=['burn','poison','sleep','stun','stealth','guardian','heal','turn','blood','crisis','survivor','offense'];
  const STATUS_KEYS=['burn','poison','sleep','stun','stealth'];
  function mode(options){return options?.doctrineOverrides?.monoVsRainbow?.selectionMode||options?.teamType||'auto';}
  function selectedPlan(options){
    const C=S.constants||{};
    const normalize=v=>C.aliases?.[S.low(v)]||S.low(v);
    const hard=options?.presetMode==='hard'?normalize(options?.presetTag):'';
    if(hard&&hard!=='auto'&&hard!=='none'&&C.plans?.[hard])return hard;
    return [options?.v5Plan,options?.presetTag,...S.arr(options?.archetypes)].map(normalize).find(v=>v&&v!=='auto'&&v!=='none'&&C.plans?.[v])||'offense';
  }
  function feature(unit,key,bucket){return S.num(unit?.__v5?.features?.[bucket]?.[key]);}
  function directScore(unit,key){
    return feature(unit,key,'applies')*1.1+feature(unit,key,'consumes')*1.35+feature(unit,key,'enables')*.8+feature(unit,key,'protects')*.8;
  }
  function elementScore(unit,key){
    const list=ENGINE_ELEMENTS[key]||[];
    return list.includes(S.clean(unit?.element))?.65:0;
  }
  function engineScore(unit,key,options){
    const plan=selectedPlan(options);
    let score=directScore(unit,key)+elementScore(unit,key);
    if(key===plan)score+=1.4;
    if(key==='offense')score+=S.num(unit?.__v5?.features?.roles?.dps)*.35;
    if(key==='guardian')score+=S.num(unit?.__v5?.features?.roles?.tank)*.8;
    if(key==='heal')score+=S.num(unit?.__v5?.features?.roles?.support)*.6+S.num(unit?.__v5?.features?.roles?.cleanser)*.7;
    if(key==='turn')score+=S.num(unit?.__v5?.features?.roles?.tempo)*.9;
    return score;
  }
  function resolve(unit,options){
    const plan=selectedPlan(options),scores={};
    ENGINE_KEYS.forEach(key=>scores[key]=engineScore(unit,key,options));
    const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const primary=(directScore(unit,plan)>0||elementScore(unit,plan)>0||scores[plan]>=sorted[0]?.[1]-.8)?plan:(sorted[0]?.[0]||plan);
    const direct=directScore(unit,primary);
    const affinity=(ENGINE_ELEMENTS[primary]||[]).includes(S.clean(unit?.element));
    const explicit=direct>0;
    const secondary=sorted.filter(([key,value])=>key!==primary&&value>=1.75&&directScore(unit,key)>0).slice(0,2).map(([key])=>key);
    return{primary,secondary,scores,explicit,affinity,element:S.clean(unit?.element),plan,mode:mode(options)};
  }
  function cloneBuckets(features){
    return{
      ...features,
      applies:{...(features.applies||{})},
      consumes:{...(features.consumes||{})},
      enables:{...(features.enables||{})},
      protects:{...(features.protects||{})},
      punishes:{...(features.punishes||{})},
      conflicts:{...(features.conflicts||{})},
      roles:{...(features.roles||{})}
    };
  }
  function prune(unit,options){
    const features=cloneBuckets(unit?.__v5?.features||{});
    const doctrine=resolve(unit,options);
    const allowed=new Set([doctrine.primary,...doctrine.secondary]);
    for(const key of STATUS_KEYS){
      if(allowed.has(key))continue;
      const direct=directScore(unit,key);
      if(direct<2.2){
        delete features.applies[key];
        delete features.consumes[key];
      }
    }
    if(doctrine.primary!=='guardian'&&directScore(unit,'guardian')<1.8)delete features.protects.guard;
    if(doctrine.primary!=='heal'&&directScore(unit,'heal')<1.8){delete features.enables.cleanse;delete features.enables.revive;}
    features.doctrine=doctrine;
    return features;
  }
  function attach(rows,options){
    return S.arr(rows).map(unit=>{
      const clone={...unit};
      clone.__v5={...(clone.__v5||{}),features:prune(unit,options||{})};
      return clone;
    });
  }
  root.doctrine={ENGINE_ELEMENTS,ENGINE_KEYS,STATUS_KEYS,selectedPlan,resolve,prune,attach};
})(window);
