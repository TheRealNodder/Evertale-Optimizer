(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  if(!S)return;

  const DOCTRINES={
    burn:{primary:['fire'],secondary:['dark','storm'],roles:['anchor','dps','support','tank','tempo'],keywords:['burn','burning','ignite','frostburn','burn drive','burn blast','burning enemy','applies burn','inflict burn']},
    poison:{primary:['dark','earth'],secondary:['water','storm'],roles:['anchor','dps','support','control'],keywords:['poison','poisoned','venom','toxin','mega poison','lethal poison','poison eater','poison devour','poisoned enemy','applies poison','inflict poison']},
    sleep:{primary:['water','dark'],secondary:['light','earth'],roles:['anchor','dps','support','control'],keywords:['sleep','sleeping','deep sleep','slumber','dream hunter','nightmare','sleeping enemy','applies sleep','inflict sleep'],conflicts:['random_aoe','all_enemy_damage']},
    stun:{primary:['storm'],secondary:['light','fire'],roles:['anchor','dps','support','control','tempo'],keywords:['stun','stunned','shock','push back','pushback','time strike','time buster','stunned enemy','tu increase','tu reduction','applies stun','inflict stun']},
    stealth:{primary:['dark'],secondary:['storm','water'],roles:['anchor','dps','support'],keywords:['stealth','super stealth','hidden','stealth attack','stealth drive']},
    guardian:{primary:['light','earth'],secondary:[],roles:['tank','support'],keywords:['guardian','protector','guard','bodyguard','protect allies','redirect damage','taunt','damage reduction']},
    heal:{primary:['light','water'],secondary:['earth'],roles:['support','cleanser','tank'],keywords:['heal','restore hp','recover hp','regeneration','lifesteal','drain hp','revive','resurrect','cleanse','purify']},
    turn:{primary:['storm','light'],secondary:[],roles:['tempo','support','control'],keywords:['give turn','grant turn','next turn','reduce tu','tu reduction','haste','quicken','accelerate','spirit gain','spirit battery']},
    blood:{primary:['dark','fire'],secondary:[],roles:['anchor','dps','support'],keywords:['blood','bloodfury','blood fury','bloodthirst','blood thirst','bloodnova','sacrifice','defeated ally','summon','minion']},
    crisis:{primary:['fire','dark'],secondary:['earth'],roles:['anchor','dps','tank'],keywords:['crisis','low hp','desperate','below 50%','below 25%','less than hp']},
    survivor:{primary:['earth','light'],secondary:[],roles:['anchor','dps','tank'],keywords:['survivor','survival','survival fury','after 300 tu','after 250 tu']},
    offense:{primary:['fire','dark','storm'],secondary:[],roles:['anchor','dps'],keywords:['attack','damage','execute','charge','armor breaker','guardian killer','all enemies','random enemies']}
  };
  const ENGINE_ELEMENTS=Object.fromEntries(Object.entries(DOCTRINES).map(([key,value])=>[key,value.primary.slice()]));
  const ENGINE_KEYS=Object.keys(DOCTRINES);
  const STATUS_KEYS=['burn','poison','sleep','stun','stealth'];

  function normalizePlan(value){
    const C=S.constants||{},key=C.aliases?.[S.low(value)]??S.low(value);
    return DOCTRINES[key]?key:'';
  }
  function mode(options){return options?.doctrineOverrides?.monoVsRainbow?.selectionMode||options?.teamType||'auto';}
  function selectedPlan(options){
    const hard=options?.presetMode==='hard'?normalizePlan(options?.presetTag):'';
    if(hard)return hard;
    return [options?.v5Plan,options?.presetTag,...S.arr(options?.archetypes)].map(normalizePlan).find(Boolean)||'offense';
  }
  function f(unit){return unit?.__v5?.features||{};}
  function value(unit,bucket,key){return S.num(f(unit)?.[bucket]?.[key]);}
  function role(unit,key){return value(unit,'roles',key);}
  function directScore(unit,key){
    if(STATUS_KEYS.includes(key))return value(unit,'applies',key)*1.25+value(unit,'consumes',key)*1.45;
    if(key==='guardian')return value(unit,'protects','guard')*1.45+value(unit,'protects','barrier')*.65+value(unit,'protects','hold_ground')*.55;
    if(key==='heal')return value(unit,'protects','heal')*1.2+value(unit,'enables','cleanse')*1.25+value(unit,'enables','revive')*1.35;
    if(key==='turn')return value(unit,'enables','turn')*1.35+value(unit,'enables','tu_reduction')*1.2+value(unit,'enables','spirit')*.85+value(unit,'consumes','spirit')*.35;
    if(key==='blood')return value(unit,'consumes','blood')*1.4+value(unit,'enables','summon')*1.05;
    if(key==='crisis')return value(unit,'consumes','crisis')*1.35;
    if(key==='survivor')return value(unit,'consumes','survivor')*1.35;
    if(key==='offense')return role(unit,'dps')*.85+role(unit,'anchor')*.65+value(unit,'punishes','guardian')*.4;
    return value(unit,'applies',key)+value(unit,'consumes',key)+value(unit,'enables',key)+value(unit,'protects',key)+value(unit,'punishes',key);
  }
  function supportScore(unit,key){
    if(key==='guardian')return role(unit,'tank')*1.2+role(unit,'support')*.55;
    if(key==='heal')return role(unit,'support')+role(unit,'cleanser')*1.15+role(unit,'tank')*.25;
    if(key==='turn')return role(unit,'tempo')*1.2+role(unit,'support')*.65+role(unit,'control')*.35;
    if(key==='offense')return role(unit,'dps')+role(unit,'anchor')*.8;
    return role(unit,'support')*.7+role(unit,'tank')*.55+role(unit,'tempo')*.6+role(unit,'control')*.25;
  }
  function elementScore(unit,key){
    const doctrine=DOCTRINES[key],element=S.clean(unit?.element),direct=directScore(unit,key),support=supportScore(unit,key);
    if(!doctrine||!element)return 0;
    if(doctrine.primary.includes(element))return direct>0?.8:(support>0?.35:0);
    if(doctrine.secondary.includes(element)&&direct>0)return .3;
    return 0;
  }
  function planProfile(unit,key){
    const direct=directScore(unit,key),support=supportScore(unit,key),affinity=elementScore(unit,key);
    const primaryAffinity=!!DOCTRINES[key]?.primary.includes(S.clean(unit?.element));
    return{plan:key,direct,support,affinity,primaryAffinity,eligible:direct>0||(primaryAffinity&&support>0),score:direct*2.4+support*.35+affinity};
  }
  function engineScore(unit,key,options){
    const profile=planProfile(unit,key),plan=selectedPlan(options);
    let score=profile.score;
    if(key===plan&&profile.eligible)score+=.4;
    return score;
  }
  function rolePrimary(unit){
    if(role(unit,'tank')>=1)return'guardian';
    if(role(unit,'cleanser')>=1||value(unit,'protects','heal')||value(unit,'enables','revive'))return'heal';
    if(role(unit,'tempo')>=1)return'turn';
    return'offense';
  }
  function resolve(unit,options){
    const plan=selectedPlan(options),scores={},directScores={},affinityScores={};
    ENGINE_KEYS.forEach(key=>{directScores[key]=directScore(unit,key);affinityScores[key]=elementScore(unit,key);scores[key]=engineScore(unit,key,options);});
    const directSorted=ENGINE_KEYS.map(key=>[key,directScores[key]]).sort((a,b)=>b[1]-a[1]);
    let primary=directScores[plan]>0?plan:(directSorted[0]?.[1]>0?directSorted[0][0]:rolePrimary(unit));
    const secondary=directSorted.filter(([key,score])=>key!==primary&&score>=1.1).slice(0,2).map(([key])=>key);
    const selected=planProfile(unit,plan),primaryProfile=planProfile(unit,primary);
    return{
      primary,secondary,scores,directScores,affinityScores,explicit:primaryProfile.direct>0,
      affinity:primaryProfile.affinity>0,element:S.clean(unit?.element),plan,mode:mode(options),
      selectedPlanDirectScore:selected.direct,selectedPlanElementAffinityScore:selected.affinity,
      selectedPlanSupportScore:selected.support,selectedPlanEligible:selected.eligible
    };
  }
  function cloneBuckets(features){
    return{...features,applies:{...(features.applies||{})},consumes:{...(features.consumes||{})},enables:{...(features.enables||{})},protects:{...(features.protects||{})},punishes:{...(features.punishes||{})},conflicts:{...(features.conflicts||{})},roles:{...(features.roles||{})}};
  }
  function prune(unit,options){
    const features=cloneBuckets(f(unit)),doctrine=resolve(unit,options),allowed=new Set([doctrine.primary,...doctrine.secondary]);
    if(directScore(unit,doctrine.plan)>0)allowed.add(doctrine.plan);
    for(const key of STATUS_KEYS){
      if(allowed.has(key))continue;
      delete features.applies[key];delete features.consumes[key];
    }
    if(doctrine.primary!=='guardian'&&directScore(unit,'guardian')<1.1)delete features.protects.guard;
    if(doctrine.primary!=='heal'&&directScore(unit,'heal')<1.1){delete features.enables.cleanse;delete features.enables.revive;}
    features.doctrine=doctrine;
    return features;
  }
  function attach(rows,options){
    return S.arr(rows).map(unit=>{const clone={...unit};clone.__v5={...(clone.__v5||{}),features:prune(unit,options||{})};return clone;});
  }
  function monoChoice(rows,plan,minValid=8){
    const preferred=DOCTRINES[plan]?.primary||[],ranked=preferred.map(element=>{
      const candidates=S.arr(rows).filter(unit=>S.clean(unit?.element)===element);
      const valid=candidates.filter(unit=>planProfile(unit,plan).eligible);
      const score=valid.reduce((sum,unit)=>sum+planProfile(unit,plan).score+S.num(unit?.__v5?.score)*.0001,0);
      return{element,validCount:valid.length,totalCount:candidates.length,score};
    }).sort((a,b)=>(b.validCount>=minValid)-(a.validCount>=minValid)||b.validCount-a.validCount||b.score-a.score);
    const best=ranked[0]||{element:'',validCount:0,totalCount:0,score:0};
    return{...best,strict:best.validCount>=minValid,preferred:preferred.slice(),ranked};
  }

  root.doctrine={DOCTRINES,ENGINE_ELEMENTS,ENGINE_KEYS,STATUS_KEYS,normalizePlan,selectedPlan,directScore,supportScore,elementScore,planProfile,engineScore,resolve,prune,attach,monoChoice};
})(window);
