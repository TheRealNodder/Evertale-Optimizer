(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const P=root.policy,E=root.evidence,R=root.resourceReasoner;
  if(!P||!E||!R)return;

  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  const rows=value=>Array.isArray(value)?value:[];
  const archetypeSignalCache=new WeakMap(),timingProfileCache=new WeakMap(),counterProfileCache=new WeakMap();

  function stats(unit){
    const value=unit?.__v5?.stats||unit?.stats||{};
    return{atk:number(value.atk??unit?.atk),hp:number(value.hp??unit?.hp),spd:number(value.spd??unit?.spd),cost:Math.max(1,number(value.cost??unit?.cost)||1),power:number(value.power??unit?.power??unit?.unitPower)};
  }

  function percentile(sorted,value){
    if(!sorted.length)return 0;
    let low=0,high=sorted.length;
    while(low<high){const mid=(low+high)>>1;if(sorted[mid]<=value)low=mid+1;else high=mid;}
    return P.clamp((low/Math.max(1,sorted.length))*100);
  }

  function populationStats(units){
    const values=rows(units).map(stats);
    const field=name=>values.map(row=>row[name]).sort((a,b)=>a-b);
    return{atk:field('atk'),hp:field('hp'),spd:field('spd'),power:field('power'),efficiency:values.map(row=>row.atk/row.cost).sort((a,b)=>a-b)};
  }

  function baseValue(unit,population){
    const value=stats(unit),pop=population||populationStats([unit]);
    const power=value.power>0?percentile(pop.power,value.power):50;
    return P.clamp(
      percentile(pop.atk,value.atk)*.31+
      percentile(pop.hp,value.hp)*.25+
      percentile(pop.spd,value.spd)*.18+
      percentile(pop.efficiency,value.atk/value.cost)*.16+
      power*.10
    );
  }

  function mechanical(model,plan,kind){return E.strength(model?.engines?.[plan]?.[kind]);}
  function roleEvidence(model,role){return E.strength(model?.roles?.[role],P.evidence.minimumRoleConfidence);}
  function timingEvidence(model,timing){return E.strength(model?.timing?.[timing],P.evidence.minimumRoleConfidence);}
  function counterEvidence(model,counter){return E.strength(model?.counters?.[counter],P.evidence.minimumRoleConfidence);}
  function removalConflict(unit,plan){
    const normalized=P.normalizeArchetype(plan),records=rows(unit?.__v6?.evidence?.counters?.[`removes_${normalized}`]);if(!records.length)return 0;
    const relevant=records.filter(record=>{
      if(!record?.authoritative)return false;if(normalized==='burn')return true;
      const targets=rows(record.receipts).map(row=>P.key(row?.targetTeam));return !targets.length||targets.some(target=>target==='enemies'||target==='unknown');
    });
    return E.strength(relevant);
  }
  function destructiveRemoval(unit,plan){
    const normalized=P.normalizeArchetype(plan),records=rows(unit?.__v6?.evidence?.counters?.[`removes_${normalized}`]);
    return E.strength(records.filter(record=>record?.authoritative&&rows(record.receipts).some(row=>P.key(row?.targetTeam)==='enemies')));
  }
  function hardPlanConflict(unit,plan){
    const normalized=P.normalizeArchetype(plan);if(!P.pairedPlans.includes(normalized)||!destructiveRemoval(unit,normalized)||mechanical(unit?.__v6?.evidence,normalized,'setup'))return false;
    return P.pairedPlans.some(candidate=>candidate!==normalized&&mechanical(unit?.__v6?.evidence,candidate,'setup')>0);
  }
  function antiSynergy(unit,plan){return Math.max(E.strength(unit?.__v6?.evidence?.antiSynergies?.[P.normalizeArchetype(plan)]),removalConflict(unit,plan)*.82);}

  function roleScores(model){
    const setup=plan=>mechanical(model,plan,'setup'),payoff=plan=>mechanical(model,plan,'payoff');
    const statusPayoff=Math.max(...[...P.pairedPlans,...P.payoffOnlyPlans].map(payoff),0);
    const statusSetup=Math.max(...[...P.pairedPlans,...P.selfContainedPlans].map(setup),0);
    const teamHeal=Math.max(roleEvidence(model,'team_healer'),roleEvidence(model,'ally_healer')*.82,roleEvidence(model,'healer')*.72);
    const selfSustain=roleEvidence(model,'self_sustain');
    const teamCleanse=Math.max(roleEvidence(model,'team_cleanser'),roleEvidence(model,'cleanser')*.72,roleEvidence(model,'ally_cleanser')*.82);
    const selfCleanse=roleEvidence(model,'self_cleanser');
    const guardian=roleEvidence(model,'guardian'),defender=roleEvidence(model,'defender'),holdGround=counterEvidence(model,'hold_ground');
    return{
      damage:P.clamp(Math.max(statusPayoff*58,roleEvidence(model,'attacker')*64)),
      protection:P.clamp(Math.max(guardian*68,defender*64,holdGround*52,roleEvidence(model,'reviver')*54)),
      sustain:P.clamp(Math.max(teamHeal*68,teamCleanse*62,selfSustain*34,selfCleanse*30,roleEvidence(model,'reviver')*66)),
      control:P.clamp(Math.max(setup('sleep'),setup('stun'))*62),
      tempo:P.clamp(roleEvidence(model,'tempo')*62),
      setup:P.clamp(statusSetup*56)
    };
  }

  function recordsFrom(model,paths){
    const out=[];
    for(const [group,name,kind] of paths){
      const value=kind?model?.[group]?.[name]?.[kind]:model?.[group]?.[name];
      for(const row of rows(value))if(row?.authoritative)out.push(row);
    }
    return out.sort((a,b)=>(b.strength*b.confidence)-(a.strength*a.confidence));
  }

  function archetypeSignal(unit,requested){
    const archetype=P.normalizeArchetype(requested),cached=unit&&typeof unit==='object'?archetypeSignalCache.get(unit):null;if(cached?.has(archetype))return cached.get(archetype);
    const model=unit?.__v6?.evidence||{},roles=unit?.__v6?.roles||{};
    const paired=P.pairedPlans.includes(archetype),payoffOnly=P.payoffOnlyPlans.includes(archetype),selfContained=P.selfContainedPlans.includes(archetype);
    let kind=paired?'paired':payoffOnly?'payoff':selfContained?'self_contained':'support',setup=0,payoff=0,direct=0,receipts=[];
    if(paired||payoffOnly||selfContained){
      setup=paired||selfContained?mechanical(model,archetype,'setup'):0;payoff=mechanical(model,archetype,'payoff');
      const transition=archetype==='burn'?E.strength(model?.transitions?.frostburn_to_burn)*.55:0;
      direct=Math.max(setup,payoff,transition);receipts=recordsFrom(model,[['engines',archetype,'setup'],['engines',archetype,'payoff'],...(archetype==='burn'?[['transitions','frostburn_to_burn']]:[])]);
    }else if(archetype==='heal'){
      const team=roleEvidence(model,'team_healer'),ally=Math.max(roleEvidence(model,'ally_healer'),roleEvidence(model,'healer')*.72)*.82,self=roleEvidence(model,'self_sustain')*P.archetype.selfOnlyMaximum,revive=roleEvidence(model,'reviver')*.55;
      direct=Math.max(team,ally,self,revive);receipts=recordsFrom(model,[['roles','team_healer'],['roles','ally_healer'],['roles','healer'],['roles','self_sustain'],['roles','reviver']]);
    }else if(archetype==='cleanse'){
      const team=roleEvidence(model,'team_cleanser'),ally=Math.max(roleEvidence(model,'ally_cleanser'),roleEvidence(model,'cleanser')*.72)*.82,self=roleEvidence(model,'self_cleanser')*P.archetype.selfOnlyMaximum;
      direct=Math.max(team,ally,self);receipts=recordsFrom(model,[['roles','team_cleanser'],['roles','ally_cleanser'],['roles','cleanser'],['roles','self_cleanser']]);
    }else if(archetype==='defense'){
      direct=Math.max(roleEvidence(model,'guardian'),roleEvidence(model,'defender'),counterEvidence(model,'hold_ground')*.7);
      receipts=recordsFrom(model,[['roles','guardian'],['roles','defender'],['counters','hold_ground']]);
    }else if(archetype==='guardian'){
      direct=roleEvidence(model,'guardian');receipts=recordsFrom(model,[['roles','guardian']]);
    }else if(archetype==='attack'){
      direct=Math.max(roleEvidence(model,'attacker'),number(roles.damage)/100*1.35);receipts=recordsFrom(model,[['roles','attacker']]);
    }else if(archetype==='spirit'){
      direct=E.strength(model?.resources?.spirit);receipts=recordsFrom(model,[['resources','spirit']]);
    }else if(archetype==='tempo'){
      direct=roleEvidence(model,'tempo');receipts=recordsFrom(model,[['roles','tempo']]);
    }else if(archetype==='hybrid'){
      direct=Math.max(number(roles.damage),number(roles.protection),number(roles.sustain),number(roles.control),number(roles.tempo))/70;
    }
    const score=P.clamp(direct/2*100)/100;
    const result={
      archetype,kind,setup,payoff,direct,score,contributes:score>=P.archetype.contributionThreshold,
      features:[...new Set(receipts.map(row=>row.feature))],sources:[...new Set(receipts.flatMap(row=>rows(row.sources)))],receipts:receipts.slice(0,4)
    };
    if(unit&&typeof unit==='object'){const next=cached||new Map();next.set(archetype,result);if(!cached)archetypeSignalCache.set(unit,next);}return result;
  }

  function timingProfile(unit){
    if(unit&&typeof unit==='object'&&timingProfileCache.has(unit))return timingProfileCache.get(unit);
    const model=unit?.__v6?.evidence||{},entry=timingEvidence(model,'entry'),reinforcement=timingEvidence(model,'reinforcement'),death=timingEvidence(model,'death'),revenge=timingEvidence(model,'revenge');
    const result={entry,reinforcement,death,revenge,typed:Math.max(entry,reinforcement,death,revenge)>0};if(unit&&typeof unit==='object')timingProfileCache.set(unit,result);return result;
  }

  function counterProfile(unit){
    if(unit&&typeof unit==='object'&&counterProfileCache.has(unit))return counterProfileCache.get(unit);
    const model=unit?.__v6?.evidence||{},names=['ward_burn','ward_poison','ward_sleep','ward_stun','removes_burn','removes_poison','removes_sleep','removes_stun','hold_ground'],values=Object.fromEntries(names.map(name=>[name,counterEvidence(model,name)]));
    const result={...values,score:P.clamp(Object.values(values).filter(Boolean).sort((a,b)=>b-a).slice(0,3).reduce((sum,value,index)=>sum+value*[34,20,10][index],0))};if(unit&&typeof unit==='object')counterProfileCache.set(unit,result);return result;
  }

  function advisoryMeta(unit,generatedMeta,options={}){
    const advisory=options?.advisoryMeta;
    if(!advisory?.enabled||Number(advisory?.schemaVersion)!==1){
      return{score:P.clamp(generatedMeta),applied:false,source:'generated-roster-order',confidence:1};
    }
    const order=number(unit?.__v5?.meta?.order),maximum=number(advisory?.maxOrder);
    const globalRelease=order>0&&maximum>1?P.clamp((order-1)/(maximum-1)*100):P.clamp(generatedMeta);
    const identity=P.identity(unit),scores=advisory?.scoresByIdentity||{};
    const observed=Math.max(...[identity.entry,identity.family,identity.sourceId,P.key(unit?.sourceId),P.key(unit?.internal?.sourceId)]
      .map(key=>number(scores[key])).filter(value=>value>0),0);
    const advised=observed>0?P.clamp(globalRelease*.9+observed*.1):globalRelease;
    return{
      score:P.clamp(Math.max(globalRelease,advised)),applied:true,source:String(advisory.source||'generated-release-order'),
      confidence:P.clamp(number(advisory.confidence)*100)/100,globalRelease,observed
    };
  }

  function attach(units,options={}){
    const source=rows(units),population=populationStats(source),store=E.runtimeStore(),skillStore=R.runtimeStore();
    return source.map(unit=>{
      const clone={...unit};
      const evidence=E.summarize(unit,store);
      const generatedMeta=P.clamp(number(unit?.__v5?.meta?.newer)*100),meta=advisoryMeta(unit,generatedMeta,options);
      clone.__v6={
        identity:P.identity(unit),stats:stats(unit),baseValue:baseValue(unit,population),evidence,
        roles:roleScores(evidence),skillProfile:R.unitProfile(unit,skillStore),leaderProfile:E.leaderProfileFor(unit),
        metaPrior:meta.score,metaEvidence:meta,element:P.key(unit?.element)
      };
      return clone;
    });
  }

  function featureContribution(unit,plan){
    const roles=unit?.__v6?.roles||{};
    const role=Math.max(number(roles.damage),number(roles.protection),number(roles.sustain),number(roles.control),number(roles.tempo),number(roles.setup))/100;
    if(P.normalizeArchetype(plan)==='hybrid'){
      const model=unit?.__v6?.evidence||{},direct=Math.max(...[...P.pairedPlans,...P.payoffOnlyPlans,...P.selfContainedPlans].map(archetype=>Math.max(mechanical(model,archetype,'setup'),mechanical(model,archetype,'payoff'))/2),0);
      return P.clamp(direct*70+role*30)/100;
    }
    const direct=archetypeSignal(unit,plan).score;
    return P.clamp(direct*72+role*28)/100;
  }

  root.featureModel={stats,percentile,populationStats,baseValue,mechanical,roleEvidence,timingEvidence,counterEvidence,removalConflict,destructiveRemoval,hardPlanConflict,antiSynergy,roleScores,archetypeSignal,timingProfile,counterProfile,advisoryMeta,attach,featureContribution};
})(window);
