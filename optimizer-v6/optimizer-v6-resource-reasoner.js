(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const P=root.policy,E=root.evidence;
  if(!P||!E)return;

  const rows=value=>Array.isArray(value)?value:[];
  const num=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const uid=unit=>P.txt(unit?.id||unit?.sourceId||unit?.family||unit?.name);
  const skillText=skill=>P.key([skill?.id,skill?.name,skill?.description,...rows(skill?.flags),...rows(skill?.components)].join(' '));
  const PLAN_FEATURES={
    burn:new Set(['applies_burn','payoff_burn']),poison:new Set(['applies_poison','payoff_poison']),
    sleep:new Set(['applies_sleep','payoff_sleep']),stun:new Set(['applies_stun','payoff_stun']),
    blood:new Set(['summon','payoff_blood']),crisis:new Set(['payoff_crisis']),survivor:new Set(['payoff_survivor']),
    guardian:new Set(['role_guardian','role_cleanser','role_healer','role_reviver']),
    tempo:new Set(['resource_spirit','tempo_turn'])
  };

  function runtimeStore(){return g.OptimizerRuntime?.chunks?.skillProfiles||{};}

  function normalizeSkill(skill){
    return{
      id:P.txt(skill?.id),name:P.txt(skill?.name||skill?.id),description:P.txt(skill?.description),
      tuCost:Number.isFinite(Number(skill?.tuCost))?Number(skill.tuCost):null,
      spiritGain:Math.max(0,num(skill?.spiritGain)),spiritCost:Math.max(0,num(skill?.spiritCost)),
      useLimit:Number.isFinite(Number(skill?.useLimit))&&Number(skill.useLimit)>0?Number(skill.useLimit):null,
      targeting:P.txt(skill?.targeting),useCondition:P.txt(skill?.useCondition),
      flags:rows(skill?.flags).map(P.txt).filter(Boolean),components:rows(skill?.components).map(P.txt).filter(Boolean),
      source:P.txt(skill?.source)
    };
  }

  function unitProfile(unit,store=runtimeStore()){
    const sourceIds=E.unitSourceIds(unit),profiles=[];
    for(const sourceId of sourceIds){const profile=store?.[sourceId];if(profile&&Array.isArray(profile.skills))profiles.push(profile);}
    const skills=new Map();
    for(const profile of profiles)for(const raw of profile.skills){
      const skill=normalizeSkill(raw);if(!skill.id)continue;
      const current=skills.get(skill.id);
      if(!current||(!current.source&&skill.source))skills.set(skill.id,skill);
    }
    return{sourceIds:profiles.map(profile=>P.txt(profile.sourceId)).filter(Boolean),skills:[...skills.values()]};
  }

  function relevantFeatures(unit,skill,plan){
    const allowed=PLAN_FEATURES[plan]||new Set();
    if(plan==='hybrid')for(const values of Object.values(PLAN_FEATURES))for(const value of values)allowed.add(value);
    const prefix=P.key(`resolved.activeSkills.${skill.id}`);
    return rows(unit?.__v6?.evidence?.records).filter(record=>{
      if(!allowed.has(record.feature))return false;
      return rows(record.sources).some(source=>P.key(source).startsWith(prefix));
    }).map(record=>record.feature);
  }

  function actionRank(unit,skill,plan){
    const features=relevantFeatures(unit,skill,plan),conditionPenalty=skill.useCondition?12:0;
    return features.length*100+skill.spiritGain*22-skill.spiritCost*3-(skill.tuCost??160)*.05-conditionPenalty;
  }

  function chooseAction(unit,plan){
    const skills=rows(unit?.__v6?.skillProfile?.skills),withEvidence=skills.map(skill=>({skill,features:relevantFeatures(unit,skill,plan)}));
    const relevant=withEvidence.filter(row=>row.features.length).sort((a,b)=>actionRank(unit,b.skill,plan)-actionRank(unit,a.skill,plan)||a.skill.id.localeCompare(b.skill.id));
    let selected=relevant[0];
    if(!selected){
      const reliable=withEvidence.filter(row=>row.skill.spiritGain>0&&!row.skill.useCondition).sort((a,b)=>b.skill.spiritGain-a.skill.spiritGain||(a.skill.tuCost??9999)-(b.skill.tuCost??9999)||a.skill.id.localeCompare(b.skill.id));
      selected=reliable[0]||withEvidence.sort((a,b)=>(a.skill.tuCost??9999)-(b.skill.tuCost??9999)||a.skill.spiritCost-b.skill.spiritCost||a.skill.id.localeCompare(b.skill.id))[0];
    }
    if(!selected)return null;
    const skill=selected.skill;
    return{
      unitId:uid(unit),skillId:skill.id,skillName:skill.name,tuCost:skill.tuCost,
      spiritGain:skill.spiritGain,spiritCost:skill.spiritCost,conditional:!!skill.useCondition,
      useCondition:skill.useCondition,evidenceFeatures:selected.features,
      source:skill.source,description:skill.description,
      reason:selected.features.length?`Direct ${plan} evidence`:(skill.spiritGain>0?'Reliable Spirit generation':'Lowest-TU available action')
    };
  }

  function fallbackForecast(units,plan){
    const strengths=units.map(unit=>E.strength(unit?.__v6?.evidence?.resources?.spirit)).filter(Boolean).sort((a,b)=>b-a);
    const spirit=strengths.reduce((sum,value,index)=>sum+value*([1,.5,.2][index]||0),0);
    const need=['tempo','hybrid'].includes(plan)?1:.4;
    return{
      source:'feature-evidence-fallback',score:P.clamp(55+Math.min(35,spirit*25)-Math.max(0,need-spirit)*25),
      reliableGeneration:spirit,conditionalGeneration:0,plannedDemand:0,openingNet:null,minimumReserve:null,
      generatorBeforeSpender:null,competingHighCostActions:0,openingSequence:[],strengths:[],
      warnings:['Structured skill profiles were unavailable; Spirit timing was not inferred.']
    };
  }

  function teamForecast(units,plan='hybrid'){
    const team=rows(units),profiled=team.filter(unit=>rows(unit?.__v6?.skillProfile?.skills).length);
    if(!profiled.length)return fallbackForecast(team,plan);
    const main=team.slice(0,P.story.main).sort((a,b)=>num(b?.__v6?.stats?.spd)-num(a?.__v6?.stats?.spd)||uid(a).localeCompare(uid(b)));
    const sequence=main.map(unit=>chooseAction(unit,plan)).filter(Boolean);
    let balance=0,minimum=0,firstGenerator=-1,firstSpender=-1;
    sequence.forEach((action,index)=>{
      balance+=action.spiritGain-action.spiritCost;minimum=Math.min(minimum,balance);
      if(firstGenerator<0&&action.spiritGain>0)firstGenerator=index;
      if(firstSpender<0&&action.spiritCost>0)firstSpender=index;
    });
    const reliableGeneration=sequence.filter(action=>!action.conditional).reduce((sum,action)=>sum+action.spiritGain,0);
    const conditionalGeneration=sequence.filter(action=>action.conditional).reduce((sum,action)=>sum+action.spiritGain,0);
    const plannedDemand=sequence.reduce((sum,action)=>sum+action.spiritCost,0);
    const minimumReserve=Math.max(0,-minimum),effectiveGain=reliableGeneration+conditionalGeneration*.35;
    const coverageScore=plannedDemand?P.clamp(effectiveGain/plannedDemand*100):(effectiveGain?90:70);
    const sequenceScore=plannedDemand?P.clamp(100-minimumReserve*22):85;
    const tempoScore=sequence.length?sequence.reduce((sum,action)=>sum+P.clamp(100-Math.max(0,(action.tuCost??160)-50)*.65),0)/sequence.length:50;
    const conditionalShare=(reliableGeneration+conditionalGeneration)?conditionalGeneration/(reliableGeneration+conditionalGeneration):0;
    const score=P.clamp(coverageScore*.55+sequenceScore*.35+tempoScore*.10-conditionalShare*20);
    const generatorBeforeSpender=firstSpender<0?null:firstGenerator>=0&&firstGenerator<firstSpender;
    const competingHighCostActions=sequence.filter(action=>action.spiritCost>=3).length;
    const warnings=[];
    if(minimumReserve>0)warnings.push(`Opening actions require ${minimumReserve} Spirit in reserve before their generation covers costs.`);
    if(conditionalGeneration>0&&!reliableGeneration)warnings.push('Opening Spirit generation is conditional rather than immediately reliable.');
    if(competingHighCostActions>1)warnings.push(`${competingHighCostActions} high-cost opening actions compete for Spirit.`);
    if(profiled.length<team.length)warnings.push(`Structured skill profiles are missing for ${team.length-profiled.length} selected unit(s).`);
    const strengths=[];
    if(generatorBeforeSpender===true)strengths.push('A Spirit generator acts before the first planned spender.');
    if(plannedDemand>0&&effectiveGain>=plannedDemand)strengths.push('Evidence-backed opening generation covers the planned Spirit demand.');
    if(!minimumReserve&&plannedDemand)strengths.push('The projected opening does not require pre-existing Spirit reserve.');
    return{
      source:'structured-skill-profiles',score,reliableGeneration,conditionalGeneration,plannedDemand,
      openingNet:reliableGeneration+conditionalGeneration-plannedDemand,minimumReserve,generatorBeforeSpender,
      competingHighCostActions,profileCoverage:team.length?profiled.length/team.length:0,openingSequence:sequence,strengths,warnings
    };
  }

  root.resourceReasoner={runtimeStore,normalizeSkill,unitProfile,relevantFeatures,chooseAction,teamForecast,fallbackForecast,skillText};
})(window);
