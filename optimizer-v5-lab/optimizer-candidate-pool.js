(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  if(!S)return;

  function unitScore(unit,plan,graphRows){
    const st=unit?.__v5?.stats||{};
    const f=unit?.__v5?.features||{};
    const newer=root.metaPriority?root.metaPriority.boost(unit,'score'):0;
    let score=(st.power?st.power*.07:0)+S.num(st.atk)*.46+S.num(st.hp)*.05+S.num(st.spd)*12+(S.num(st.atk)/Math.max(1,S.num(st.cost,1)))*.18;
    if(f.roles){score+=S.num(f.roles.anchor)*2400+S.num(f.roles.dps)*1800+S.num(f.roles.support)*1400+S.num(f.roles.control)*1400+S.num(f.roles.tank)*1200;}
    if(plan&&f.applies&&f.applies[plan])score+=2600;
    if(plan&&f.consumes&&f.consumes[plan])score+=3600;
    score+=newer;
    if(graphRows){for(const other of graphRows.slice(0,25))if(other!==unit)score+=Math.max(0,root.synergyGraph.pairScore(unit,other).score)*.08;}
    return score;
  }
  function selectPlan(options,rows){
    const C=S.constants;
    const picked=[options?.presetTag,...S.arr(options?.archetypes)].map(v=>C.aliases[S.low(v)]??S.low(v)).find(v=>v&&v!=='auto'&&v!=='none'&&C.plans[v]);
    if(picked)return picked;
    let best='offense',score=-1;
    for(const [plan,words] of Object.entries(C.plans)){
      let n=0;for(const u of S.arr(rows).slice(0,80)){const b=u?.__v5?.features?.blob||S.textBlob(u);if(S.has(b,words))n++;}
      if(n>score){score=n;best=plan;}
    }
    return best;
  }
  function sortRows(rows){return S.arr(rows).sort((a,b)=>S.num(b?.__v5?.score)-S.num(a?.__v5?.score)||(b?.__v5?.meta?.newer||0)-(a?.__v5?.meta?.newer||0)||S.identity(a).entry.localeCompare(S.identity(b).entry));}
  function build(rows,options){
    const list=S.arr(rows),cap=options?.exampleMode?120:140;
    const plan=selectPlan(options||{},list);
    const scored=list.map(unit=>{const clone={...unit};clone.__v5={...(clone.__v5||{}),score:unitScore(unit,plan,list)};return clone;});
    const sorted=sortRows(scored);
    if(sorted.length<=cap)return{plan,rows:sorted,cap};
    const chosen=new Map(),add=u=>{const id=S.txt(u?.id);if(id&&!chosen.has(id))chosen.set(id,u);};
    const newest=root.metaPriority?root.metaPriority.newest(sorted,Math.ceil(cap*.35)):[];
    sorted.slice(0,Math.floor(cap*.55)).forEach(add);
    newest.forEach(add);
    sorted.filter(u=>S.num(u?.__v5?.features?.roles?.support)>0||S.num(u?.__v5?.features?.roles?.tank)>0||S.num(u?.__v5?.features?.roles?.control)>0).slice(0,Math.ceil(cap*.20)).forEach(add);
    for(const u of sorted){if(chosen.size>=cap)break;add(u);}
    return{plan,rows:sortRows([...chosen.values()]),cap};
  }

  root.candidatePool={build,unitScore,selectPlan,sortRows};
})(window);
