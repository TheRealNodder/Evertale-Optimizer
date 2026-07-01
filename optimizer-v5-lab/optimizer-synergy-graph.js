(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  if(!S)return;
  const engines=['burn','poison','sleep','stun','blood','crisis','survivor','stealth','void'];
  const setupRequired=new Set(['burn','poison','sleep','stun','blood','stealth']);

  function keys(obj){return Object.keys(obj||{}).filter(k=>obj[k]);}
  function feature(unit){return unit?.__v5?.features||{};}
  function role(unit,key){return S.num(feature(unit)?.roles?.[key]);}
  function sameElement(a,b){return !!S.clean(a?.element)&&S.clean(a?.element)===S.clean(b?.element);}
  function engineKeys(f){return engines.filter(key=>(f?.applies&&f.applies[key])||(f?.consumes&&f.consumes[key]));}
  function fragileAnchor(unit){const f=feature(unit);return role(unit,'anchor')>0&&!keys(f.protects).length&&role(unit,'tank')<.5;}
  function pairScore(a,b){
    const af=feature(a),bf=feature(b);
    const reasons=[],conflicts=[];
    let positiveScore=0,conflictPenalty=0;
    const reward=(value,reason)=>{positiveScore+=value;if(reason)reasons.push(reason);};
    const penalize=(value,reason)=>{conflictPenalty+=value;if(reason)conflicts.push(reason);};

    for(const k of keys(af.applies)){if(bf.consumes&&bf.consumes[k])reward(5200,`${S.txt(a.name||a.id)} applies ${k} for ${S.txt(b.name||b.id)}`);}
    for(const k of keys(bf.applies)){if(af.consumes&&af.consumes[k])reward(5200,`${S.txt(b.name||b.id)} applies ${k} for ${S.txt(a.name||a.id)}`);}

    if(af.enables?.spirit&&bf.consumes?.spirit)reward(2400,'spirit battery supports expensive payoff');
    if(bf.enables?.spirit&&af.consumes?.spirit)reward(2400,'spirit battery supports expensive payoff');
    if(af.enables?.spirit&&bf.consumes?.void)penalize(2600,'spirit gain conflicts with low-spirit void payoff');
    if(bf.enables?.spirit&&af.consumes?.void)penalize(2600,'spirit gain conflicts with low-spirit void payoff');
    if(af.enables?.turn&&role(b,'anchor')>0)reward(1900,'turn grant accelerates anchor');
    if(bf.enables?.turn&&role(a,'anchor')>0)reward(1900,'turn grant accelerates anchor');
    if(af.enables?.tu_reduction&&role(b,'anchor')>0)reward(1500,'TU reduction accelerates anchor');
    if(bf.enables?.tu_reduction&&role(a,'anchor')>0)reward(1500,'TU reduction accelerates anchor');
    if(keys(af.protects).length&&role(b,'anchor')>0)reward(fragileAnchor(b)?2300:1600,'protection covers anchor');
    if(keys(bf.protects).length&&role(a,'anchor')>0)reward(fragileAnchor(a)?2300:1600,'protection covers anchor');
    if(af.enables?.cleanse&&role(b,'anchor')>0)reward(1000,'cleanse improves anchor safety');
    if(bf.enables?.cleanse&&role(a,'anchor')>0)reward(1000,'cleanse improves anchor safety');
    if(af.enables?.summon&&bf.consumes?.blood)reward(3000,'summon creation feeds blood payoff');
    if(bf.enables?.summon&&af.consumes?.blood)reward(3000,'summon creation feeds blood payoff');
    if((af.enables?.revive||af.protects?.heal)&&(bf.consumes?.survivor||bf.consumes?.crisis))reward(2200,'revive/heal sustains survivor or crisis payoff');
    if((bf.enables?.revive||bf.protects?.heal)&&(af.consumes?.survivor||af.consumes?.crisis))reward(2200,'revive/heal sustains survivor or crisis payoff');

    const sharedEngines=engineKeys(af).filter(key=>engineKeys(bf).includes(key));
    if(sharedEngines.length)reward(700*sharedEngines.length,'same-engine stacking');
    if(sharedEngines.length&&sameElement(a,b))reward(900,'mono-element same-engine support');

    if((af.applies?.burn&&bf.consumes?.poison)||(bf.applies?.burn&&af.consumes?.poison))penalize(3400,'burn setup conflicts with poison payoff');
    if((af.applies?.poison&&bf.consumes?.burn)||(bf.applies?.poison&&af.consumes?.burn))penalize(3400,'poison setup conflicts with burn payoff');
    if(af.applies?.sleep&&(bf.conflicts?.random_aoe||bf.conflicts?.all_enemy_damage))penalize(3800,'sleep setup can be broken by random/all-enemy damage');
    if(bf.applies?.sleep&&(af.conflicts?.random_aoe||af.conflicts?.all_enemy_damage))penalize(3800,'sleep setup can be broken by random/all-enemy damage');
    if(af.applies?.sleep&&(bf.applies?.burn||bf.applies?.poison))penalize(2400,'burn/poison application can overwrite sleep');
    if(bf.applies?.sleep&&(af.applies?.burn||af.applies?.poison))penalize(2400,'burn/poison application can overwrite sleep');

    return{score:positiveScore-conflictPenalty,positiveScore,conflictPenalty,reasons,conflicts};
  }
  function build(rows){
    const map=new Map();
    const list=S.arr(rows);
    for(let i=0;i<list.length;i++){
      for(let j=i+1;j<list.length;j++){
        const a=list[i],b=list[j],ab=pairScore(a,b);
        if(ab.score||ab.reasons.length||ab.conflicts.length){
          const aid=S.txt(a.id),bid=S.txt(b.id);
          map.set(aid+'::'+bid,ab);
          map.set(bid+'::'+aid,ab);
        }
      }
    }
    return{map,score(a,b){return map.get(S.txt(a?.id)+'::'+S.txt(b?.id))?.score||0;},edge(a,b){return map.get(S.txt(a?.id)+'::'+S.txt(b?.id))||{score:0,positiveScore:0,conflictPenalty:0,reasons:[],conflicts:[]};}};
  }
  function teamAnalysis(ids,byId,graph){
    const units=S.arr(ids).map(id=>byId.get(S.txt(id))).filter(Boolean);
    let synergyScore=0,conflictPenalty=0;
    const reasons=[],conflicts=[];
    for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
      const edge=graph.edge(units[i],units[j]);
      synergyScore+=S.num(edge.positiveScore,Math.max(0,edge.score));
      conflictPenalty+=S.num(edge.conflictPenalty,Math.max(0,-edge.score));
      reasons.push(...S.arr(edge.reasons));conflicts.push(...S.arr(edge.conflicts));
    }
    const setup={},payoff={};
    let anchors=0,supports=0,spiritGain=0,spiritPressure=0;
    for(const unit of units){
      const f=feature(unit);anchors+=role(unit,'anchor')>0?1:0;supports+=role(unit,'support')>0?1:0;
      spiritGain+=f.enables?.spirit?1:0;spiritPressure+=f.consumes?.spirit?1:0;
      for(const key of engines){setup[key]=(setup[key]||0)+(f.applies?.[key]?1:0);payoff[key]=(payoff[key]||0)+(f.consumes?.[key]?1:0);}
      if(f.enables?.summon)setup.blood=(setup.blood||0)+1;
    }
    for(const key of engines){
      if(setupRequired.has(key)&&payoff[key]&&!setup[key]){const penalty=payoff[key]*2600;conflictPenalty+=penalty;conflicts.push(`${key} payoff has no setup`);}
      const stack=(setup[key]||0)+(payoff[key]||0);if(setup[key]&&payoff[key]&&stack>2){synergyScore+=(stack-2)*700;reasons.push(`${key} engine stacking`);}
    }
    if(supports>1&&!anchors){conflictPenalty+=(supports-1)*1900;conflicts.push('too many supports with no anchor');}
    if(spiritPressure&&!spiritGain){conflictPenalty+=spiritPressure*2100;conflicts.push('spirit-heavy team has no spirit gain');}
    if((payoff.void||0)&&spiritGain){conflictPenalty+=(payoff.void||0)*spiritGain*1500;conflicts.push('void payoff is pressured by spirit gain');}
    return{score:synergyScore-conflictPenalty,synergyScore,conflictPenalty,reasons:[...new Set(reasons)],conflicts:[...new Set(conflicts)],engines:{setup,payoff}};
  }
  function teamScore(ids,byId,graph){return teamAnalysis(ids,byId,graph).score;}

  root.synergyGraph={pairScore,build,teamScore,teamAnalysis,engineKeys};
})(window);
