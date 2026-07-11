(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const P=root.policy,E=root.evidence;
  if(!P||!E)return;

  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  const rows=value=>Array.isArray(value)?value:[];

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

  function roleScores(model){
    const setup=plan=>mechanical(model,plan,'setup'),payoff=plan=>mechanical(model,plan,'payoff');
    const statusPayoff=Math.max(...['burn','poison','sleep','stun','blood','crisis','survivor'].map(payoff),0);
    const statusSetup=Math.max(...['burn','poison','sleep','stun','blood'].map(setup),0);
    return{
      damage:P.clamp(statusPayoff*58),
      protection:P.clamp(Math.max(roleEvidence(model,'guardian')*68,roleEvidence(model,'reviver')*54)),
      sustain:P.clamp(Math.max(roleEvidence(model,'healer')*62,roleEvidence(model,'cleanser')*58,roleEvidence(model,'reviver')*66)),
      control:P.clamp(Math.max(setup('sleep'),setup('stun'))*62),
      tempo:P.clamp(roleEvidence(model,'tempo')*62),
      setup:P.clamp(statusSetup*56)
    };
  }

  function attach(units){
    const source=rows(units),population=populationStats(source),store=E.runtimeStore();
    return source.map(unit=>{
      const clone={...unit};
      const evidence=E.summarize(unit,store);
      const meta=P.clamp(number(unit?.__v5?.meta?.newer)*100);
      clone.__v6={
        identity:P.identity(unit),stats:stats(unit),baseValue:baseValue(unit,population),evidence,
        roles:roleScores(evidence),metaPrior:P.clamp(meta*.05),element:P.key(unit?.element)
      };
      return clone;
    });
  }

  function featureContribution(unit,plan){
    const model=unit?.__v6?.evidence||{};
    const engines=plan==='hybrid'?Object.keys(model.engines||{}):[plan];
    const setup=Math.max(...engines.map(name=>mechanical(model,name,'setup')),0),payoff=Math.max(...engines.map(name=>mechanical(model,name,'payoff')),0);
    const roles=unit?.__v6?.roles||{};
    const role=Math.max(number(roles.damage),number(roles.protection),number(roles.sustain),number(roles.control),number(roles.tempo))/100;
    return P.clamp((Math.max(setup,payoff)/2)*70+role*30)/100;
  }

  root.featureModel={stats,percentile,populationStats,baseValue,mechanical,roleEvidence,roleScores,attach,featureContribution};
})(window);
