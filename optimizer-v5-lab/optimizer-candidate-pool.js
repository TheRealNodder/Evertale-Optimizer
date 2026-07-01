(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  if(!S)return;

  function unitScore(unit,plan){
    const st=unit?.__v5?.stats||{};
    const f=unit?.__v5?.features||{};
    const newer=root.metaPriority?root.metaPriority.boost(unit,'score'):0;
    let score=(st.power?st.power*.07:0)+S.num(st.atk)*.46+S.num(st.hp)*.05+S.num(st.spd)*12+(S.num(st.atk)/Math.max(1,S.num(st.cost,1)))*.18;
    if(f.roles){score+=S.num(f.roles.anchor)*2400+S.num(f.roles.dps)*1800+S.num(f.roles.support)*1400+S.num(f.roles.control)*1400+S.num(f.roles.tank)*1200;}
    const fit=planValue(unit,plan);if(fit)score+=Math.min(2,fit)*2200;
    if(plan&&f.consumes&&f.consumes[plan])score+=1000;
    if(root.doctrine&&typeof root.doctrine.planProfile==='function'){
      const doctrine=root.doctrine.planProfile(unit,plan);
      if(doctrine.eligible)score+=doctrine.direct*1200+doctrine.affinity*700+Math.min(2,doctrine.support)*220;
    }
    score+=newer;
    return score;
  }
  function normalizedPlan(value){
    const C=S.constants,key=C.aliases[S.low(value)]??S.low(value);
    return key&&key!=='auto'&&key!=='none'&&C.plans[key]?key:'';
  }
  function selectPlan(options,rows){
    const C=S.constants;
    const hard=options?.presetMode==='hard'?normalizedPlan(options?.presetTag):'';
    if(hard)return hard;
    const picked=[options?.v5Plan,options?.presetTag,...S.arr(options?.archetypes)].map(normalizedPlan).find(Boolean);
    if(picked)return picked;
    let best='offense',score=-1;
    for(const [plan,words] of Object.entries(C.plans)){
      let n=0;for(const u of S.arr(rows).slice(0,80)){
        const f=u?.__v5?.features||{},b=f.blob||S.textBlob(u);
        n+=S.num(f.applies?.[plan])*2.2+S.num(f.consumes?.[plan])*3;
        if(plan==='guardian')n+=(Object.keys(f.protects||{}).length?1.8:0);
        else if(plan==='heal')n+=(f.protects?.heal||f.enables?.cleanse||f.enables?.revive)?1.8:0;
        else if(plan==='turn')n+=((f.enables?.spirit||f.enables?.turn||f.enables?.tu_reduction)?1.8:0)+(f.consumes?.spirit?1.2:0);
        else if(plan==='blood')n+=(f.enables?.summon||f.consumes?.blood)?1.8:0;
        else if(plan==='offense')n+=(S.num(f.roles?.dps)+S.num(f.roles?.anchor))*.35;
        if(S.has(b,words))n+=.2;
      }
      if(n>score){score=n;best=plan;}
    }
    return best;
  }
  function sortRows(rows){return S.arr(rows).sort((a,b)=>S.num(b?.__v5?.score)-S.num(a?.__v5?.score)||(b?.__v5?.meta?.newer||0)-(a?.__v5?.meta?.newer||0)||S.identity(a).entry.localeCompare(S.identity(b).entry));}
  function selectionMode(options){return options?.doctrineOverrides?.monoVsRainbow?.selectionMode||options?.teamType||'auto';}
  function roleValue(unit,key){return S.num(unit?.__v5?.features?.roles?.[key]);}
  function planValue(unit,plan){
    const f=unit?.__v5?.features||{};let value=S.num(f.applies?.[plan])+S.num(f.consumes?.[plan]);
    if(plan==='turn')value+=S.num(f.enables?.spirit)+S.num(f.enables?.turn)+S.num(f.enables?.tu_reduction)+S.num(f.consumes?.spirit)*.6;
    else if(plan==='guardian')value+=S.num(f.protects?.guard)+S.num(f.protects?.barrier)+S.num(f.protects?.hold_ground);
    else if(plan==='heal')value+=S.num(f.protects?.heal)+S.num(f.enables?.cleanse)+S.num(f.enables?.revive);
    else if(plan==='blood')value+=S.num(f.enables?.summon);
    return value;
  }
  function lockedIds(options){
    const layout=options?.currentLayout||{},locks=options?.slotLocks||{},ids=[];
    const add=(row,flags)=>S.arr(row).forEach((id,i)=>{if(flags?.[i]&&id)ids.push(S.txt(id));});
    add(layout.storyMain,locks.storyMain);add(layout.storyBack,locks.storyBack);
    S.arr(layout.platoons).forEach((row,i)=>add(row,locks.platoons?.[i]));
    return [...new Set(ids)];
  }
  function chooseMonoElement(rows,plan){
    if(root.doctrine&&typeof root.doctrine.monoChoice==='function')return root.doctrine.monoChoice(rows,plan,8).element;
    const totals=new Map();
    S.arr(rows).slice(0,60).forEach(unit=>{
      const element=S.clean(unit?.element);if(!element)return;
      const value=S.num(unit?.__v5?.score)+roleValue(unit,'anchor')*5000+planValue(unit,plan)*2800;
      totals.set(element,(totals.get(element)||0)+value);
    });
    return [...totals.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  }
  function addCenters(rows){
    const base=sortRows([...rows]);
    const peers=[...base.slice(0,36),...(root.metaPriority?root.metaPriority.newest(base,18):[])];
    return base.map(unit=>{
      let center=0,crossElement=0;
      for(const other of peers){if(other===unit)continue;const value=Math.max(0,root.synergyGraph.pairScore(unit,other).score);center+=value;if(S.clean(unit?.element)!==S.clean(other?.element))crossElement+=value;}
      const clone={...unit};clone.__v5={...(clone.__v5||{}),synergyCenter:center,crossElementSynergy:crossElement,score:S.num(clone?.__v5?.score)+Math.min(9000,center*.08)};
      return clone;
    });
  }
  function build(rows,options){
    const list=S.arr(rows),cap=options?.exampleMode?120:140;
    const plan=selectPlan(options||{},list);
    const base=list.map(unit=>{const clone={...unit};clone.__v5={...(clone.__v5||{}),score:unitScore(unit,plan)};return clone;});
    const sorted=sortRows(addCenters(base));
    const mode=selectionMode(options),monoChoice=mode==='force_mono'&&root.doctrine?.monoChoice?root.doctrine.monoChoice(sorted,plan,8):null,monoElement=mode==='force_mono'?(monoChoice?.element||chooseMonoElement(sorted,plan)):'';
    const monoDiagnostics={monoElement,monoStrict:!!monoChoice?.strict,monoValidCount:S.num(monoChoice?.validCount),monoPreferred:S.arr(monoChoice?.preferred)};
    if(sorted.length<=cap)return{plan,rows:sorted,cap,diagnostics:{mode,...monoDiagnostics,inputSize:list.length,poolSize:sorted.length}};
    const byId=new Map(sorted.map(unit=>[S.txt(unit?.id),unit]));
    const chosen=new Map(),add=u=>{const id=S.txt(u?.id);if(id&&chosen.size<cap&&!chosen.has(id))chosen.set(id,u);};
    lockedIds(options).forEach(id=>add(byId.get(id)));
    sorted.slice(0,Math.ceil(cap*.30)).forEach(add);
    (root.metaPriority?root.metaPriority.newest(sorted,Math.ceil(cap*.20)):[]).forEach(add);
    [...sorted].sort((a,b)=>roleValue(b,'anchor')-roleValue(a,'anchor')||S.num(b?.__v5?.score)-S.num(a?.__v5?.score)).slice(0,Math.ceil(cap*.12)).forEach(add);
    [...sorted].sort((a,b)=>S.num(b?.__v5?.synergyCenter)-S.num(a?.__v5?.synergyCenter)).slice(0,Math.ceil(cap*.12)).forEach(add);
    for(const role of ['support','tank','control','cleanser'])sorted.filter(unit=>roleValue(unit,role)>0).slice(0,4).forEach(add);
    sorted.filter(unit=>planValue(unit,plan)>0).slice(0,Math.ceil(cap*.08)).forEach(add);
    if(mode==='force_mono'&&monoElement)sorted.filter(unit=>S.clean(unit?.element)===monoElement).slice(0,Math.ceil(cap*.10)).forEach(add);
    if(mode==='force_rainbow')[...sorted].sort((a,b)=>S.num(b?.__v5?.crossElementSynergy)-S.num(a?.__v5?.crossElementSynergy)).slice(0,Math.ceil(cap*.10)).forEach(add);
    for(const u of sorted){if(chosen.size>=cap)break;add(u);}
    return{plan,rows:sortRows([...chosen.values()]),cap,diagnostics:{mode,...monoDiagnostics,inputSize:list.length,poolSize:chosen.size,newestReserved:Math.ceil(cap*.20),lockedReserved:lockedIds(options).length}};
  }

  root.candidatePool={build,unitScore,selectPlan,sortRows,chooseMonoElement,normalizedPlan};
})(window);
