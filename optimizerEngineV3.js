(function(g){
  "use strict";
  const previous=g.OptimizerEngine;
  const STORY_MAIN=5,STORY_BACK=3,PLATOONS=20,PLATOON_SIZE=5;
  const asArray=v=>Array.isArray(v)?v:[];
  const text=v=>String(v??"");
  const lc=v=>text(v).trim().toLowerCase();
  const norm=v=>lc(v).replace(/[\u2019']/g,"").replace(/[^a-z0-9]+/g,"");
  const canon=v=>lc(v).replace(/[\u2019']/g,"").replace(/[^a-z0-9]+/g,"_").replace(/_+/g,"_").replace(/^_+|_+$/g,"");
  const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d;};

  const SLOT_RULES={
    burn:{apply:["burn_apply","frostburn","ignite","ai_prioritizes_burn"],payoff:["burn_synergy","burn_drive","burn_blast","burn_tier"],support:["ward_burn","purify","tu_manip","spirit_synergy"],tank:["guard","barrier","damage_reduction","hold_ground"],flex:["role_dps","heal","revive","execute"]},
    poison:{apply:["poison_apply","mega_poison","venom","ai_prioritizes_poison"],payoff:["poison_synergy","poison_eater","poison_devour","poison_tier"],support:["status_spread","tu_manip","purify","survivor"],tank:["guard","barrier","damage_reduction","hold_ground"],flex:["role_dps","blood","revenge","execute"]},
    sleep:{apply:["sleep_apply","deep_sleep","slumber","ai_prioritizes_sleep_frostburn"],payoff:["sleep_synergy","dream","nightmare","frostburn"],support:["tu_manip","stealth","purify","ward_sleep"],tank:["guard","barrier","damage_reduction","hold_ground"],flex:["role_dps","heal","revive","execute"]},
    stun:{apply:["stun_apply","push_back","shock","ai_prioritizes_stun"],payoff:["stun_synergy","time_strike"],support:["tu_manip","spirit_synergy","ward_stun","purify"],tank:["guard","barrier","damage_reduction","hold_ground"],flex:["role_dps","execute","heal","revive"]},
    guardian:{apply:["guard","guardian","protect","role_tank"],payoff:["damage_reduction","barrier","hold_ground"],support:["heal","revive","purify"],tank:["guard","barrier","damage_reduction","hold_ground"],flex:["role_dps","tu_manip","spirit_synergy"]},
    heal:{apply:["heal","regeneration","lifesteal"],payoff:["role_support","revive","purify"],support:["tu_manip","spirit_synergy","barrier"],tank:["guard","hold_ground","damage_reduction"],flex:["role_dps","execute","survivor"]},
    turn:{apply:["tu_manip","turn_grant","haste","quicken"],payoff:["role_control","stun_apply","sleep_apply","weaken"],support:["spirit_synergy","purify","dispel"],tank:["stealth","guard","barrier"],flex:["role_dps","execute","charge"]},
    blood:{apply:["blood","bloodfury","bloodthirst"],payoff:["revenge","summon","revive"],support:["guard","hold_ground","tu_manip"],tank:["barrier","damage_reduction","guard"],flex:["role_dps","execute","heal"]},
    crisis:{apply:["crisis","low_hp"],payoff:["hold_ground","revenge","survivor"],support:["heal","guard","barrier"],tank:["damage_reduction","hold_ground","guard"],flex:["role_dps","execute","tu_manip"]},
    survivor:{apply:["survivor","survival"],payoff:["tu_manip","guard","heal"],support:["revive","purify","spirit_synergy"],tank:["hold_ground","barrier","damage_reduction"],flex:["role_dps","revenge","execute"]},
    offense:{apply:["role_dps","atk_buff","charge"],payoff:["execute","target_all_enemies","target_multi_enemy"],support:["tu_manip","spirit_synergy","weaken"],tank:["guard","barrier","hold_ground"],flex:["heal","purify","revive"]}
  };
  const PLAN_ALIAS={auto:"",atkBuff:"offense",hpBuff:"guardian",defense:"guardian",cleanse:"heal",stealth:"turn",spirit:"turn",charge:"offense"};

  function getStats(u){
    if(g.EvertaleRosterProfiles&&typeof g.EvertaleRosterProfiles.estimateUnitStats==="function"){
      try{const s=g.EvertaleRosterProfiles.estimateUnitStats(u);return{atk:num(s?.atk),hp:num(s?.hp),spd:num(s?.spd),cost:Math.max(1,num(s?.cost,1)),power:num(s?.power||s?.unitPower)}}catch(_){ }
    }
    const s=u?.stats||{};
    return{atk:num(s.atk??u?.atk),hp:num(s.hp??u?.hp),spd:num(s.spd??u?.spd),cost:Math.max(1,num(s.cost??u?.cost,1)),power:num(u?.power||u?.unitPower)};
  }

  function tagSet(u){
    const out=new Set();
    [...asArray(u?.derivedTags),...asArray(u?.tags),...asArray(u?.passiveTags),...asArray(u?.roles),...asArray(u?.archetypes)].forEach(v=>{const c=canon(v);if(c)out.add(c);});
    const blob=[u?.name,u?.title,u?.description,u?.element,u?.weaponType,u?.weaponPref,u?.family,u?.sourceId,...asArray(u?.activeSkills),...asArray(u?.passiveSkills),...asArray(u?.passiveSkillDetails)].map(v=>typeof v==="object"?JSON.stringify(v):text(v)).join(" ").toLowerCase();
    const add=(re,t)=>{if(re.test(blob))out.add(t);};
    add(/frostburn|burning|\bburn\b|ignite/,"burn_apply");add(/burning enemy|burn drive|burn blast|burn.*damage|frostburned/,"burn_synergy");
    add(/poisoned|\bpoison\b|venom|toxin|mega poison/,"poison_apply");add(/poisoned enemy|poison eater|poison devour|poison.*damage/,"poison_synergy");
    add(/sleeping|deep sleep|\bsleep\b|slumber/,"sleep_apply");add(/sleeping enemy|dream|nightmare|sleep.*damage/,"sleep_synergy");
    add(/stunned|\bstun\b|push back|shock/,"stun_apply");add(/time strike|stunned enemy|stun.*damage/,"stun_synergy");
    add(/heal|recover|restor|regeneration|lifesteal|drain hp/,"heal");add(/purif|cleanse|remove negative|remove debuff/,"purify");add(/revive|resurrect|return.*battlefield/,"revive");
    add(/guardian|protector|protect allies|bodyguard|\bguard\b/,"guard");add(/barrier|shield|ward|armor|damage reduction|less damage/,"barrier");add(/hold ground|survive.*1\s*hp|cannot be defeated/,"hold_ground");
    add(/turn grant|give.*next turn|reduce.*tu|tu reduced|haste|quicken/,"tu_manip");add(/spirit|gain.*spirit/,"spirit_synergy");add(/charge|power charge/,"charge");
    add(/bloodfury|blood fury|bloodthirst|blood thirst|bloodnova/,"blood");add(/crisis|low hp|less than.*hp/,"crisis");add(/survivor|survival|300\s*tu/,"survivor");add(/revenge|avenge|vengeance|payback/,"revenge");
    add(/stealth|hidden|invisible/,"stealth");add(/dispel|remove.*buff|remove positive|strip/,"dispel");add(/execute|instant death|immediately defeated|10% or less/,"execute");
    if(["burn_synergy","poison_synergy","sleep_synergy","stun_synergy","blood","survivor","charge","execute"].some(t=>out.has(t)))out.add("role_dps");
    if(["heal","purify","revive","spirit_synergy"].some(t=>out.has(t)))out.add("role_support");
    if(["guard","barrier","hold_ground"].some(t=>out.has(t)))out.add("role_tank");
    if(["sleep_apply","stun_apply","tu_manip","stealth","dispel"].some(t=>out.has(t)))out.add("role_control");
    return out;
  }

  function unitText(u){return[...tagSet(u)].join(" ");}
  function hasAny(u,rules){const t=unitText(u);return asArray(rules).some(r=>t.includes(canon(r)));}
  function entryPrefix(u){
    const paths=[u?.entryPath,u?.path,u?.file,u?.fileName,u?.sourceFile,u?.__path,u?.raw?.entryPath,u?.raw?.sourceFile].filter(Boolean).map(text);
    for(const p of paths){const m=p.match(/(?:^|\/)(\d{4})_/);if(m)return m[1];}
    for(const v of [u?.entryPrefix,u?.entryKey,u?.order,u?.entryOrder,u?.indexOrder,u?.raw?.order]){if(v!==undefined&&v!==null&&v!==""){const n=String(v).match(/\d+/);if(n)return n[0].padStart(4,"0").slice(-4);}}
    return "id_"+norm(u?.id||u?.sourceId||u?.family||u?.name);
  }
  function familyKey(u){return norm(u?.family||u?.internal?.family||text(u?.sourceId||"").replace(/\d+$/," ")||u?.id||"");}
  function nameKey(u){return norm([u?.name,u?.title].filter(Boolean).join(" "))||familyKey(u)||entryPrefix(u);}
  function identity(u){return{entry:entryPrefix(u),family:familyKey(u),name:nameKey(u),id:text(u?.id||u?.sourceId||entryPrefix(u))};}

  function enrichUnits(units,options){
    let rows=asArray(units);
    if(g.OptimizerEngineV2&&typeof g.OptimizerEngineV2.enrichOwnedUnits==="function"){
      try{rows=g.OptimizerEngineV2.enrichOwnedUnits(rows)}catch(_){ }
    }
    return rows.map(u=>{const st=getStats(u);const id=identity(u);const tags=tagSet(u);const clone={...u,__v3:{stats:st,id,tags}};clone.id=text(u?.id||u?.sourceId||id.entry);clone.__v3.base=unitScore(clone,options||{});return clone;}).sort((a,b)=>(b.__v3.base-a.__v3.base)||identity(a).entry.localeCompare(identity(b).entry));
  }

  function unitScore(u,options){
    const st=u.__v3?.stats||getStats(u);let s=st.power?st.power*0.08:0;
    s+=st.atk*0.48+st.hp*0.055+st.spd*13+(st.atk/Math.max(1,st.cost))*0.18;
    const plan=resolvePlan(options,[u]);const rules=SLOT_RULES[plan]||null;
    if(rules){for(const group of Object.values(rules))if(hasAny(u,group))s+=900;}
    if(hasAny(u,["role_dps","execute","charge","blood","survivor"]))s+=1800;
    if(hasAny(u,["role_support","heal","revive","purify","spirit_synergy"]))s+=1250;
    if(hasAny(u,["role_control","tu_manip","sleep_apply","stun_apply","stealth","dispel"]))s+=1150;
    if(hasAny(u,["role_tank","guard","barrier","hold_ground"]))s+=950;
    return s;
  }

  function resolvePlan(options,units){
    const keys=[options?.presetTag,...asArray(options?.archetypes)].map(v=>lc(v)).filter(v=>v&&v!=="auto"&&v!=="none");
    const direct=keys.map(k=>PLAN_ALIAS[k]??k).find(k=>SLOT_RULES[k]);
    if(direct)return direct;
    const checks=["burn","poison","sleep","stun","guardian","blood","crisis","survivor","heal","turn"];
    let best="offense",bestScore=-1;
    for(const key of checks){const r=SLOT_RULES[key];let hits=0;for(const u of asArray(units)){if(hasAny(u,r.apply))hits+=2;if(hasAny(u,r.payoff))hits+=2;if(hasAny(u,r.support))hits+=1;}if(hits>bestScore){bestScore=hits;best=key;}}
    return best;
  }

  function localKeys(ids,byId){
    const out={entries:new Set(),families:new Set(),names:new Set()};
    ids.forEach(id=>{const u=byId.get(text(id));if(!u)return;const k=identity(u);out.entries.add(k.entry);if(k.family)out.families.add(k.family);if(k.name)out.names.add(k.name);});
    return out;
  }
  function localConflict(u,ids,byId){
    const k=identity(u),keys=localKeys(ids,byId);
    return keys.entries.has(k.entry)||keys.families.has(k.family)||keys.names.has(k.name);
  }
  function allowedByElement(u,ids,byId,options){
    const mode=options?.doctrineOverrides?.monoVsRainbow?.selectionMode||options?.teamType||"auto";
    if(mode!=="force_mono")return true;
    const first=ids.map(id=>byId.get(text(id))).find(Boolean);
    if(!first)return true;
    return norm(first.element)===norm(u.element);
  }

  function rowScore(ids,byId,options){
    const units=ids.map(id=>byId.get(text(id))).filter(Boolean);let s=units.reduce((a,u)=>a+u.__v3.base,0);
    const plan=resolvePlan(options,units),r=SLOT_RULES[plan]||SLOT_RULES.offense;
    const has=(rules)=>units.some(u=>hasAny(u,rules));
    if(has(r.apply))s+=4200;else s-=2200;
    if(has(r.payoff))s+=4200;else s-=2200;
    if(has(r.support))s+=2600;
    if(has(r.tank))s+=2200;
    if(units.filter(u=>hasAny(u,["role_dps","execute","charge","blood","survivor"])).length>=2)s+=2400;
    if(units.some(u=>hasAny(u,["heal","revive","purify"])))s+=1700;
    if(units.some(u=>hasAny(u,["tu_manip","stun_apply","sleep_apply","stealth"])))s+=1500;
    const keys=localKeys(ids,byId);const dupPenalty=(ids.length-keys.entries.size)*9000+(ids.length-keys.families.size)*7000+(ids.length-keys.names.size)*5000;
    return s-dupPenalty;
  }

  function pickForSlot(ids,pool,used,byId,options,slotRules,allowUsed){
    let best=null,bestScore=-Infinity,seen=0;
    for(const u of pool){const id=text(u.id);if(!id||ids.includes(id))continue;if(!allowUsed&&used.has(identity(u).entry))continue;if(localConflict(u,ids,byId))continue;if(!allowedByElement(u,ids,byId,options))continue;if(slotRules&&!hasAny(u,slotRules))continue;if(seen++>120&&best)break;const score=rowScore([...ids,id],byId,options)+u.__v3.base*0.03;if(score>bestScore){best=u;bestScore=score;}}
    return best;
  }

  function seedTemplate(ids,pool,used,byId,options,allowUsed){
    const plan=resolvePlan(options,pool),r=SLOT_RULES[plan]||SLOT_RULES.offense;
    for(const rules of [r.apply,r.payoff,r.support,r.tank,r.flex]){
      if(ids.length>=5)break;
      if(ids.some(id=>hasAny(byId.get(text(id)),rules)))continue;
      const pick=pickForSlot(ids,pool,used,byId,options,rules,allowUsed);
      if(pick)ids.push(text(pick.id));
    }
    return ids;
  }

  function beamFill(ids,pool,used,byId,options,size,allowUsed){
    const width=size>5?20:16,branch=size>5?34:28;let beams=[{ids:[...ids],score:rowScore(ids,byId,options)}];
    while(beams[0]&&beams[0].ids.length<size){const next=[];for(const beam of beams){let seen=0;for(const u of pool){const id=text(u.id);if(!id||beam.ids.includes(id))continue;if(!allowUsed&&used.has(identity(u).entry))continue;if(localConflict(u,beam.ids,byId))continue;if(!allowedByElement(u,beam.ids,byId,options))continue;if(seen++>=branch)break;const row=[...beam.ids,id];next.push({ids:row,score:rowScore(row,byId,options)});}}if(!next.length)break;next.sort((a,b)=>b.score-a.score);beams=next.slice(0,width);}
    return (beams[0]?.ids||ids).slice(0,size);
  }

  function buildRow(size,lockedRow,lockedFlags,pool,used,byId,options){
    const locked=[];asArray(lockedRow).slice(0,size).forEach((id,i)=>{if(lockedFlags?.[i]&&id&&byId.has(text(id))&&!locked.includes(text(id)))locked.push(text(id));});
    let ids=seedTemplate([...locked],pool,used,byId,options,false);
    ids=beamFill(ids,pool,used,byId,options,size,false);
    if(ids.length<size){ids=seedTemplate(ids,pool,used,byId,options,true);ids=beamFill(ids,pool,used,byId,options,size,true);}
    const out=Array(size).fill("");const placed=new Set();asArray(lockedRow).slice(0,size).forEach((id,i)=>{if(lockedFlags?.[i]&&id&&ids.includes(text(id))){out[i]=text(id);placed.add(text(id));}});const q=ids.filter(id=>!placed.has(id));for(let i=0;i<size;i++)if(!out[i])out[i]=q.shift()||"";
    out.filter(Boolean).forEach(id=>{const u=byId.get(text(id));if(u)used.add(identity(u).entry);});return out;
  }

  function assignStory(ids,byId){
    const scored=ids.map(id=>{const u=byId.get(text(id));const st=u?.__v3?.stats||getStats(u);return{id,front:st.spd*16+st.hp*.025+(hasAny(u,["role_control","stun_apply","sleep_apply","tu_manip","stealth"])?4200:0)+(hasAny(u,["role_tank","guard","barrier","hold_ground"])?2200:0),back:st.atk*.42+(hasAny(u,["role_dps","execute","blood","survivor","charge"])?4200:0)+(hasAny(u,["revive","heal","purify"])?1700:0)}});
    scored.sort((a,b)=>b.front-a.front||a.id.localeCompare(b.id));const main=scored.slice(0,STORY_MAIN).map(x=>x.id);const rest=scored.slice(STORY_MAIN).sort((a,b)=>b.back-a.back||a.id.localeCompare(b.id));return{main,back:rest.slice(0,STORY_BACK).map(x=>x.id)};
  }

  function applyStoryLocks(story,layout,locks){
    const main=Array(STORY_MAIN).fill(""),back=Array(STORY_BACK).fill(""),locked=new Set();
    asArray(layout?.storyMain).slice(0,STORY_MAIN).forEach((id,i)=>{if(locks?.storyMain?.[i]&&id){main[i]=text(id);locked.add(text(id));}});
    asArray(layout?.storyBack).slice(0,STORY_BACK).forEach((id,i)=>{if(locks?.storyBack?.[i]&&id){back[i]=text(id);locked.add(text(id));}});
    const q=[...asArray(story.main),...asArray(story.back)].map(text).filter(id=>id&&!locked.has(id));for(let i=0;i<STORY_MAIN;i++)if(!main[i])main[i]=q.shift()||"";for(let i=0;i<STORY_BACK;i++)if(!back[i])back[i]=q.shift()||"";return{main,back};
  }

  function run(units,options){
    try{
      const opts={...(options||{}),optimizerSearchMode:"v3"};const enriched=enrichUnits(units||[],opts);const byId=new Map(enriched.map(u=>[text(u.id),u]));const layout=opts.currentLayout||{},locks=opts.slotLocks||{},used=new Set();
      const storyRow=[...asArray(layout.storyMain).slice(0,STORY_MAIN),...asArray(layout.storyBack).slice(0,STORY_BACK)];
      const storyLocks=[...asArray(locks.storyMain).slice(0,STORY_MAIN),...asArray(locks.storyBack).slice(0,STORY_BACK)];
      const storyIds=buildRow(STORY_MAIN+STORY_BACK,storyRow,storyLocks,enriched,used,byId,opts);
      const story=applyStoryLocks(assignStory(storyIds,byId),layout,locks);const storyPlaced=[...story.main,...story.back].filter(Boolean);storyPlaced.forEach(id=>{const u=byId.get(text(id));if(u)used.add(identity(u).entry);});
      const platoons=[];for(let p=0;p<PLATOONS;p++){const row=asArray(layout.platoons?.[p]).slice(0,PLATOON_SIZE);const flags=asArray(locks.platoons?.[p]).slice(0,PLATOON_SIZE);const ids=buildRow(PLATOON_SIZE,row,flags,enriched,used,byId,opts);platoons.push({name:`Platoon ${p+1}`,units:ids,score:rowScore(ids,byId,opts)});}
      const totalScore=rowScore(storyPlaced,byId,opts)*2+platoons.reduce((a,p)=>a+num(p.score),0);
      return{story,platoons,totalScore,engineVersion:"optimizerEngineV3-core-beam",aiAware:true,duplicateKey:"entryPrefix"};
    }catch(err){console.warn("[Optimizer] V3 failed; falling back.",err);if(previous&&typeof previous.run==="function")return previous.run(units,options);return{story:{main:[],back:[]},platoons:[],totalScore:0,engineVersion:"optimizerEngineV3-empty"};}
  }

  g.OptimizerEngineV3={run};
  g.OptimizerEngine=g.OptimizerEngineV3;
})(window);
