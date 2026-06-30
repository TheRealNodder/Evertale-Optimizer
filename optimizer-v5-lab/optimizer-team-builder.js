(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  if(!S)return;
  const C=S.constants;

  function monoOk(unit,ids,byId,options){
    const mode=options?.doctrineOverrides?.monoVsRainbow?.selectionMode||options?.teamType||'auto';
    if(mode!=='force_mono')return true;
    const first=S.arr(ids).map(id=>byId.get(S.txt(id))).find(Boolean);
    return !first||S.clean(first.element)===S.clean(unit.element);
  }
  function roleNeed(ids,byId){
    const units=S.arr(ids).map(id=>byId.get(S.txt(id))).filter(Boolean),roles=units.map(u=>u?.__v5?.features?.roles||{});
    if(!roles.some(r=>S.num(r.control)>0))return 'control';
    if(!roles.some(r=>S.num(r.anchor)>0||S.num(r.dps)>0))return 'dps';
    if(!roles.some(r=>S.num(r.support)>0))return 'support';
    if(!roles.some(r=>S.num(r.tank)>0))return 'tank';
    return '';
  }
  function pick(ids,pool,guard,byId,graph,options,allowReuse){
    const need=roleNeed(ids,byId);let best=null,bestScore=-Infinity,seen=0;
    for(const unit of S.arr(pool)){
      const id=S.txt(unit.id);
      if(!id||ids.includes(id))continue;
      if(!allowReuse&&guard.isUsed(unit))continue;
      if(guard.rowConflict(unit,ids,byId))continue;
      if(!monoOk(unit,ids,byId,options))continue;
      let score=S.num(unit?.__v5?.score);
      score+=root.synergyGraph.teamScore([...ids,id],byId,graph)*.45;
      if(need&&S.num(unit?.__v5?.features?.roles?.[need])>0)score+=2600;
      if(ids.length===0)score+=root.metaPriority?root.metaPriority.boost(unit,'anchor'):0;
      if(score>bestScore){best=unit;bestScore=score;}
      if(++seen>80&&best)break;
    }
    return best;
  }
  function buildRow(size,lockedRow,lockedFlags,pool,guard,byId,graph,options,allowReuse){
    const ids=[];
    S.arr(lockedRow).slice(0,size).forEach((id,i)=>{id=S.txt(id);if(lockedFlags?.[i]&&id&&byId.has(id)&&!ids.includes(id))ids.push(id);});
    while(ids.length<size){const unit=pick(ids,pool,guard,byId,graph,options,false);if(!unit)break;ids.push(S.txt(unit.id));}
    if(allowReuse!==false)while(ids.length<size){const unit=pick(ids,pool,guard,byId,graph,options,true);if(!unit)break;ids.push(S.txt(unit.id));}
    const out=Array(size).fill(''),placed=new Set();
    S.arr(lockedRow).slice(0,size).forEach((id,i)=>{id=S.txt(id);if(lockedFlags?.[i]&&ids.includes(id)){out[i]=id;placed.add(id);}});
    const q=ids.filter(id=>!placed.has(id));
    for(let i=0;i<size;i++)if(!out[i])out[i]=q.shift()||'';
    out.filter(Boolean).forEach(id=>guard.markId(id,byId));
    return out;
  }
  function storyOrder(ids,byId){
    const rows=S.arr(ids).map(id=>{const u=byId.get(S.txt(id)),st=u?.__v5?.stats||{},f=u?.__v5?.features||{};const meta=root.metaPriority?root.metaPriority.boost(u,'story'):0;return{id,front:S.num(st.spd)*14+S.num(st.hp)*.022+S.num(f.roles?.control)*3400+S.num(f.roles?.tank)*1800+meta,back:S.num(st.atk)*.40+S.num(f.roles?.dps)*3600+S.num(f.roles?.support)*1200+meta};});
    rows.sort((a,b)=>b.front-a.front||S.txt(a.id).localeCompare(S.txt(b.id)));
    const main=rows.slice(0,C.STORY_MAIN).map(x=>x.id);
    const back=rows.slice(C.STORY_MAIN).sort((a,b)=>b.back-a.back||S.txt(a.id).localeCompare(S.txt(b.id))).slice(0,C.STORY_BACK).map(x=>x.id);
    return{main,back};
  }
  function applyStoryLocks(story,layout,locks){
    const main=Array(C.STORY_MAIN).fill(''),back=Array(C.STORY_BACK).fill(''),locked=new Set();
    S.arr(layout?.storyMain).slice(0,C.STORY_MAIN).forEach((id,i)=>{if(locks?.storyMain?.[i]&&id){main[i]=S.txt(id);locked.add(S.txt(id));}});
    S.arr(layout?.storyBack).slice(0,C.STORY_BACK).forEach((id,i)=>{if(locks?.storyBack?.[i]&&id){back[i]=S.txt(id);locked.add(S.txt(id));}});
    const q=[...S.arr(story.main),...S.arr(story.back)].filter(id=>id&&!locked.has(id));
    for(let i=0;i<C.STORY_MAIN;i++)if(!main[i])main[i]=q.shift()||'';
    for(let i=0;i<C.STORY_BACK;i++)if(!back[i])back[i]=q.shift()||'';
    return{main,back};
  }
  function scoreIds(ids,byId,graph){return S.arr(ids).reduce((a,id)=>a+S.num(byId.get(S.txt(id))?.__v5?.score),0)+root.synergyGraph.teamScore(ids,byId,graph);}
  function build(pool,allRows,options){
    const byId=new Map(S.arr(allRows).map(u=>[S.txt(u.id),u]));
    const graph=root.synergyGraph.build(pool);
    const guard=root.duplicateGuard.create();
    const layout=options?.currentLayout||{},locks=options?.slotLocks||{};
    const storyRow=[...S.arr(layout.storyMain).slice(0,C.STORY_MAIN),...S.arr(layout.storyBack).slice(0,C.STORY_BACK)];
    const storyLock=[...S.arr(locks.storyMain).slice(0,C.STORY_MAIN),...S.arr(locks.storyBack).slice(0,C.STORY_BACK)];
    const storyIds=buildRow(C.STORY_MAIN+C.STORY_BACK,storyRow,storyLock,pool,guard,byId,graph,options,true);
    const story=applyStoryLocks(storyOrder(storyIds,byId),layout,locks);
    const placed=[...story.main,...story.back].filter(Boolean);
    placed.forEach(id=>guard.markId(id,byId));
    const platoons=[];
    const storyOnly=options?.buildScope==='story'||options?.storyOnly===true||document.getElementById('modeStory')?.classList.contains('active');
    if(!storyOnly){
      for(let p=0;p<C.PLATOONS;p++){
        const row=S.arr(layout.platoons?.[p]).slice(0,C.PLATOON_SIZE),flags=S.arr(locks.platoons?.[p]).slice(0,C.PLATOON_SIZE);
        const ids=buildRow(C.PLATOON_SIZE,row,flags,pool,guard,byId,graph,options,false);
        platoons.push({name:`Platoon ${p+1}`,units:ids,score:scoreIds(ids,byId,graph)});
      }
    }
    return{story,platoons,totalScore:scoreIds(placed,byId,graph)*2+platoons.reduce((a,p)=>a+S.num(p.score),0),diagnostics:{storyOnly,poolSize:pool.length,graphEdges:graph.map.size,duplicateKey:'entry-family-name'}};
  }

  root.teamBuilder={build,buildRow,pick,storyOrder,scoreIds};
})(window);
