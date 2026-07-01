(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  if(!S)return;
  const C=S.constants;

  function mode(options){return options?.doctrineOverrides?.monoVsRainbow?.selectionMode||options?.teamType||'auto';}
  function features(unit){return unit?.__v5?.features||{};}
  function role(unit,key){return S.num(features(unit)?.roles?.[key]);}
  function planFit(unit,plan){
    const f=features(unit);let value=S.num(f.applies?.[plan])+S.num(f.consumes?.[plan]);
    if(plan==='turn')value+=S.num(f.enables?.spirit)+S.num(f.enables?.turn)+S.num(f.enables?.tu_reduction)+S.num(f.consumes?.spirit)*.6;
    else if(plan==='guardian')value+=S.num(f.protects?.guard)+S.num(f.protects?.barrier)+S.num(f.protects?.hold_ground);
    else if(plan==='heal')value+=S.num(f.protects?.heal)+S.num(f.enables?.cleanse)+S.num(f.enables?.revive);
    else if(plan==='blood')value+=S.num(f.enables?.summon);
    return value;
  }
  function anchorScore(unit,plan){return S.num(unit?.__v5?.score)+role(unit,'anchor')*6200+planFit(unit,plan)*2600+S.num(unit?.__v5?.synergyCenter)*.12+(root.metaPriority?root.metaPriority.boost(unit,'anchor'):0);}
  function monoOk(unit,ids,byId,options){
    if(mode(options)!=='force_mono')return true;
    const first=S.arr(ids).map(id=>byId.get(S.txt(id))).find(Boolean);
    const target=S.clean(options?.v5MonoElement||first?.element);
    return !target||target===S.clean(unit.element);
  }
  function planNeed(ids,byId,plan){
    const statusPlans=new Set(['burn','poison','sleep','stun','stealth']);
    const units=S.arr(ids).map(id=>byId.get(S.txt(id))).filter(Boolean);
    const fs=units.map(features);
    if(statusPlans.has(plan)){
      const hasSetup=fs.some(f=>S.num(f.applies?.[plan])>0);
      const hasPayoff=fs.some(f=>S.num(f.consumes?.[plan])>0);
      if(!hasSetup)return 'setup';
      if(!hasPayoff)return 'payoff';
    }
    if(plan==='turn'){
      const hasTempo=fs.some(f=>f.enables?.spirit||f.enables?.turn||f.enables?.tu_reduction);
      const hasUse=fs.some(f=>f.consumes?.spirit||S.num(f.roles?.anchor)>0||S.num(f.roles?.dps)>0);
      if(!hasTempo)return 'tempo';
      if(!hasUse)return 'dps';
    }
    if(plan==='blood'){
      const hasSummon=fs.some(f=>f.enables?.summon);
      const hasBlood=fs.some(f=>f.consumes?.blood);
      if(!hasSummon)return 'summon';
      if(!hasBlood)return 'payoff';
    }
    return '';
  }
  function roleNeed(ids,byId,plan){
    const direct=planNeed(ids,byId,plan);if(direct)return direct;
    const units=S.arr(ids).map(id=>byId.get(S.txt(id))).filter(Boolean),roles=units.map(u=>u?.__v5?.features?.roles||{});
    if(!roles.some(r=>S.num(r.anchor)>0||S.num(r.dps)>0))return 'dps';
    if(!roles.some(r=>S.num(r.support)>0))return 'support';
    if(!roles.some(r=>S.num(r.tank)>0))return 'tank';
    if(!roles.some(r=>S.num(r.control)>0))return 'control';
    return '';
  }
  function needBonus(unit,need,plan){
    const f=features(unit);
    if(need==='setup')return S.num(f.applies?.[plan])>0?6200:0;
    if(need==='payoff')return S.num(f.consumes?.[plan])>0?6200:0;
    if(need==='tempo')return (f.enables?.spirit||f.enables?.turn||f.enables?.tu_reduction)?5200:0;
    if(need==='summon')return f.enables?.summon?5200:0;
    return role(unit,need)>0?2800:0;
  }
  function pickAnchor(ids,pool,guard,byId,options,plan){
    let best=null,bestScore=-Infinity;
    for(const unit of S.arr(pool)){
      const id=S.txt(unit?.id);if(!id||ids.includes(id)||guard.isUsed(unit)||guard.rowConflict(unit,ids,byId)||!monoOk(unit,ids,byId,options))continue;
      const score=anchorScore(unit,plan);if(score>bestScore){best=unit;bestScore=score;}
    }
    return best;
  }
  function pick(ids,pool,guard,byId,graph,options,plan){
    const need=roleNeed(ids,byId,plan),before=root.synergyGraph.teamAnalysis(ids,byId,graph);let best=null,bestScore=-Infinity,seen=0;
    const anchor=S.arr(ids).map(id=>byId.get(S.txt(id))).find(unit=>role(unit,'anchor')>0);
    for(const unit of S.arr(pool)){
      const id=S.txt(unit.id);
      if(!id||ids.includes(id))continue;
      if(guard.isUsed(unit))continue;
      if(guard.rowConflict(unit,ids,byId))continue;
      if(!monoOk(unit,ids,byId,options))continue;
      let score=S.num(unit?.__v5?.score);
      const after=root.synergyGraph.teamAnalysis([...ids,id],byId,graph);
      score+=(after.score-before.score)*.55;
      score+=needBonus(unit,need,plan);
      if(planFit(unit,plan)>0)score+=features(unit).consumes?.[plan]?3200:2400;
      else if(role(unit,'support')<=0&&role(unit,'tank')<=0&&role(unit,'cleanser')<=0&&role(unit,'tempo')<=0)score-=900;
      if(anchor&&(Object.keys(features(unit).protects||{}).length||features(unit).enables?.turn||features(unit).enables?.tu_reduction||features(unit).enables?.spirit))score+=1700;
      if(mode(options)==='force_rainbow'&&ids.length&& !S.arr(ids).map(x=>S.clean(byId.get(S.txt(x))?.element)).includes(S.clean(unit?.element))&&after.score>before.score)score+=650;
      score+=root.metaPriority?root.metaPriority.boost(unit,'pick'):0;
      if(score>bestScore){best=unit;bestScore=score;}
      if(++seen>110&&best)break;
    }
    return best;
  }
  function buildRow(size,lockedRow,lockedFlags,pool,guard,byId,graph,options,plan){
    const ids=[];
    S.arr(lockedRow).slice(0,size).forEach((id,i)=>{id=S.txt(id);const unit=byId.get(id);if(lockedFlags?.[i]&&unit&&!guard.isUsed(unit)&&!guard.rowConflict(unit,ids,byId)&&monoOk(unit,ids,byId,options))ids.push(id);});
    if(ids.length<size&&!ids.some(id=>role(byId.get(id),'anchor')>0)){const anchor=pickAnchor(ids,pool,guard,byId,options,plan);if(anchor)ids.push(S.txt(anchor.id));}
    while(ids.length<size){const unit=pick(ids,pool,guard,byId,graph,options,plan);if(!unit)break;ids.push(S.txt(unit.id));}
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
  function applyStoryLocks(story,layout,locks,byId){
    const main=Array(C.STORY_MAIN).fill(''),back=Array(C.STORY_BACK).fill(''),locked=new Set(),used=root.duplicateGuard.makeSet(),available=new Set([...S.arr(story.main),...S.arr(story.back)].map(S.txt));
    const place=(row,flags,out)=>S.arr(row).slice(0,out.length).forEach((value,i)=>{const id=S.txt(value),unit=byId.get(id),key=unit&&root.duplicateGuard.keyFor(unit);if(flags?.[i]&&available.has(id)&&key&&!root.duplicateGuard.hasKey(used,key)){out[i]=id;locked.add(id);root.duplicateGuard.addKey(used,key);}});
    place(layout?.storyMain,locks?.storyMain,main);place(layout?.storyBack,locks?.storyBack,back);
    const q=[...S.arr(story.main),...S.arr(story.back)].filter(id=>id&&!locked.has(id));
    for(let i=0;i<C.STORY_MAIN;i++)if(!main[i])main[i]=q.shift()||'';
    for(let i=0;i<C.STORY_BACK;i++)if(!back[i])back[i]=q.shift()||'';
    return{main,back};
  }
  function wantsStoryOnly(options){
    if(options?.storyOnly===true)return true;
    if(options?.buildScope)return options.buildScope==='story';
    return !!g.document?.getElementById('modeStory')?.classList.contains('active');
  }
  function scoreIds(ids,byId,graph){return S.arr(ids).reduce((a,id)=>a+S.num(byId.get(S.txt(id))?.__v5?.score),0)+root.synergyGraph.teamScore(ids,byId,graph);}
  function selectedAnchor(ids,byId,plan){return S.arr(ids).map(id=>byId.get(S.txt(id))).filter(Boolean).sort((a,b)=>anchorScore(b,plan)-anchorScore(a,plan))[0]||null;}
  function pickReasons(unit,anchor,plan,graph){
    const f=features(unit),reasons=[];
    if(anchor&&S.txt(unit?.id)===S.txt(anchor?.id))reasons.push('selected anchor');
    if(f.applies?.[plan])reasons.push(`${plan} setup`);
    if(f.consumes?.[plan])reasons.push(`${plan} payoff`);
    if(Object.keys(f.protects||{}).length)reasons.push('protection');
    if(f.enables?.spirit)reasons.push('spirit gain');
    if(f.enables?.turn||f.enables?.tu_reduction)reasons.push('tempo');
    if(f.enables?.cleanse||f.enables?.revive)reasons.push('team safety');
    if((unit?.__v5?.meta?.newer||0)>=.75)reasons.push('newer meta priority');
    if(anchor&&unit!==anchor)reasons.push(...S.arr(graph.edge(anchor,unit).reasons).slice(0,2));
    return [...new Set(reasons)].length?[...new Set(reasons)]:['highest available balanced fit'];
  }
  function evidenceText(unit,kind){
    const values=[];
    const add=value=>{if(value!=null&&value!=='')values.push(value);};
    if(kind==='active'){
      add(unit?.activeSkills);
      S.arr(unit?.forms).forEach(form=>add(form?.activeSkills));
      S.arr(unit?.skillsByForm).forEach(form=>add(form?.activeSkills));
    }else{
      add(unit?.passiveSkills);add(unit?.passiveSkillDetails);
      S.arr(unit?.forms).forEach(form=>{add(form?.passiveSkills);add(form?.passiveSkillDetails);});
      S.arr(unit?.skillsByForm).forEach(form=>{add(form?.passiveSkills);add(form?.passiveSkillDetails);});
    }
    return S.keyText(values.map(value=>{try{return typeof value==='string'?value:JSON.stringify(value);}catch{return S.txt(value);}}).join(' '));
  }
  function explicitEvidence(unit,plan){
    const words=[plan,...S.arr(C.plans?.[plan])];
    return{active:S.has(evidenceText(unit,'active'),words),passive:S.has(evidenceText(unit,'passive'),words)};
  }
  function featureBucket(value){return Object.fromEntries(Object.entries(value||{}).filter(([,score])=>S.num(score)>0));}
  function storyPick(unit,id,index,anchor,plan,graph){
    const f=features(unit),doctrine=f.doctrine||{},evidence=explicitEvidence(unit,plan);
    return{
      id:S.txt(id),name:S.txt(unit?.name||unit?.title||id),element:S.clean(unit?.element),slot:index+1,
      selectedPlan:plan,doctrinePrimaryEngine:S.txt(doctrine.primary||plan),doctrineSecondaryEngines:S.arr(doctrine.secondary),
      explicitActiveEvidence:evidence.active,explicitPassiveEvidence:evidence.passive,reasons:pickReasons(unit,anchor,plan,graph),
      applies:featureBucket(f.applies),consumes:featureBucket(f.consumes),enables:featureBucket(f.enables),
      protects:featureBucket(f.protects),roleScores:featureBucket(f.roles)
    };
  }
  function build(pool,allRows,options){
    const byId=new Map(S.arr(allRows).map(u=>[S.txt(u.id),u]));
    const graph=root.synergyGraph.build(pool);
    const guard=root.duplicateGuard.create();
    const plan=options?.v5Plan||root.candidatePool.selectPlan(options||{},pool);
    const layout=options?.currentLayout||{},locks=options?.slotLocks||{};
    const storyRow=[...S.arr(layout.storyMain).slice(0,C.STORY_MAIN),...S.arr(layout.storyBack).slice(0,C.STORY_BACK)];
    const storyLock=[...S.arr(locks.storyMain).slice(0,C.STORY_MAIN),...S.arr(locks.storyBack).slice(0,C.STORY_BACK)];
    const storyIds=buildRow(C.STORY_MAIN+C.STORY_BACK,storyRow,storyLock,pool,guard,byId,graph,options,plan);
    const story=applyStoryLocks(storyOrder(storyIds,byId),layout,locks,byId);
    const placed=[...story.main,...story.back].filter(Boolean);
    placed.forEach(id=>guard.markId(id,byId));
    const platoons=[];
    const storyOnly=wantsStoryOnly(options);
    if(!storyOnly){
      for(let p=0;p<C.PLATOONS;p++){
        const row=S.arr(layout.platoons?.[p]).slice(0,C.PLATOON_SIZE),flags=S.arr(locks.platoons?.[p]).slice(0,C.PLATOON_SIZE);
        const ids=buildRow(C.PLATOON_SIZE,row,flags,pool,guard,byId,graph,options,plan);
        platoons.push({name:`Platoon ${p+1}`,units:ids,score:scoreIds(ids,byId,graph)});
      }
    }
    const anchor=selectedAnchor(placed,byId,plan),analysis=root.synergyGraph.teamAnalysis(placed,byId,graph);
    const newerMetaContribution=placed.reduce((sum,id)=>sum+(root.metaPriority?root.metaPriority.boost(byId.get(S.txt(id)),'score'):0),0);
    const storyPicks=placed.map((id,index)=>storyPick(byId.get(S.txt(id)),id,index,anchor,plan,graph));
    return{story,platoons,totalScore:scoreIds(placed,byId,graph)*2+platoons.reduce((a,p)=>a+S.num(p.score),0),diagnostics:{storyOnly,poolSize:pool.length,graphEdges:graph.map.size,selectedAnchor:anchor?{id:S.txt(anchor.id),name:S.txt(anchor.name||anchor.title||anchor.id),entry:S.identity(anchor).entry,family:S.identity(anchor).family}:null,selectedEngine:plan,storyPicks,synergyScore:analysis.synergyScore,conflictPenalty:analysis.conflictPenalty,newerMetaContribution,duplicateKey:'entry-family-name'}};
  }

  root.teamBuilder={build,buildRow,pick,pickAnchor,storyOrder,scoreIds,wantsStoryOnly,planNeed,storyPick,explicitEvidence};
})(window);
