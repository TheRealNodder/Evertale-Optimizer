(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const A=Array.isArray;
  const arr=v=>A(v)?v:[];
  const txt=v=>String(v??'');
  const low=v=>txt(v).trim().toLowerCase();
  const clean=v=>low(v).replace(/[\u2019']/g,'').replace(/[^a-z0-9]+/g,'');
  const keyText=v=>low(v).replace(/[\u2019']/g,'').replace(/[^a-z0-9]+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d;};

  const constants={
    STORY_MAIN:5,
    STORY_BACK:3,
    PLATOONS:20,
    PLATOON_SIZE:5,
    plans:{
      burn:['burn','frostburn','ignite'],
      poison:['poison','venom','toxin','lethal poison','mega poison'],
      sleep:['sleep','dream','nightmare','slumber'],
      stun:['stun','shock','time strike','push back'],
      guardian:['guard','guardian','protect','barrier','hold ground'],
      heal:['heal','revive','purify','cleanse','regeneration'],
      turn:['tu','turn grant','haste','quicken','spirit'],
      blood:['blood','revenge','sacrifice','summon'],
      crisis:['crisis','low hp'],
      survivor:['survivor','survival'],
      offense:['dps','execute','charge','attack','damage']
    },
    aliases:{auto:'',atkBuff:'offense',hpBuff:'guardian',defense:'guardian',cleanse:'heal',spirit:'turn',charge:'offense'},
    roleWords:{
      anchor:['payoff','drive','eater','devour','blast','fury','survivor','crisis','charge'],
      dps:['execute','charge','blood','survivor','poison_eater','burn_drive','time_strike','damage'],
      support:['heal','revive','purify','cleanse','spirit','turn_grant'],
      control:['sleep','stun','push_back','tu','stealth','dispel'],
      tank:['guard','guardian','barrier','hold_ground','damage_reduction']
    }
  };

  function pathOrder(value){const m=txt(value).match(/(?:^|\/)(\d{4})_/);return m?num(m[1]):0;}
  function entryKey(u){
    const paths=[u?.entryPath,u?.path,u?.file,u?.fileName,u?.sourceFile,u?.__path,u?.raw?.entryPath,u?.raw?.sourceFile];
    for(const p of paths){const m=txt(p).match(/(?:^|\/)(\d{4})_/);if(m)return m[1];}
    for(const v of [u?.entryPrefix,u?.entryKey,u?.order,u?.entryOrder,u?.indexOrder,u?.raw?.order]){
      if(v!==undefined&&v!==null&&v!==''){const m=txt(v).match(/\d+/);if(m)return m[0].padStart(4,'0').slice(-4);}
    }
    return 'id_'+clean(u?.id||u?.sourceId||u?.family||u?.name);
  }
  function metaOrder(u){
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
  function identity(u){
    const source=txt(u?.sourceId||'').replace(/\d+$/,'');
    const family=clean(u?.family||u?.internal?.family||source||u?.id||u?.name);
    const name=clean([u?.name,u?.title].filter(Boolean).join(' '))||family||entryKey(u);
    return{entry:entryKey(u),family,name,id:txt(u?.id||u?.sourceId||entryKey(u))};
  }
  function stats(u,profileState){
    if(g.EvertaleRosterProfiles&&typeof g.EvertaleRosterProfiles.estimateUnitStats==='function'){
      try{const s=g.EvertaleRosterProfiles.estimateUnitStats(u,undefined,profileState);return{atk:num(s?.atk),hp:num(s?.hp),spd:num(s?.spd),cost:Math.max(1,num(s?.cost,1)),power:num(s?.power||s?.unitPower)}}catch{}
    }
    const s=u?.stats||{};
    return{atk:num(s.atk??u?.atk),hp:num(s.hp??u?.hp),spd:num(s.spd??u?.spd),cost:Math.max(1,num(s.cost??u?.cost,1)),power:num(u?.power||u?.unitPower)};
  }
  function textBlob(u){
    const raw=[u?.name,u?.title,u?.description,u?.element,u?.weaponType,u?.weaponPref,u?.family,u?.sourceId,...arr(u?.derivedTags),...arr(u?.tags),...arr(u?.passiveTags),...arr(u?.roles),...arr(u?.archetypes),...arr(u?.activeSkills),...arr(u?.passiveSkills),...arr(u?.passiveSkillDetails)]
      .map(v=>typeof v==='object'?JSON.stringify(v):txt(v)).join(' ');
    return keyText(raw);
  }
  function has(blob,words){return arr(words).some(w=>blob.includes(keyText(w)));}

  root.shared={arr,txt,low,clean,keyText,num,pathOrder,entryKey,metaOrder,identity,stats,textBlob,has,constants};
  root.version='v5-lab-1';
})(window);
