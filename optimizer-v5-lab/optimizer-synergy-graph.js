(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  if(!S)return;

  function keys(obj){return Object.keys(obj||{}).filter(k=>obj[k]);}
  function pairScore(a,b){
    const af=a?.__v5?.features||{},bf=b?.__v5?.features||{};
    const reasons=[],conflicts=[];
    let score=0;

    for(const k of keys(af.applies)){if(bf.consumes&&bf.consumes[k]){score+=4200;reasons.push(`${S.txt(a.name||a.id)} applies ${k} for ${S.txt(b.name||b.id)}`);}}
    for(const k of keys(bf.applies)){if(af.consumes&&af.consumes[k]){score+=4200;reasons.push(`${S.txt(b.name||b.id)} applies ${k} for ${S.txt(a.name||a.id)}`);}}

    if((af.enables&&af.enables.spirit)&&keys(bf.consumes).length){score+=1200;reasons.push('spirit support for payoff');}
    if((bf.enables&&bf.enables.spirit)&&keys(af.consumes).length){score+=1200;reasons.push('spirit support for payoff');}
    if((af.enables&&af.enables.turn)&&((bf.roles&&bf.roles.anchor)||0)>0){score+=1400;reasons.push('turn tempo supports anchor');}
    if((bf.enables&&bf.enables.turn)&&((af.roles&&af.roles.anchor)||0)>0){score+=1400;reasons.push('turn tempo supports anchor');}
    if(keys(af.protects).length&&((bf.roles&&bf.roles.anchor)||0)>0){score+=1300;reasons.push('protection covers anchor');}
    if(keys(bf.protects).length&&((af.roles&&af.roles.anchor)||0)>0){score+=1300;reasons.push('protection covers anchor');}

    if((af.applies&&af.applies.burn)&&(bf.applies&&bf.applies.poison)){score-=1800;conflicts.push('burn and poison engines may fight');}
    if((af.applies&&af.applies.poison)&&(bf.applies&&bf.applies.burn)){score-=1800;conflicts.push('poison and burn engines may fight');}
    if((af.applies&&af.applies.sleep)&&bf.conflicts&&bf.conflicts.sleepBreak){score-=2200;conflicts.push('sleep setup can be broken by random/all damage');}
    if((bf.applies&&bf.applies.sleep)&&af.conflicts&&af.conflicts.sleepBreak){score-=2200;conflicts.push('sleep setup can be broken by random/all damage');}

    return{score,reasons,conflicts};
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
    return{map,score(a,b){return map.get(S.txt(a?.id)+'::'+S.txt(b?.id))?.score||0;},edge(a,b){return map.get(S.txt(a?.id)+'::'+S.txt(b?.id))||{score:0,reasons:[],conflicts:[]};}};
  }
  function teamScore(ids,byId,graph){
    const units=S.arr(ids).map(id=>byId.get(S.txt(id))).filter(Boolean);
    let score=0;
    for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++)score+=graph.score(units[i],units[j]);
    return score;
  }

  root.synergyGraph={pairScore,build,teamScore};
})(window);
