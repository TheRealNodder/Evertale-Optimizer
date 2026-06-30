(function(g){
  'use strict';
  const previous=g.OptimizerEngine;
  const STORY_MAIN=5,STORY_BACK=3,PLATOONS=20,PLATOON_SIZE=5;
  const A=Array.isArray;
  const arr=v=>A(v)?v:[];
  const txt=v=>String(v??'');
  const low=v=>txt(v).trim().toLowerCase();
  const clean=v=>low(v).replace(/[\u2019']/g,'').replace(/[^a-z0-9]+/g,'');
  const keyText=v=>low(v).replace(/[\u2019']/g,'').replace(/[^a-z0-9]+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d;};

  const plans={
    burn:['burn','frostburn','ignite'],poison:['poison','venom','toxin'],sleep:['sleep','dream','nightmare'],stun:['stun','shock','time_strike'],
    guardian:['guard','guardian','protect','barrier','hold_ground'],heal:['heal','revive','purify','cleanse'],turn:['tu','turn','haste','quicken','spirit'],
    blood:['blood','revenge'],crisis:['crisis','low_hp'],survivor:['survivor','survival'],offense:['dps','execute','charge','attack']
  };
  const aliases={auto:'',atkBuff:'offense',hpBuff:'guardian',defense:'guardian',cleanse:'heal',spirit:'turn',charge:'offense'};
  const roleWords={
    dps:['execute','charge','blood','survivor','poison_eater','burn_drive','time_strike'],
    support:['heal','revive','purify','cleanse','spirit'],
    control:['sleep','stun','push_back','tu','stealth','dispel'],
    tank:['guard','guardian','barrier','hold_ground','damage_reduction']
  };
  const META_SCORE_WEIGHT=14000;
  const META_PICK_WEIGHT=5000;
  const META_STORY_WEIGHT=3200;

  function pathOrder(value){const m=txt(value).match(/(?:^|\/)(\d{4})_/);return m?num(m[1]):0;}
  function entry(u){
    if(u?.__v4?.entry)return u.__v4.entry;
    const paths=[u?.entryPath,u?.path,u?.file,u?.fileName,u?.sourceFile,u?.__path,u?.raw?.entryPath,u?.raw?.sourceFile];
    for(const p of paths){const m=txt(p).match(/(?:^|\/)(\d{4})_/);if(m)return m[1];}
    for(const v of [u?.entryPrefix,u?.entryKey,u?.order,u?.entryOrder,u?.indexOrder,u?.raw?.order]){if(v!==undefined&&v!==null&&v!==''){const m=txt(v).match(/\d+/);if(m)return m[0].padStart(4,'0').slice(-4);}}
    return 'id_'+clean(u?.id||u?.sourceId||u?.family||u?.name);
  }
  function metaOrder(u){
    if(u?.__v4?.meta&&Number.isFinite(u.__v4.meta.order))return u.__v4.meta.order;
    const values=[
      u?.fileHandleOrder,u?.sourceOrder,u?.visualOrder,u?.order,u?.entryOrder,u?.indexOrder,u?.raw?.order,
      u?.internal?.fileHandleOrder,u?.internal?.sourceOrder,u?.internal?.order,
      pathOrder(u?.entryPath),pathOrder(u?.path),pathOrder(u?.file),pathOrder(u?.fileName),pathOrder(u?.sourceFile),pathOrder(u?.__path),pathOrder(u?.raw?.entryPath),pathOrder(u?.raw?.sourceFile),
      ...arr(u?.statsByForm).flatMap(f=>[f?.fileHandleOrder,f?.sourceOrder,f?.visualOrder,f?.order,pathOrder(f?.sourceId),pathOrder(f?.dataSourceId),pathOrder(f?.imageSourceId)]),
      ...arr(u?.forms).flatMap(f=>[f?.fileHandleOrder,f?.sourceOrder,f?.visualOrder,f?.order,pathOrder(f?.sourceId),pathOrder(f?.dataSourceId),pathOrder(f?.imageSourceId)]),
      ...arr(u?.imageVariants).flatMap(f=>[f?.fileHandleOrder,f?.sourceOrder,f?.visualOrder,f?.order,pathOrder(f?.sourceId),pathOrder(f?.dataSourceId),pathOrder(f?.imageSourceId)])
    ].map(v=>num(v,0)).filter(v=>v>0);
    return values.length?Math.max(...values):0;
  }
  function ident(u){
    if(u?.__v4?.ident)return u.__v4.ident;
    const source=txt(u?.sourceId||'').replace(/\d+$/,'');
    const fam=clean(u?.family||u?.internal?.family||source||u?.id||u?.name);
    const name=clean([u?.name,u?.title].filter(Boolean).join(' '))||fam||entry(u);
    return {entry:entry(u),family:fam,name,id:txt(u?.id||u?.sourceId||entry(u))};
  }
  function stats(u,profileState){
    if(g.EvertaleRosterProfiles&&typeof g.EvertaleRosterProfiles.estimateUnitStats==='function'){
      try{const s=g.EvertaleRosterProfiles.estimateUnitStats(u,undefined,profileState);return{atk:num(s?.atk),hp:num(s?.hp),spd:num(s?.spd),cost:Math.max(1,num(s?.cost,1)),power:num(s?.power||s?.unitPower)}}catch{}
    }
    const s=u?.stats||{};
    return{atk:num(s.atk??u?.atk),hp:num(s.hp??u?.hp),spd:num(s.spd??u?.spd),cost:Math.max(1,num(s.cost??u?.cost,1)),power:num(u?.power||u?.unitPower)};
  }
  function tagBlob(u){
    if(u?.__v4?.blob)return u.__v4.blob;
    const raw=[u?.name,u?.title,u?.description,u?.element,u?.weaponType,u?.weaponPref,u?.family,u?.sourceId,...arr(u?.derivedTags),...arr(u?.tags),...arr(u?.passiveTags),...arr(u?.roles),...arr(u?.archetypes),...arr(u?.activeSkills),...arr(u?.passiveSkills),...arr(u?.passiveSkillDetails)]
      .map(v=>typeof v==='object'?JSON.stringify(v):txt(v)).join(' ');
    return keyText(raw);
  }
  function has(blob,words){return arr(words).some(w=>blob.includes(keyText(w)));}
  function planFor(options,pool){
    const picked=[options?.presetTag,...arr(options?.archetypes)].map(v=>aliases[low(v)]??low(v)).find(v=>v&&v!=='auto'&&v!=='none'&&plans[v]);
    if(picked)return picked;
    let best='offense',score=-1;
    for(const [p,words] of Object.entries(plans)){let n=0;for(const u of pool.slice(0,80))if(has(u.__v4.blob,words))n++;if(n>score){score=n;best=p;}}
    return best;
  }
  function unitBase(u,plan){
    const s=u.__v4.stats,b=u.__v4.blob,m=u.__v4.meta||{};
    let score=(s.power? s.power*.07:0)+s.atk*.46+s.hp*.05+s.spd*12+(s.atk/Math.max(1,s.cost))*.18;
    if(has(b,plans[plan]||plans.offense))score+=4200;
    if(has(b,roleWords.dps))score+=2100;
    if(has(b,roleWords.support))score+=1500;
    if(has(b,roleWords.control))score+=1400;
    if(has(b,roleWords.tank))score+=1300;
    score+=(m.newer||0)*META_SCORE_WEIGHT;
    return score;
  }
  function sortRows(rows){
    return rows.sort((a,b)=>b.__v4.score-a.__v4.score||b.__v4.meta.newer-a.__v4.meta.newer||a.__v4.ident.entry.localeCompare(b.__v4.ident.entry));
  }
  function enrich(units,options){
    let rows=arr(units);
    if(g.OptimizerEngineV2&&typeof g.OptimizerEngineV2.enrichOwnedUnits==='function'){
      try{rows=g.OptimizerEngineV2.enrichOwnedUnits(rows)}catch{}
    }
    const profileState=g.EvertaleRosterProfiles&&typeof g.EvertaleRosterProfiles.loadState==='function'?g.EvertaleRosterProfiles.loadState():null;
    const orders=rows.map(metaOrder).filter(v=>v>0),minOrder=orders.length?Math.min(...orders):0,maxOrder=orders.length?Math.max(...orders):0,span=Math.max(1,maxOrder-minOrder);
    const base=rows.map(u=>{const clone={...u},order=metaOrder(u),newer=order>0?(order-minOrder)/span:0;clone.id=txt(u?.id||u?.sourceId||u?.family||u?.name);clone.__v4={stats:stats(u,profileState),blob:tagBlob(u),ident:ident(u),entry:entry(u),meta:{order,newer}};return clone;});
    const plan=planFor(options,base);
    return {plan,rows:sortRows(base.map(u=>{u.__v4.score=unitBase(u,plan);return u;}))};
  }
  function workingPool(rows,cap){
    const list=arr(rows);
    if(list.length<=cap)return list;
    const chosen=new Map();
    const add=u=>{const id=txt(u?.id);if(id&&!chosen.has(id))chosen.set(id,u);};
    const newerCount=Math.ceil(cap*.35);
    const scoreCount=Math.max(0,cap-newerCount);
    list.slice(0,scoreCount).forEach(add);
    [...list].sort((a,b)=>b.__v4.meta.newer-a.__v4.meta.newer||b.__v4.score-a.__v4.score).slice(0,newerCount).forEach(add);
    for(const u of list){if(chosen.size>=cap)break;add(u);}
    return sortRows([...chosen.values()]);
  }
  function usedKeys(ids,byId){
    const out={entry:new Set(),family:new Set(),name:new Set()};
    ids.forEach(id=>{const u=byId.get(txt(id));if(!u)return;addUsedKey(out,u.__v4.ident);});
    return out;
  }
  function newUsed(){return{entry:new Set(),family:new Set(),name:new Set()};}
  function addUsedKey(used,k){if(!k)return;used.entry.add(k.entry);if(k.family)used.family.add(k.family);if(k.name)used.name.add(k.name);}
  function hasUsedKey(used,k){return !!k&&(used.entry.has(k.entry)||used.family.has(k.family)||used.name.has(k.name));}
  function rowConflict(u,ids,byId){const k=u.__v4.ident,used=usedKeys(ids,byId);return hasUsedKey(used,k);}
  function monoOk(u,ids,byId,options){const mode=options?.doctrineOverrides?.monoVsRainbow?.selectionMode||options?.teamType||'auto';if(mode!=='force_mono')return true;const first=ids.map(id=>byId.get(txt(id))).find(Boolean);return !first||clean(first.element)===clean(u.element);}
  function roleNeed(ids,byId){
    const units=ids.map(id=>byId.get(txt(id))).filter(Boolean),blobs=units.map(u=>u.__v4.blob);
    if(!blobs.some(b=>has(b,roleWords.control)))return roleWords.control;
    if(!blobs.some(b=>has(b,roleWords.dps)))return roleWords.dps;
    if(!blobs.some(b=>has(b,roleWords.support)))return roleWords.support;
    if(!blobs.some(b=>has(b,roleWords.tank)))return roleWords.tank;
    return null;
  }
  function pick(ids,pool,used,byId,options,allowUsed){
    const need=roleNeed(ids,byId);let best=null,bestScore=-Infinity,seen=0;
    for(const u of pool){
      const id=txt(u.id),k=u.__v4.ident;if(!id||ids.includes(id))continue;if(!allowUsed&&hasUsedKey(used,k))continue;if(rowConflict(u,ids,byId))continue;if(!monoOk(u,ids,byId,options))continue;
      let score=u.__v4.score;if(need&&has(u.__v4.blob,need))score+=2600;if(ids.length===0&&has(u.__v4.blob,roleWords.control))score+=1200;score+=(u.__v4.meta?.newer||0)*META_PICK_WEIGHT;
      if(score>bestScore){best=u;bestScore=score;}if(++seen>60&&best)break;
    }
    return best;
  }
  function buildRow(size,lockedRow,lockedFlags,pool,used,byId,options,allowReuse){
    const ids=[];arr(lockedRow).slice(0,size).forEach((id,i)=>{id=txt(id);if(lockedFlags?.[i]&&id&&byId.has(id)&&!ids.includes(id))ids.push(id);});
    while(ids.length<size){const p=pick(ids,pool,used,byId,options,false);if(!p)break;ids.push(txt(p.id));}
    if(allowReuse!==false)while(ids.length<size){const p=pick(ids,pool,used,byId,options,true);if(!p)break;ids.push(txt(p.id));}
    const out=Array(size).fill(''),placed=new Set();arr(lockedRow).slice(0,size).forEach((id,i)=>{id=txt(id);if(lockedFlags?.[i]&&ids.includes(id)){out[i]=id;placed.add(id);}});
    const q=ids.filter(id=>!placed.has(id));for(let i=0;i<size;i++)if(!out[i])out[i]=q.shift()||'';
    out.filter(Boolean).forEach(id=>{const u=byId.get(id);if(u)addUsedKey(used,u.__v4.ident);});
    return out;
  }
  function storyOrder(ids,byId){
    const rows=ids.map(id=>{const u=byId.get(txt(id)),s=u?.__v4?.stats||{},m=u?.__v4?.meta||{};const b=u?.__v4?.blob||'';return{id,front:s.spd*14+s.hp*.022+(has(b,roleWords.control)?3400:0)+(has(b,roleWords.tank)?1800:0)+(m.newer||0)*META_STORY_WEIGHT,back:s.atk*.40+(has(b,roleWords.dps)?3600:0)+(has(b,roleWords.support)?1200:0)+(m.newer||0)*META_STORY_WEIGHT}});
    rows.sort((a,b)=>b.front-a.front||a.id.localeCompare(b.id));
    const main=rows.slice(0,STORY_MAIN).map(x=>x.id),back=rows.slice(STORY_MAIN).sort((a,b)=>b.back-a.back||a.id.localeCompare(b.id)).slice(0,STORY_BACK).map(x=>x.id);
    return {main,back};
  }
  function storyLocks(story,layout,locks){
    const main=Array(STORY_MAIN).fill(''),back=Array(STORY_BACK).fill(''),locked=new Set();
    arr(layout?.storyMain).slice(0,STORY_MAIN).forEach((id,i)=>{if(locks?.storyMain?.[i]&&id){main[i]=txt(id);locked.add(txt(id));}});
    arr(layout?.storyBack).slice(0,STORY_BACK).forEach((id,i)=>{if(locks?.storyBack?.[i]&&id){back[i]=txt(id);locked.add(txt(id));}});
    const q=[...arr(story.main),...arr(story.back)].filter(id=>id&&!locked.has(id));for(let i=0;i<STORY_MAIN;i++)if(!main[i])main[i]=q.shift()||'';for(let i=0;i<STORY_BACK;i++)if(!back[i])back[i]=q.shift()||'';return{main,back};
  }
  function storyMode(options){
    if(options?.buildScope==='story'||options?.storyOnly===true)return true;
    const btn=document.getElementById('modeStory');
    return !!btn&&btn.classList.contains('active');
  }
  function scoreIds(ids,byId){return ids.reduce((a,id)=>a+(byId.get(txt(id))?.__v4?.score||0),0);}
  function run(units,options){
    try{
      const opts={...(options||{}),optimizerSearchMode:'v4'};
      const data=enrich(units||[],opts),pool=workingPool(data.rows,opts.exampleMode?120:140),byId=new Map(data.rows.map(u=>[txt(u.id),u]));
      const layout=opts.currentLayout||{},locks=opts.slotLocks||{},used=newUsed();
      const storyRow=[...arr(layout.storyMain).slice(0,STORY_MAIN),...arr(layout.storyBack).slice(0,STORY_BACK)];
      const storyLock=[...arr(locks.storyMain).slice(0,STORY_MAIN),...arr(locks.storyBack).slice(0,STORY_BACK)];
      const storyIds=buildRow(STORY_MAIN+STORY_BACK,storyRow,storyLock,pool,used,byId,opts,true);
      const story=storyLocks(storyOrder(storyIds,byId),layout,locks);
      const placed=[...story.main,...story.back].filter(Boolean);placed.forEach(id=>{const u=byId.get(id);if(u)addUsedKey(used,u.__v4.ident);});
      if(storyMode(opts))return{story,totalScore:scoreIds(placed,byId),engineVersion:'optimizerEngineV4-story-meta-strong',duplicateKey:'entry-family-name'};
      const platoons=[];for(let p=0;p<PLATOONS;p++){const row=arr(layout.platoons?.[p]).slice(0,PLATOON_SIZE),flags=arr(locks.platoons?.[p]).slice(0,PLATOON_SIZE);const ids=buildRow(PLATOON_SIZE,row,flags,pool,used,byId,opts,false);platoons.push({name:`Platoon ${p+1}`,units:ids,score:scoreIds(ids,byId)});}
      return{story,platoons,totalScore:scoreIds(placed,byId)*2+platoons.reduce((a,p)=>a+num(p.score),0),engineVersion:'optimizerEngineV4-fast-meta-strong',duplicateKey:'entry-family-name'};
    }catch(err){console.warn('[Optimizer] V4 failed; falling back.',err);if(previous&&typeof previous.run==='function')return previous.run(units,options);return{story:{main:[],back:[]},totalScore:0,engineVersion:'optimizerEngineV4-empty'};}
  }
  g.OptimizerEngineV4={run};
  g.OptimizerEngine=g.OptimizerEngineV4;
})(window);
