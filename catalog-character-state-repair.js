/* catalog-character-state-repair.js
   In-memory character state guard. It wraps only
   EvertaleData.loadEntryCategory('characters') so sparse/new raw rows still
   expose the state arrays that catalog-v2-lite consumes.
*/
(function(){
  const IMAGE_MAP_URL='./apkfiles/entries/maps/character_image_map.json';
  const FAMILY_BUNDLE_URL='./apkfiles/entries/bundles/character_families.bundle.json';
  const IMG_BASE='https://ik.imagekit.io/r8fsa98s9/characters/';
  let stateMapPromise=null;

  const arr=value=>Array.isArray(value)?value:[];
  const cleanKey=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
  const clean=value=>String(value||'').trim();
  const stripSuffix=value=>clean(value).replace(/\d+$/,'');
  const imageUrl=sourceId=>sourceId?`${IMG_BASE}${sourceId}.png`:'';

  async function readJson(url){
    try{
      const res=await fetch(url,{cache:'default'});
      return res.ok?await res.json():null;
    }catch{return null;}
  }

  function inferRarity(row,familyEntry){
    const explicit=clean(familyEntry?.rarity||row?.rarity).toUpperCase();
    if(explicit)return explicit;
    const stars=Number(row?.stars||row?.raw?.stars||0);
    if(stars>=5)return 'SSR';
    if(stars===4)return 'SR';
    if(stars===3)return 'R';
    return 'N';
  }

  function familyOf(row){
    const firstImage=String(row?.image||row?.imagesLarge?.[0]||row?.imageVariants?.[0]?.url||row?.imageVariants?.[0]?.image||'').split('/').pop()?.replace(/\.png(?:\?.*)?$/i,'')||'';
    const sourceFamily=stripSuffix(row?.sourceId)||stripSuffix(row?.imageVariants?.[0]?.sourceId)||stripSuffix(row?.forms?.[0]?.sourceId)||stripSuffix(firstImage);
    return sourceFamily||clean(row?.family)||stripSuffix(row?.id)||stripSuffix(row?.name);
  }

  function normalizeState(raw,family){
    if(!raw||typeof raw!=='object')return null;
    const sourceId=clean(raw.sourceId||raw.imageSourceId||raw.dataSourceId);
    const dataSourceId=clean(raw.dataSourceId||raw.sourceId);
    const img=raw.url||raw.image||imageUrl(sourceId||family);
    if(!img&&!sourceId)return null;
    return {
      state:raw.state||'base',
      sourceId,
      dataSourceId:dataSourceId||sourceId,
      imageSourceId:raw.imageSourceId||sourceId||dataSourceId,
      url:img,
      image:img,
      stars:raw.stars,
      title:raw.title||'',
      description:raw.description||''
    };
  }

  function remember(map,key,entry){
    const k=cleanKey(key);
    if(k&&!map.has(k))map.set(k,entry);
  }

  function addEntry(map,entry){
    if(!entry||typeof entry!=='object')return;
    const family=clean(entry.family||entry.id||entry.sourceId);
    const states=arr(entry.states).map(state=>normalizeState(state,family)).filter(Boolean).slice(0,3);
    if(!states.length)return;
    const packed={...entry,states};
    // Strict identifiers only. Do not register display name/title here because
    // different units can share a name, e.g. Jeanne and JeanneFusion both display
    // as "Jeanne". Display-name aliases caused JeanneFusion to inherit Jeanne01/02.
    [entry.family,entry.id,entry.sourceId].forEach(key=>remember(map,key,packed));
    states.forEach(state=>{
      [state.sourceId,state.dataSourceId,state.imageSourceId,stripSuffix(state.sourceId),stripSuffix(state.dataSourceId)].forEach(key=>remember(map,key,packed));
    });
  }

  async function loadStateMap(){
    if(stateMapPromise)return stateMapPromise;
    const loader=window.EvertaleData;
    const imagePromise=typeof loader?.getCharacterImageMap==='function'?loader.getCharacterImageMap():readJson(IMAGE_MAP_URL);
    const familyPromise=typeof loader?.getCharacterFamiliesMap==='function'?loader.getCharacterFamiliesMap():readJson(FAMILY_BUNDLE_URL);
    stateMapPromise=Promise.all([imagePromise,familyPromise]).then(([imageMap,familySource])=>{
      const map=new Map();
      // Loader.getCharacterImageMap() returns the families object directly;
      // the raw JSON fallback returns the outer payload. Accept both shapes so
      // audited image overrides always win before generated family states.
      Object.values(imageMap?.families||imageMap||{}).forEach(entry=>addEntry(map,entry));
      const familyEntries=familySource instanceof Map?[...familySource.values()]:arr(familySource?.entries);
      familyEntries.forEach(entry=>addEntry(map,entry));
      return map;
    }).catch(()=>new Map());
    return stateMapPromise;
  }

  function candidates(row){
    const variants=arr(row?.imageVariants);
    const forms=arr(row?.forms);
    const family=familyOf(row);
    return [
      // Strict identifiers first. Display name/title are intentionally excluded
      // because they are not unique stable image-family keys.
      family,row?.family,row?.sourceId,row?.id,
      stripSuffix(row?.sourceId),variants[0]?.sourceId,variants[0]?.dataSourceId,
      forms[0]?.sourceId,forms[0]?.dataSourceId
    ].filter(Boolean);
  }

  function collectTextHints(value,out=[]){
    if(value==null)return out;
    if(typeof value==='string'||typeof value==='number'){
      const text=String(value);
      if(text)out.push(text);
      return out;
    }
    if(Array.isArray(value)){
      value.forEach(v=>collectTextHints(v,out));
      return out;
    }
    if(typeof value==='object'){
      ['id','name','sourceId','dataSourceId','imageSourceId','family','state','url','image','skill','internalId'].forEach(k=>collectTextHints(value[k],out));
    }
    return out;
  }

  function inferEntryFromSignals(row,map,currentEntry){
    const currentFamily=cleanKey(currentEntry?.family||familyOf(row));
    const hints=collectTextHints([
      row?.sourceId,row?.family,row?.id,
      row?.activeSkills,row?.passiveSkills,row?.passiveSkillDetails,
      row?.leaderSkill,row?.refs,row?.forms,row?.imageVariants,row?.statsByForm,row?.descriptionByForm
    ]).map(cleanKey).filter(Boolean);
    if(!hints.length)return currentEntry;
    let best=currentEntry||null;
    let bestLen=currentFamily.length;
    const seen=new Set();
    for(const entry of map.values()){
      const fam=clean(entry?.family||entry?.sourceId||entry?.id);
      const key=cleanKey(fam);
      if(!key||seen.has(key)||key.length<=bestLen)continue;
      seen.add(key);
      if(hints.some(h=>h.includes(key))){
        best=entry;
        bestLen=key.length;
      }
    }
    return best;
  }

  function statesMatchFamily(states,family){
    const key=cleanKey(family);
    if(!key)return true;
    return arr(states).some(state=>{
      const sid=cleanKey(state?.sourceId||state?.imageSourceId||state?.dataSourceId||state?.url||state?.image);
      return sid.includes(key);
    });
  }

  function syntheticStates(row,family){
    const candidates=[...arr(row?.forms),...arr(row?.statsByForm),...arr(row?.descriptionByForm),...arr(row?.imageVariants)];
    const states=[],seen=new Set();
    candidates.forEach((candidate,index)=>{
      const sourceId=clean(candidate?.sourceId||candidate?.dataSourceId||candidate?.imageSourceId);
      if(!sourceId||!cleanKey(sourceId).includes(cleanKey(family)))return;
      const normalized=normalizeState({...candidate,state:candidate?.state||(index===0?'base':String(index)),sourceId,dataSourceId:candidate?.dataSourceId||sourceId,imageSourceId:candidate?.imageSourceId||sourceId,url:candidate?.url||candidate?.image||imageUrl(sourceId),stars:candidate?.stars},family);
      const key=cleanKey(normalized?.sourceId||normalized?.dataSourceId);
      if(normalized&&key&&!seen.has(key)){seen.add(key);states.push(normalized);}
    });
    if(states.length)return states.slice(0,3);
    const sourceId=clean(row?.sourceId||row?.internal?.sourceId||family);
    return [normalizeState({state:'base',sourceId,dataSourceId:sourceId,imageSourceId:sourceId,url:row?.image||imageUrl(sourceId),stars:row?.stars??row?.raw?.stars,title:row?.subtitle||row?.title||'',description:row?.description||''},family)].filter(Boolean);
  }

  function stateRank(state){
    const raw=[state?.state,state?.sourceId,state?.imageSourceId,state?.dataSourceId,state?.url,state?.image].map(value=>String(value||'')).join(' ').toLowerCase();
    if(/final|\bfa\b|03(?:\D|$)/.test(raw))return 2;
    if(/evolved|awaken|02(?:\D|$)/.test(raw))return 1;
    return 0;
  }

  function mergeVariants(existing,states,count){
    const ranked=new Map();
    const overflow=[];
    const seen=new Set();
    const add=variant=>{
      const normalized=normalizeState(variant);
      if(!normalized)return;
      const key=`${normalized.state}|${normalized.sourceId}|${normalized.dataSourceId}|${normalized.url}`;
      if(seen.has(key))return;
      seen.add(key);
      const rank=stateRank(normalized);
      if(!ranked.has(rank))ranked.set(rank,normalized);
      else overflow.push(normalized);
    };
    // Family-map states are authoritative. Existing generic "source" variants
    // may repeat 01/02 and must not displace the real 03 final-awaken state.
    arr(states).forEach(add);
    arr(existing).forEach(add);
    const out=[...ranked.entries()].sort((a,b)=>a[0]-b[0]).map(([,variant])=>variant);
    overflow.forEach(variant=>{if(out.length<count)out.push(variant);});
    return out.slice(0,count);
  }

  function nearestForm(row,state,index){
    const forms=arr(row?.forms);
    const statsRows=arr(row?.statsByForm);
    const exact=forms.find(form=>cleanKey(form?.sourceId)===cleanKey(state.dataSourceId)||cleanKey(form?.sourceId)===cleanKey(state.sourceId))||
      statsRows.find(form=>cleanKey(form?.sourceId)===cleanKey(state.dataSourceId)||cleanKey(form?.sourceId)===cleanKey(state.sourceId));
    return exact||forms[Math.min(index,Math.max(forms.length-1,0))]||statsRows[Math.min(index,Math.max(statsRows.length-1,0))]||forms[forms.length-1]||statsRows[statsRows.length-1]||{};
  }

  function targetCount(row,states){
    return Math.min(3,Math.max(arr(states).length,arr(row?.forms).length,arr(row?.statsByForm).length,arr(row?.imageVariants).length,arr(row?.imagesLarge).length,1));
  }

  function repairRow(row,map){
    if(!row||typeof row!=='object')return row;
    let familyEntry=null;
    for(const candidate of candidates(row)){
      familyEntry=map.get(cleanKey(candidate));
      if(familyEntry)break;
    }
    familyEntry=inferEntryFromSignals(row,map,familyEntry);
    const family=clean(familyEntry?.family)||familyOf(row);
    const rarity=inferRarity(row,familyEntry);
    if(!family)return row;

    const mapStates=arr(familyEntry?.states);
    const fallbackStates=syntheticStates(row,family);
    const count=targetCount(row,mapStates.length?mapStates:fallbackStates);
    const variants=mergeVariants(statesMatchFamily(row.imageVariants,family)?row.imageVariants:[],[...mapStates,...fallbackStates],count);
    if(variants.length<2)return row;
    if(statesMatchFamily(row.imageVariants,family)&&arr(row.imageVariants).length>=variants.length&&arr(row.forms).length>=variants.length&&arr(row.statsByForm).length>=variants.length&&arr(row.descriptionByForm).length>=variants.length)return row;

    const forms=variants.map((variant,index)=>{
      const source=nearestForm(row,variant,index);
      return {
        ...source,
        state:variant.state,
        sourceId:source.sourceId||variant.dataSourceId||variant.sourceId,
        dataSourceId:variant.dataSourceId||source.dataSourceId||source.sourceId||variant.sourceId,
        imageSourceId:variant.imageSourceId||variant.sourceId,
        image:variant.image,
        url:variant.url,
        stars:variant.stars||source.stars,
        title:variant.title||source.title||row.title||row.subtitle||'',
        description:variant.description||source.description||row.description||'',
        stats:source.stats||row.stats||{}
      };
    });

    return {
      ...row,
      id:family||row.id,
      sourceId:family||row.sourceId,
      family:family||row.family,
      rarity:row.rarity||familyEntry?.rarity||rarity,
      image:variants[0]?.url||row.image,
      imageVariants:variants,
      imagesLarge:variants.map(variant=>variant.url).filter(Boolean),
      forms,
      statsByForm:forms.map(form=>({
        sourceId:form.sourceId,
        dataSourceId:form.dataSourceId,
        imageSourceId:form.imageSourceId,
        state:form.state,
        stars:form.stars,
        rarity:row.rarity||familyEntry?.rarity||rarity,
        stats:form.stats||row.stats||{},
        order:form.order||row.order
      })),
      descriptionByForm:forms.map(form=>({
        sourceId:form.sourceId,
        dataSourceId:form.dataSourceId,
        imageSourceId:form.imageSourceId,
        state:form.state,
        title:form.title||row.title||row.subtitle||'',
        description:form.description||row.description||'',
        order:form.order||row.order
      }))
    };
  }

  function install(){
    const loader=window.EvertaleData;
    if(!loader||typeof loader.loadEntryCategory!=='function')return false;
    if(loader.__characterStateRepairInstalled)return true;
    const original=loader.loadEntryCategory.bind(loader);
    loader.loadEntryCategory=async function(category,...rest){
      const rows=await original(category,...rest);
      if(category!=='characters'||!Array.isArray(rows))return rows;
      const map=await loadStateMap();
      let repaired=0;
      const next=rows.map(row=>{
        const fixed=repairRow(row,map);
        if(fixed!==row)repaired++;
        return fixed;
      });
      window.__EVERTALE_CHARACTER_STATE_REPAIR_REPORT={rows:rows.length,repaired};
      return next;
    };
    loader.__characterStateRepairInstalled=true;
    return true;
  }

  if(!install()){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }
})();
