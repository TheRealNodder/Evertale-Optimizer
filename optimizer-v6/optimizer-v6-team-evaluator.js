(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const P=root.policy,F=root.featureModel,E=root.evidence,R=root.resourceReasoner;
  if(!P||!F||!E||!R)return;

  const rows=value=>Array.isArray(value)?value:[];
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const mean=value=>value.length?value.reduce((sum,row)=>sum+num(row),0)/value.length:0;
  const unitId=unit=>P.txt(unit?.id||unit?.sourceId||unit?.family||unit?.name);
  const selectionMode=options=>options?.format||options?.selectionMode||options?.doctrineOverrides?.monoVsRainbow?.selectionMode||'auto';

  function lockedStoryIds(options){
    const layout=options?.currentLayout||{},locks=options?.slotLocks||{},out=[];
    const add=(values,flags)=>rows(values).forEach((id,index)=>{if(flags?.[index]&&id)out.push(P.txt(id));});
    add(layout.storyMain,locks.storyMain);add(layout.storyBack,locks.storyBack);
    return out;
  }

  function validateStory(team,options={}){
    const units=rows(team),errors=[];
    if(units.length!==P.story.total)errors.push(`Story requires exactly ${P.story.total} units`);
    if(!P.distinctIdentity(units))errors.push('Story contains a duplicate entry/family/name identity');
    const allowed=options.ownedIds instanceof Set?options.ownedIds:null;
    if(allowed)for(const unit of units)if(!allowed.has(unitId(unit)))errors.push(`Unowned unit: ${unitId(unit)}`);
    const orderedLocked=lockedStoryIds(options);
    const lockedFlags=[...rows(options?.slotLocks?.storyMain).slice(0,5),...rows(options?.slotLocks?.storyBack).slice(0,3)];
    const current=[...rows(options?.currentLayout?.storyMain).slice(0,5),...rows(options?.currentLayout?.storyBack).slice(0,3)].map(P.txt);
    lockedFlags.forEach((locked,index)=>{if(locked&&current[index]&&unitId(units[index])!==current[index])errors.push(`Locked Story slot ${index+1} changed`);});
    if(orderedLocked.length&&orderedLocked.some(id=>!units.some(unit=>unitId(unit)===id)))errors.push('A locked Story unit is missing');
    const elements=new Set(units.map(unit=>unit?.__v6?.element||P.key(unit?.element)).filter(Boolean));
    const mode=selectionMode(options);
    if((mode==='mono'||mode==='force_mono')&&options.strictFormat!==false&&elements.size>1)errors.push('Strict mono Story contains multiple elements');
    if((mode==='rainbow'||mode==='force_rainbow')&&options.strictFormat!==false&&elements.size<P.rainbow.preferredDistinct)errors.push(`Strict rainbow Story requires ${P.rainbow.preferredDistinct} elements`);
    return{valid:errors.length===0,errors,distinctElements:elements.size};
  }

  function engineState(units,plan){
    const setup=units.map(unit=>F.mechanical(unit?.__v6?.evidence,plan,'setup')).filter(Boolean).sort((a,b)=>b-a);
    const payoff=units.map(unit=>F.mechanical(unit?.__v6?.evidence,plan,'payoff')).filter(Boolean).sort((a,b)=>b-a);
    const paired=['burn','poison','sleep','stun','blood'].includes(plan),payoffOnly=['crisis','survivor'].includes(plan);
    const requiresSetup=paired,requiresPayoff=paired||payoffOnly,required=requiresSetup||requiresPayoff;
    const contributorCount=units.filter(unit=>F.mechanical(unit?.__v6?.evidence,plan,'setup')||F.mechanical(unit?.__v6?.evidence,plan,'payoff')).length;
    const coverage=units.length?contributorCount/units.length:0;
    let score;
    if(paired)score=setup.length&&payoff.length?45+Math.min(15,setup.slice(0,3).reduce((s,v,i)=>s+v*[7,4,2][i],0))+Math.min(15,payoff.slice(0,3).reduce((s,v,i)=>s+v*[7,4,2][i],0))+coverage*25:0;
    else if(payoffOnly)score=payoff.length?55+Math.min(25,payoff.slice(0,4).reduce((s,v,i)=>s+v*[10,5,2,1][i],0))+coverage*20:0;
    else if(plan==='guardian')score=P.clamp(diminishing(units.map(unit=>num(unit?.__v6?.roles?.protection)))/1.45);
    else if(plan==='tempo')score=P.clamp(mean(units.map(unit=>num(unit?.__v6?.roles?.tempo)))*1.8+Math.max(...units.map(unit=>num(unit?.__v6?.roles?.damage)),0)*.35);
    else score=P.clamp(Math.max(...['burn','poison','sleep','stun','blood'].map(candidate=>engineState(units,candidate).score),0));
    const complete=(!requiresSetup||setup.length>0)&&(!requiresPayoff||payoff.length>0);
    return{plan,required,requiresSetup,requiresPayoff,setupCount:setup.length,payoffCount:payoff.length,contributorCount,coverage,complete,score:P.clamp(score)};
  }

  function diminishing(values,weights=[1,.5,.2,.1]){
    return values.filter(Boolean).sort((a,b)=>b-a).reduce((sum,value,index)=>sum+num(value)*(weights[index]??0),0);
  }

  function roleCoverage(units){
    const role=name=>units.map(unit=>num(unit?.__v6?.roles?.[name]));
    const damage=P.clamp(diminishing(role('damage'))/1.45);
    const safety=P.clamp(Math.max(diminishing(role('protection')),diminishing(role('sustain')))/1.45);
    const tempo=P.clamp(Math.max(diminishing(role('control')),diminishing(role('tempo')))/1.45);
    const setup=P.clamp(diminishing(role('setup'))/1.45);
    return{score:P.clamp((damage+safety+tempo+setup)/4),damage,safety,tempo,setup};
  }

  function resourceBalance(units,plan){
    return R.teamForecast(units,plan);
  }

  function pairValue(a,b,plan){
    const ae=a?.__v6?.evidence,be=b?.__v6?.evidence;
    let score=0;
    if(F.mechanical(ae,plan,'setup')&&F.mechanical(be,plan,'payoff'))score+=50;
    if(F.mechanical(be,plan,'setup')&&F.mechanical(ae,plan,'payoff'))score+=50;
    const ar=a?.__v6?.roles||{},br=b?.__v6?.roles||{};
    if((ar.protection>30&&br.damage>30)||(br.protection>30&&ar.damage>30))score+=22;
    if((ar.tempo>30&&br.damage>30)||(br.tempo>30&&ar.damage>30))score+=16;
    if((ar.sustain>30&&br.protection>30)||(br.sustain>30&&ar.protection>30))score+=12;
    return P.clamp(score);
  }

  function pairSynergy(units,plan){
    const values=[];
    for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++)values.push(pairValue(units[i],units[j],plan));
    const best=values.sort((a,b)=>b-a).slice(0,12);
    return{score:P.clamp(mean(best)*1.25),evaluatedPairs:values.length,contributingPairs:best.filter(Boolean).length};
  }

  function leaderText(unit){
    const values=[unit?.leaderSkill,unit?.refs?.leaderBuff,unit?.refs?.leaderBuffCondition,unit?.resolved?.leaderCondition,unit?.raw?.leaderBuff,unit?.raw?.leaderBuffCondition];
    try{return JSON.stringify(values).toLowerCase();}catch{return values.map(P.txt).join(' ').toLowerCase();}
  }

  function leaderElement(text){
    const aliases={fire:'fire',water:'water',storm:'storm',air:'storm',earth:'earth',light:'light',life:'light',dark:'dark',death:'dark'};
    return Object.entries(aliases).find(([word])=>new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(text))?.[1]||'';
  }

  function leaderCandidates(units){
    return units.map(unit=>{
      const text=leaderText(unit),hasLeader=!!(unit?.leaderSkill?.internalId||unit?.refs?.leaderBuff||unit?.raw?.leaderBuff||E.best(unit?.__v6?.evidence?.leader,0));
      if(!hasLeader)return null;
      const element=leaderElement(text),matches=element?units.filter(row=>(row?.__v6?.element||P.key(row?.element))===element).length:units.length;
      const parsed=[...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(match=>Number(match[1])).filter(Number.isFinite);
      const percent=parsed.length?Math.max(...parsed):15;
      const coverage=matches/P.story.leaderScope;
      const value=P.clamp((element?30:42)+Math.min(35,percent*1.6))*coverage;
      return{unitId:unitId(unit),element:element||'all',matches,scope:P.story.leaderScope,coverage,percent,score:value};
    }).filter(Boolean).sort((a,b)=>b.score-a.score||a.unitId.localeCompare(b.unitId));
  }

  function leaderValue(units){
    const candidates=leaderCandidates(units),selected=candidates[0]||null;
    return{score:selected?.score||0,stacking:P.story.leaderStacking,scope:P.story.leaderScope,selected,candidates:candidates.slice(0,5)};
  }

  function positionFlow(units){
    const main=units.slice(0,P.story.main),back=units.slice(P.story.main);
    const front=mean(main.map(unit=>P.clamp(num(unit?.__v6?.stats?.spd)*.8+num(unit?.__v6?.roles?.control)*.45+num(unit?.__v6?.roles?.protection)*.45)));
    const reserve=mean(back.map(unit=>P.clamp(num(unit?.__v6?.roles?.damage)*.55+num(unit?.__v6?.roles?.sustain)*.45+(/entry|reinforce|revenge|reviv/.test(P.key(unit?.description))?40:0))));
    return{score:P.clamp(front*.58+reserve*.42),main:front,back:reserve};
  }

  function elementStrategy(units,plan,format){
    const elements=new Map();
    for(const unit of units){
      const element=unit?.__v6?.element||P.key(unit?.element)||'unknown';
      const contribution=F.featureContribution(unit,plan);
      const current=elements.get(element)||{count:0,contribution:0};current.count++;current.contribution=Math.max(current.contribution,contribution);elements.set(element,current);
    }
    const distinct=elements.size,contributing=[...elements.entries()].filter(([,value])=>value.contribution>=P.rainbow.minimumContribution).map(([element])=>element);
    let score=60,strict=true;
    if(format==='mono'||format==='force_mono'){strict=distinct===1;score=strict?100:0;}
    else if(format==='rainbow'||format==='force_rainbow'){strict=distinct>=P.rainbow.preferredDistinct&&contributing.length>=P.rainbow.preferredDistinct;score=strict?P.clamp(70+distinct*5+contributing.length*3):P.clamp(distinct*10+contributing.length*8);}
    else score=P.clamp(55+Math.min(25,contributing.length*6)+Math.min(20,distinct*3));
    return{score,strict,distinctElements:distinct,contributingElements:contributing,elements:Object.fromEntries(elements)};
  }

  function counterCoverage(roles){return P.clamp(roles.safety*.45+roles.tempo*.35+roles.damage*.20);}

  function penalties(units,plan,engine,roles,resource,options={}){
    const setups=['burn','poison','sleep','stun'].filter(name=>units.some(unit=>F.mechanical(unit?.__v6?.evidence,name,'setup')));
    const guardians=units.filter(unit=>num(unit?.__v6?.roles?.protection)>=35).length;
    const uncertainty=100-mean(units.map(unit=>num(unit?.__v6?.evidence?.confidence)*100));
    return{
      statusConflicts:P.clamp(Math.max(0,setups.length-2)*22+(setups.includes('sleep')&&setups.some(x=>x!=='sleep')?18:0)),
      roleRedundancy:P.clamp(Math.max(0,guardians-2)*20+Math.max(0,roles.damage<25?20:0)),
      resourceConflicts:P.clamp(Math.max(
        plan==='tempo'&&units.every(unit=>!E.strength(unit?.__v6?.evidence?.resources?.spirit))?45:0,
        resource?.source==='structured-skill-profiles'?(num(resource.minimumReserve)*18+num(resource.competingHighCostActions)*8+(resource.conditionalGeneration>0&&!resource.reliableGeneration?25:0)):0
      )),
      unsupportedPayoffs:engine.required&&!engine.complete?100:0,
      planDilution:options?.presetMode==='hard'&&engine.required?P.clamp(Math.max(0,units.length-engine.contributorCount-2)/Math.max(1,units.length-2)*100):0,
      evidenceUncertainty:P.clamp(uncertainty)
    };
  }

  function weightedScore(components,penaltyValues){
    let score=0;for(const [name,weight] of Object.entries(P.componentWeights))score+=num(components[name])*weight;
    for(const [name,weight] of Object.entries(P.penaltyWeights))score-=num(penaltyValues[name])*weight;
    return P.clamp(score);
  }

  function evaluate(team,options={}){
    const units=rows(team),plan=P.key(options.plan||'hybrid')||'hybrid',format=selectionMode(options);
    const validation=validateStory(units,options),engine=engineState(units,plan),roles=roleCoverage(units),resource=resourceBalance(units,plan),pairs=pairSynergy(units,plan),leader=leaderValue(units),position=positionFlow(units),element=elementStrategy(units,plan,format);
    const components=P.boundedComponents({
      baseUnitValue:mean(units.map(unit=>num(unit?.__v6?.baseValue))),engineCompletion:engine.score,roleCoverage:roles.score,
      resourceBalance:resource.score,pairSynergy:pairs.score,groupSynergy:P.clamp(engine.score*.55+roles.score*.45),leaderValue:leader.score,
      positionFlow:position.score,elementStrategy:element.score,counterCoverage:counterCoverage(roles),
      boundedMetaPrior:mean(units.map(unit=>num(unit?.__v6?.metaPrior))),evidenceConfidence:mean(units.map(unit=>num(unit?.__v6?.evidence?.confidence)*100))
    });
    const penaltyValues=P.boundedComponents(penalties(units,plan,engine,roles,resource,options));
    const formatError=(format==='rainbow'||format==='force_rainbow'||format==='mono'||format==='force_mono')&&options.strictFormat!==false&&!element.strict;
    const errors=[...validation.errors];
    if(engine.required&&!engine.complete&&options.requirePlanComplete!==false)errors.push(engine.requiresSetup?`${plan} requires both setup and payoff evidence`:`${plan} requires direct payoff evidence`);
    if(formatError&&!errors.some(error=>/mono|rainbow/i.test(error)))errors.push(`${format} coherence contract failed`);
    return{
      valid:errors.length===0,errors,score:errors.length?0:weightedScore(components,penaltyValues),components,penalties:penaltyValues,
      plan,format,engine,roles,resource,pairs,leader,position,element,
      unmetNeeds:[engine.requiresSetup&&!engine.setupCount?'setup':'',engine.requiresPayoff&&!engine.payoffCount?'payoff':'',roles.damage<25?'damage':'',roles.safety<25?'protection/sustain':'',roles.tempo<20?'control/tempo':''].filter(Boolean)
    };
  }

  root.teamEvaluator={validateStory,engineState,roleCoverage,resourceBalance,pairValue,pairSynergy,leaderCandidates,leaderValue,positionFlow,elementStrategy,penalties,weightedScore,evaluate};
})(window);
