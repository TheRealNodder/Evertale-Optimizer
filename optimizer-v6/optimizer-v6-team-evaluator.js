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

  function engineState(units,plan,options={}){
    const normalized=P.normalizeArchetype(plan)||'hybrid',signals=units.map(unit=>F.archetypeSignal(unit,normalized));
    const setup=signals.map(row=>row.setup).filter(Boolean).sort((a,b)=>b-a),payoff=signals.map(row=>row.payoff).filter(Boolean).sort((a,b)=>b-a);
    const paired=P.pairedPlans.includes(normalized),payoffOnly=P.payoffOnlyPlans.includes(normalized),selfContained=P.selfContainedPlans.includes(normalized),support=P.supportPlans.includes(normalized);
    const requiresSetup=paired||selfContained,requiresPayoff=paired||payoffOnly,requiresDirect=support,required=requiresSetup||requiresPayoff||requiresDirect;
    const contributorCount=signals.filter(row=>row.contributes).length,forced=options?.presetMode==='hard'||options?.forcePlanCoherence===true;
    const coverage=units.length?contributorCount/units.length:0;
    const minimumContributors=forced&&paired?Math.min(units.length,Math.max(2,Math.ceil(units.length*P.archetype.forcedPlanTeamShare))):forced&&required?Math.min(units.length,2):1;
    let score;
    if(paired)score=setup.length&&payoff.length?45+Math.min(15,setup.slice(0,3).reduce((s,v,i)=>s+v*[7,4,2][i],0))+Math.min(15,payoff.slice(0,3).reduce((s,v,i)=>s+v*[7,4,2][i],0))+coverage*25:0;
    else if(payoffOnly)score=payoff.length?55+Math.min(25,payoff.slice(0,4).reduce((s,v,i)=>s+v*[10,5,2,1][i],0))+coverage*20:0;
    else if(selfContained)score=setup.length?55+Math.min(25,setup.slice(0,4).reduce((s,v,i)=>s+v*[10,5,2,1][i],0))+coverage*20:0;
    else if(support)score=P.clamp(diminishing(signals.map(row=>row.score*100))/1.45);
    else score=P.clamp(Math.max(...P.pairedPlans.map(candidate=>engineState(units,candidate).score),0));
    const complete=(!requiresSetup||setup.length>0)&&(!requiresPayoff||payoff.length>0)&&(!requiresDirect||contributorCount>0),coherent=complete&&(!forced||contributorCount>=minimumContributors);
    return{plan:normalized,required,requiresSetup,requiresPayoff,requiresDirect,setupCount:setup.length,payoffCount:payoff.length,contributorCount,coverage,minimumContributors,coherenceRequired:forced,complete,coherent,score:P.clamp(score)};
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

  function requirementFor(archetype,size,primary=false,forced=false){
    const paired=P.pairedPlans.includes(archetype),payoffOnly=P.payoffOnlyPlans.includes(archetype),selfContained=P.selfContainedPlans.includes(archetype);
    const minimumContributors=paired&&(primary||forced)?Math.min(size,Math.max(2,Math.ceil(size*(forced?P.archetype.forcedPlanTeamShare:P.archetype.primaryTeamShare)))):forced&&(payoffOnly||selfContained||P.supportPlans.includes(archetype))?Math.min(size,2):1;
    return{paired,payoffOnly,selfContained,minimumContributors,requiresSetup:paired||selfContained,requiresPayoff:paired||payoffOnly};
  }

  function availabilityFor(units,archetype,primary=false,forced=false,teamSize=P.story.total){
    const normalized=P.normalizeArchetype(archetype),signals=units.map(unit=>F.archetypeSignal(unit,normalized)),requirement=requirementFor(normalized,teamSize,primary,forced);
    const contributors=signals.filter(row=>row.contributes).length,setupCount=signals.filter(row=>row.setup>0).length,payoffCount=signals.filter(row=>row.payoff>0).length;
    const feasible=contributors>=requirement.minimumContributors&&(!requirement.requiresSetup||setupCount>0)&&(!requirement.requiresPayoff||payoffCount>0);
    const reason=feasible?'':!contributors?`no authoritative ${normalized} evidence exists in the eligible roster`:requirement.requiresSetup&&!setupCount?`${normalized} setup evidence is unavailable`:requirement.requiresPayoff&&!payoffCount?`${normalized} payoff evidence is unavailable`:`only ${contributors} of ${requirement.minimumContributors} required ${normalized} contributors are available`;
    return{archetype:normalized,feasible,relaxed:!feasible,reason,contributors,setupCount,payoffCount,...requirement};
  }

  function planAvailability(units,plan,options={},teamSize=P.story.total){
    const normalized=P.normalizeArchetype(plan)||'hybrid';
    if(normalized==='hybrid')return{plan:normalized,feasible:true,relaxed:false,reason:'',contributors:units.length};
    const row=availabilityFor(units,normalized,false,options?.presetMode==='hard',teamSize);
    return{...row,plan:normalized};
  }

  function archetypeAvailability(units,options={},teamSize=P.story.total){
    const requested=P.requestedArchetypes(options),entries=requested.map((archetype,index)=>({...availabilityFor(units,archetype,index===0,false,teamSize),priority:index===0?'primary':'secondary'}));
    return{requested,primary:entries[0]||null,secondary:entries[1]||null,relaxations:entries.filter(row=>row.relaxed).map(row=>({archetype:row.archetype,priority:row.priority,reason:row.reason}))};
  }

  function archetypeState(units,options={}){
    const requested=P.requestedArchetypes(options),contract=options?.archetypeContract||{},entries=requested.map((archetype,index)=>{
      const priority=index===0?'primary':'secondary',requirement=requirementFor(archetype,units.length,index===0,false),signals=units.map(unit=>({unitId:unitId(unit),...F.archetypeSignal(unit,archetype)})),contributors=signals.filter(row=>row.contributes),setupCount=signals.filter(row=>row.setup>0).length,payoffCount=signals.filter(row=>row.payoff>0).length;
      const rosterContract=contract?.[priority],relaxed=rosterContract?.feasible===false;
      const satisfied=contributors.length>=requirement.minimumContributors&&(!requirement.requiresSetup||setupCount>0)&&(!requirement.requiresPayoff||payoffCount>0);
      const directScore=P.clamp(diminishing(contributors.map(row=>row.score*100),[1,.55,.3,.15])/(1+.55+.3+.15));
      return{
        archetype,priority,required:index===0&&!relaxed,relaxed,relaxationReason:relaxed?rosterContract.reason:'',satisfied,
        minimumContributors:requirement.minimumContributors,contributorCount:contributors.length,setupCount,payoffCount,
        score:satisfied?P.clamp(60+directScore*.4):relaxed?20:P.clamp(directScore*.45),
        contributors:contributors.map(row=>({unitId:row.unitId,score:P.clamp(row.score*100),features:row.features,sources:row.sources.slice(0,4)}))
      };
    });
    const primary=entries[0]||null,secondary=entries[1]||null,secondaryShare=secondary?P.archetype.secondaryScoreShare:0;
    const score=!primary?65:P.clamp(primary.score*(1-secondaryShare)+(secondary?secondary.score:0)*secondaryShare);
    return{requested,primary,secondary,entries,score,valid:!primary||primary.relaxed||primary.satisfied,relaxations:entries.filter(row=>row.relaxed).map(row=>({archetype:row.archetype,priority:row.priority,reason:row.relaxationReason}))};
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

  function storyFamilyMatches(profile,units){
    const description=P.txt(profile?.description),named=description.match(/\bnamed\s+(.+?)\s+have\s+their\b/i)?.[1]||'',names=named.split(/,|\band\b/i).map(P.key).filter(Boolean);
    if(!names.length)return 0;
    return units.filter(unit=>{const identity=P.identity(unit),unitName=P.key(unit?.name||unit?.title||identity.name);return names.some(name=>unitName===name||identity.name===name||identity.family===name||unitName.startsWith(`${name}_`));}).length;
  }

  function leaderCandidates(units,selectedPlan=''){
    return units.map(unit=>{
      const profile=unit?.__v6?.leaderProfile||null,text=P.txt([profile?.name,profile?.description,profile?.affected,profile?.condition,leaderText(unit)].join(' ')).toLowerCase(),hasLeader=!!(profile||unit?.leaderSkill?.internalId||unit?.refs?.leaderBuff||unit?.raw?.leaderBuff||E.best(unit?.__v6?.evidence?.leader,0));
      if(!hasLeader)return null;
      const matchKind=P.key(profile?.matchKind),structuredElements=rows(profile?.elements).map(P.normalizeArchetype).filter(element=>P.elements.includes(element)),element=structuredElements[0]||leaderElement(text),elements=structuredElements.length?structuredElements:element?[element]:[];
      const plans=rows(profile?.plans).map(P.normalizeArchetype).filter(Boolean),matches=elements.length?units.filter(row=>elements.includes(row?.__v6?.element||P.key(row?.element))).length:plans.length?units.filter(row=>plans.some(plan=>F.archetypeSignal(row,plan).contributes)).length:matchKind==='story_family'?storyFamilyMatches(profile,units):units.length;
      const structuredPercentages=(Array.isArray(profile?.percentages)?profile.percentages:Object.values(profile?.percentages||{})).map(value=>Number(value?.value??value)).filter(Number.isFinite);
      const primaryText=P.txt(profile?.affected||profile?.description||text),textPercent=Number(primaryText.match(/(\d+(?:\.\d+)?)\s*%/)?.[1]),percent=[textPercent,...structuredPercentages].find(value=>Number.isFinite(value)&&value>0&&value<=100)||15;
      const coverage=matches/P.story.leaderScope;
      const generic=profile?profile.generic===true:!elements.length,planAligned=!plans.length||plans.includes(P.normalizeArchetype(selectedPlan)),value=P.clamp(((generic?42:30)+Math.min(35,percent*1.6))*(planAligned?1:.82))*coverage;
      return{unitId:unitId(unit),leaderId:profile?.id||unit?.leaderSkill?.internalId||'',matchKind:matchKind||(generic?'allies':'inferred'),element:elements[0]||'all',elements:elements.length?elements:['all'],plans,matches,scope:P.story.leaderScope,coverage,percent,generic,planAligned,source:profile?'generated-leader-profile':'entry-leader-fields',score:value};
    }).filter(Boolean).sort((a,b)=>b.score-a.score||a.unitId.localeCompare(b.unitId));
  }

  function leaderValue(units,plan=''){
    const candidates=leaderCandidates(units,plan),selected=candidates[0]||null;
    return{score:selected?.score||0,stacking:P.story.leaderStacking,scope:P.story.leaderScope,selected,candidates:candidates.slice(0,5)};
  }

  function positionFlow(units){
    const main=units.slice(0,P.story.main),back=units.slice(P.story.main);
    const typed=units.some(unit=>F.timingProfile(unit).typed);
    const fallback=unit=>/entry|reinforce|from_reserve|when_entering|revenge|reviv/.test(P.key(unit?.description))?1:0;
    const front=mean(main.map(unit=>{const timing=F.timingProfile(unit),trigger=timing.typed?Math.max(timing.death,timing.revenge):0;return P.clamp(num(unit?.__v6?.stats?.spd)*.8+num(unit?.__v6?.roles?.control)*.45+num(unit?.__v6?.roles?.protection)*.45+trigger*18);}));
    const reserve=mean(back.map(unit=>{const timing=F.timingProfile(unit),trigger=timing.typed?Math.max(timing.entry,timing.reinforcement):fallback(unit);return P.clamp(num(unit?.__v6?.roles?.damage)*.55+num(unit?.__v6?.roles?.sustain)*.45+trigger*34);}));
    return{score:P.clamp(front*.58+reserve*.42),main:front,back:reserve,source:typed?'typed-feature-evidence':'description-fallback'};
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

  function counterCoverage(units,roles){
    const explicit=diminishing(units.map(unit=>F.counterProfile(unit).score),[1,.55,.3,.15])/2;
    return P.clamp(explicit*.62+roles.safety*.22+roles.tempo*.16);
  }

  function penalties(units,plan,engine,roles,resource,options={}){
    const statusPlans=['burn','poison','sleep','stun','frostburn'],setups=statusPlans.filter(name=>units.some(unit=>F.mechanical(unit?.__v6?.evidence,name,'setup')));
    const guardians=units.filter(unit=>num(unit?.__v6?.roles?.protection)>=35).length;
    const uncertainty=100-mean(units.map(unit=>num(unit?.__v6?.evidence?.confidence)*100));
    const activeStatuses=plan==='hybrid'?setups:statusPlans.includes(plan)?[plan]:[],vulnerabilities=units.map(unit=>Math.max(...activeStatuses.map(status=>F.antiSynergy(unit,status)),0)*50).filter(Boolean);
    return{
      statusConflicts:P.clamp(Math.max(0,setups.length-2)*22+(setups.includes('sleep')&&setups.some(x=>x!=='sleep')?18:0)),
      roleRedundancy:P.clamp(Math.max(0,guardians-2)*20+Math.max(0,roles.damage<25?20:0)),
      resourceConflicts:P.clamp(Math.max(
        plan==='tempo'&&units.every(unit=>!E.strength(unit?.__v6?.evidence?.resources?.spirit))?45:0,
        resource?.source==='structured-skill-profiles'?(num(resource.minimumReserve)*18+num(resource.competingHighCostActions)*8+(resource.conditionalGeneration>0&&!resource.reliableGeneration?25:0)):0
      )),
      unsupportedPayoffs:engine.required&&!engine.complete&&!options?.planContract?.relaxed?100:0,
      planDilution:engine.coherenceRequired&&engine.required?P.clamp(Math.max(0,engine.minimumContributors-engine.contributorCount)/Math.max(1,engine.minimumContributors)*100):0,
      planVulnerability:P.clamp(diminishing(vulnerabilities,[1,.55,.3,.15])),
      evidenceUncertainty:P.clamp(uncertainty)
    };
  }

  function resolvedComponentWeights(options={}){
    const profile=P.metaProfile(options),baseEntries=Object.entries(P.componentWeights).filter(([name])=>name!=='boundedMetaPrior');
    const baseTotal=baseEntries.reduce((sum,[,weight])=>sum+num(weight),0),baseScale=baseTotal?(1-profile.scoreWeight)/baseTotal:0;
    return Object.fromEntries([...baseEntries.map(([name,weight])=>[name,num(weight)*baseScale]),['boundedMetaPrior',profile.scoreWeight]]);
  }

  function weightedScore(components,penaltyValues,options={}){
    const weights=resolvedComponentWeights(options);
    let score=0;for(const [name,weight] of Object.entries(weights))score+=num(components[name])*weight;
    for(const [name,weight] of Object.entries(P.penaltyWeights))score-=num(penaltyValues[name])*weight;
    return P.clamp(score);
  }

  function evaluate(team,options={}){
    const units=rows(team),plan=P.normalizeArchetype(options.plan||'hybrid')||'hybrid',format=selectionMode(options);
    const validation=validateStory(units,options),engine=engineState(units,plan,options),archetypes=archetypeState(units,options),roles=roleCoverage(units),resource=resourceBalance(units,plan),pairs=pairSynergy(units,plan),leader=leaderValue(units,plan),position=positionFlow(units),element=elementStrategy(units,plan,format),counters=counterCoverage(units,roles);
    const components=P.boundedComponents({
      baseUnitValue:mean(units.map(unit=>num(unit?.__v6?.baseValue))),engineCompletion:engine.score,roleCoverage:roles.score,
      resourceBalance:resource.score,pairSynergy:pairs.score,groupSynergy:P.clamp(engine.score*.45+roles.score*.35+archetypes.score*.20),archetypeAlignment:archetypes.score,leaderValue:leader.score,
      positionFlow:position.score,elementStrategy:element.score,counterCoverage:counters,
      boundedMetaPrior:mean(units.map(unit=>num(unit?.__v6?.metaPrior))),evidenceConfidence:mean(units.map(unit=>num(unit?.__v6?.evidence?.confidence)*100))
    });
    const penaltyValues=P.boundedComponents(penalties(units,plan,engine,roles,resource,options));
    const formatError=(format==='rainbow'||format==='force_rainbow'||format==='mono'||format==='force_mono')&&options.strictFormat!==false&&!element.strict;
    const errors=[...validation.errors];
    const planRelaxed=options?.planContract?.relaxed===true;
    if(engine.required&&!engine.complete&&!planRelaxed&&options.requirePlanComplete!==false)errors.push(engine.requiresSetup?`${plan} requires both setup and payoff evidence`:`${plan} requires direct evidence`);
    if(engine.required&&engine.complete&&!engine.coherent&&!planRelaxed&&options.requirePlanComplete!==false)errors.push(`${plan} requires at least ${engine.minimumContributors} direct contributors; found ${engine.contributorCount}`);
    if(!archetypes.valid)errors.push(`Primary ${archetypes.primary.archetype} effect requires ${archetypes.primary.minimumContributors} direct contributor${archetypes.primary.minimumContributors===1?'':'s'}; found ${archetypes.primary.contributorCount}`);
    if(formatError&&!errors.some(error=>/mono|rainbow/i.test(error)))errors.push(`${format} coherence contract failed`);
    const componentWeights=resolvedComponentWeights(options),metaWeighting=P.metaProfile(options);
    const relaxations=[...(planRelaxed?[{type:'plan',plan,reason:options.planContract.reason}]:[]),...archetypes.relaxations.map(row=>({type:'archetype',...row}))];
    return{
      valid:errors.length===0,errors,score:errors.length?0:weightedScore(components,penaltyValues,options),components,componentWeights,metaWeighting,penalties:penaltyValues,
      plan,format,engine,archetypes,contributionLedger:{plan:{plan,contributors:engine.contributorCount,minimumContributors:engine.minimumContributors,setup:engine.setupCount,payoff:engine.payoffCount,complete:engine.complete,coherent:engine.coherent,vulnerableUnits:units.filter(unit=>F.antiSynergy(unit,plan)>0).map(unitId)},archetypes:archetypes.entries},roles,resource,pairs,leader,position,element,counters,relaxations,
      unmetNeeds:[engine.requiresSetup&&!engine.setupCount?'setup':'',engine.requiresPayoff&&!engine.payoffCount?'payoff':'',roles.damage<25?'damage':'',roles.safety<25?'protection/sustain':'',roles.tempo<20?'control/tempo':''].filter(Boolean)
    };
  }

  root.teamEvaluator={validateStory,engineState,requirementFor,availabilityFor,planAvailability,archetypeAvailability,archetypeState,roleCoverage,resourceBalance,pairValue,pairSynergy,leaderCandidates,leaderValue,positionFlow,elementStrategy,counterCoverage,penalties,resolvedComponentWeights,weightedScore,evaluate};
})(window);
