(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{},P=root.policy;
  if(!P)return;

  const rows=value=>Array.isArray(value)?value:[];
  const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=value=>P.clamp(value);
  const cache=new WeakMap();
  const PLAN_FEATURES={
    burn:['applies_burn','payoff_burn'],poison:['applies_poison','payoff_poison'],sleep:['applies_sleep','payoff_sleep'],stun:['applies_stun','payoff_stun'],
    frostburn:['applies_frostburn','payoff_frostburn'],stealth:['applies_stealth','payoff_stealth'],counter:['applies_counter','payoff_counter'],charge:['applies_charge','payoff_charge'],
    blood:['summon','payoff_blood'],crisis:['payoff_crisis'],survivor:['payoff_survivor'],
    heal:['role_healer','role_ally_healer','role_team_healer','role_self_sustain','role_reviver'],
    cleanse:['role_cleanser','role_ally_cleanser','role_team_cleanser','role_self_cleanser'],
    defense:['role_guardian','role_defender','defense_armor','defense_hold_ground','role_reviver'],
    guardian:['role_guardian','role_defender','role_healer','role_cleanser','role_reviver'],
    attack:['role_attacker','role_damage','attack_pressure'],spirit:['resource_spirit'],tempo:['tempo_turn','resource_spirit']
  };
  const ALL_FEATURES=new Set(Object.values(PLAN_FEATURES).flat());

  function featureSet(plan){
    const normalized=P.normalizeArchetype(plan)||'hybrid';
    return normalized==='hybrid'?ALL_FEATURES:new Set(PLAN_FEATURES[normalized]||[]);
  }

  function sourcePrefix(skill){return P.key(`resolved.activeSkills.${skill?.id||''}`);}

  function recordsFor(unit,skill,plan='hybrid'){
    const allowed=featureSet(plan),prefix=sourcePrefix(skill);
    return rows(unit?.__v6?.evidence?.records).filter(record=>
      record?.authoritative&&allowed.has(record.feature)&&rows(record.sources).some(source=>P.key(source).startsWith(prefix))
    );
  }

  function conflictRecords(unit,skill,plan='hybrid'){
    const normalized=P.normalizeArchetype(plan)||'hybrid',prefix=sourcePrefix(skill);
    if(normalized==='hybrid')return [];
    return rows(unit?.__v6?.evidence?.records).filter(record=>{
      if(!record?.authoritative||!rows(record.sources).some(source=>P.key(source).startsWith(prefix)))return false;
      if(record.feature===`penalized_by_${normalized}`)return true;
      if(record.feature!==`removes_${normalized}`)return false;
      return rows(record.receipts).some(receipt=>['enemies','self','unknown'].includes(P.key(receipt?.targetTeam)));
    });
  }

  function targetContract(skill){
    const exact=skill?.target&&typeof skill.target==='object'?skill.target:{};
    let side=P.key(exact.side)||'unknown',count=Number.isFinite(Number(exact.count))?Number(exact.count):null,all=exact.all===true,random=exact.random===true;
    const legacy=P.key(skill?.targeting);
    if(side==='unknown'){
      if(legacy.includes('enemy'))side='enemies';else if(legacy.includes('ally')||legacy.includes('friend'))side='allies';else if(legacy.includes('self'))side='self';else if(legacy==='all')side='mixed';
      if(legacy.startsWith('2'))count=2;else if(legacy.startsWith('1')||legacy.includes('one_ally'))count=1;
      all=legacy.startsWith('all');random=legacy.includes('random');
    }
    return{side,count,all,random,authority:P.txt(exact.authority||'legacy-targeting')};
  }

  function damageMagnitude(skill){
    if(!rows(skill?.components).some(value=>P.key(value)==='damage'))return 0;
    const values=[skill?.baseMultiplier,...rows(skill?.conditionalMultipliers),...rows(skill?.attackScalers).map(row=>row?.multiplier)].map(value=>num(value,NaN)).filter(Number.isFinite).filter(value=>value>=0);
    if(!values.length)return 42;
    const base=num(skill?.baseMultiplier,Math.min(...values)),peak=Math.max(...values),sustainable=base>=0?base:Math.min(...values);
    return clamp((sustainable+1)*8+(peak+1)*4);
  }

  function targetValue(skill){
    const target=targetContract(skill);
    if(target.all)return target.side==='mixed'?92:100;
    if(target.count!=null)return clamp(45+Math.min(4,target.count)*14-(target.random?5:0));
    return target.side==='self'?38:50;
  }

  function availability(skill){
    const conditional=!!P.txt(skill?.useCondition),conditionCount=rows(skill?.conditionIds).length;
    const limit=Number.isFinite(Number(skill?.useLimit))?Number(skill.useLimit):0;
    let score=100-(conditional?22:0)-Math.min(18,conditionCount*3);
    if(limit>0)score-=limit===1?28:limit<=3?18:limit<=5?10:4;
    return clamp(score);
  }

  function reliability(skill){
    const chances=rows(skill?.effectChances).map(Number).filter(value=>Number.isFinite(value)&&value>=0&&value<=1);
    if(!chances.length)return targetContract(skill).random?82:100;
    return clamp(Math.max(...chances)*100-(targetContract(skill).random?8:0));
  }

  function tempo(skill){
    const tu=Number.isFinite(Number(skill?.tuCost))?Number(skill.tuCost):160;
    return clamp(100-Math.max(0,tu-1)*.48);
  }

  function spirit(skill,hasPlanEvidence){
    const gain=Math.max(0,num(skill?.spiritGain)),cost=Math.max(0,num(skill?.spiritCost));
    return clamp(58+gain*13-cost*(hasPlanEvidence?6:12));
  }

  function effectiveness(skill){
    const damage=damageMagnitude(skill),support=rows(skill?.components).some(value=>P.key(value)==='apply_buff')?58:0;
    return clamp(Math.max(damage,support)*.72+targetValue(skill)*.28);
  }

  function evaluateAction(unit,skill,plan='hybrid'){
    const evidence=recordsFor(unit,skill,plan),conflicts=conflictRecords(unit,skill,plan),features=[...new Set(evidence.map(row=>row.feature))];
    const fit=features.length?clamp(68+Math.min(32,features.length*16)):P.normalizeArchetype(plan)==='hybrid'?45:5;
    const parts={
      planFit:fit,effectiveness:effectiveness(skill),tempo:tempo(skill),spirit:spirit(skill,features.length>0),
      targeting:targetValue(skill),availability:availability(skill),reliability:reliability(skill)
    };
    const conflict=clamp(conflicts.reduce((sum,row)=>sum+num(row.strength)*num(row.confidence)*45,0));
    const score=clamp(parts.planFit*.38+parts.effectiveness*.16+parts.tempo*.13+parts.spirit*.11+parts.targeting*.09+parts.availability*.08+parts.reliability*.05-conflict*.28);
    return{
      score,parts,conflict,features,target:targetContract(skill),skill,
      evidenceSources:[...new Set(evidence.flatMap(row=>rows(row.sources)))].slice(0,6),
      reason:features.length?`Direct ${P.normalizeArchetype(plan)||'hybrid'} mechanics: ${features.join(', ')}`:damageMagnitude(skill)>0?'Contextual damage/tempo action':'Contextual support/tempo action'
    };
  }

  function portfolio(unit,plan='hybrid'){
    const normalized=P.normalizeArchetype(plan)||'hybrid',byPlan=cache.get(unit)||new Map();
    if(byPlan.has(normalized))return byPlan.get(normalized);
    const actions=rows(unit?.__v6?.skillProfile?.skills).map(skill=>evaluateAction(unit,skill,normalized)).sort((a,b)=>b.score-a.score||P.txt(a.skill?.id).localeCompare(P.txt(b.skill?.id)));
    const weights=[.58,.27,.15],score=clamp(actions.slice(0,3).reduce((sum,row,index)=>sum+row.score*weights[index],0));
    const result={score,actions,topAction:actions[0]||null,planActions:actions.filter(row=>row.features.length),source:actions.length?'contextual-skill-profiles':'unavailable'};
    byPlan.set(normalized,result);cache.set(unit,byPlan);return result;
  }

  function teamFit(units,plan='hybrid'){
    const portfolios=rows(units).map(unit=>({unit,portfolio:portfolio(unit,plan)})),available=portfolios.filter(row=>row.portfolio.actions.length);
    if(!available.length)return{score:50,source:'unavailable',coverage:0,units:[]};
    const scores=available.map(row=>row.portfolio.score).sort((a,b)=>b-a),mean=scores.reduce((sum,value)=>sum+value,0)/scores.length;
    const featureKinds=new Set(available.flatMap(row=>row.portfolio.planActions.flatMap(action=>action.features)));
    const directShare=available.filter(row=>row.portfolio.planActions.length).length/Math.max(1,rows(units).length);
    const score=clamp(mean*.72+Math.min(16,featureKinds.size*5)+directShare*12);
    return{
      score,source:'contextual-skill-profiles',coverage:available.length/Math.max(1,rows(units).length),directShare,
      featureKinds:[...featureKinds],units:available.map(row=>({
        unitId:P.txt(row.unit?.id||row.unit?.sourceId),score:row.portfolio.score,
        topActions:row.portfolio.actions.slice(0,2).map(action=>({
          skillId:P.txt(action.skill?.id),skillName:P.txt(action.skill?.name||action.skill?.id),score:action.score,
          features:action.features,parts:action.parts,target:action.target,conflict:action.conflict,reason:action.reason,source:P.txt(action.skill?.source)
        }))
      }))
    };
  }

  root.skillModel={PLAN_FEATURES,featureSet,recordsFor,conflictRecords,targetContract,damageMagnitude,targetValue,availability,reliability,tempo,spirit,effectiveness,evaluateAction,portfolio,teamFit};
})(window);
