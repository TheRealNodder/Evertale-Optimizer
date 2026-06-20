/* catalog-character-state-repair.js
   In-memory character state guard. It wraps only
   EvertaleData.loadEntryCategory('characters') so sparse/new raw rows still
   expose the state arrays that catalog-v2-lite consumes.
*/
(function(){
  const IMAGE_MAP_URL='./apkfiles/entries/maps/character_image_map.json';
  const FAMILY_BUNDLE_URL='./apkfiles/entries/bundles/character_families.bundle.json';
  const IMG_BASE='https://ik.imagekit.io/r8fsa98s9/characters/';
  const STATE_BY_RARITY={
    SSR:[['base','01',5],['evolved','02',6],['final','03',6]],
    SR:[['base','01',3],['evolved','02',4]]
  };
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
    const explicit=clean(row?.rarity||familyEntry?.rarity).toUpperCase();
    if(explicit)return explicit;
    const stars=Number(row?.stars||row?.raw?.stars||0);
    const evolved=Number(row?.evolvedStars||row?.raw?.evolvedStars||0);
    const max=Math.max(stars,evolved);
    if(max>=5)return 'SSR';
    if(max>=3)return 'SR';
    if(max>=2)return 'R';
    return 'N';
  }

  function familyOf(row){
    const firstImage=String(row?.image||row?.imagesLarge?.[0]||row?.imageVariants?.[0]?.url||row?.imageVariants?.[0]?.image||'').split('/').pop()?.replace(/\.png(?:\?.*)?$/i,'')||'';
    return clean(row?.family)||stripSuffix(row?.sourceId)||stripSuffix(row?.id)||stripSuffix(firstImage)||stripSuffix(row?.name);
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
    [entry.family,entry.id,entry.sourceId,entry.name,entry.title].forEach(key=>remember(map,key,packed));
    states.forEach(state=>{
      [state.sourceId,state.dataSourceId,state.imageSourceId,stripSuffix(state.sourceId),stripSuffix(state.dataSourceId)].forEach(key=>remember(map,key,packed));
    });
  }

  async function loadStateMap(){
    if(stateMapPromise)return stateMapPromise;
    stateMapPromise=Promise.all([readJson(IMAGE_MAP_URL),readJson(FAMILY_BUNDLE_URL)]).then(([imageMap,familyBundle])=>{
      const map=new Map();
      Object.values(imageMap?.families||{}).forEach(entry=>addEntry(map,entry));
      arr(familyBundle?.entries).forEach(entry=>addEntry(map,entry));
      return map;
    }).catch(()=>new Map());
    return stateMapPromise;
  }

  function candidates(row){
    const variants=arr(row?.imageVariants);
    const forms=arr(row?.forms);
    const family=familyOf(row);
    return [
      family,row?.family,row?.sourceId,row?.id,row?.name,row?.title,
      stripSuffix(row?.sourceId),variants[0]?.sourceId,variants[0]?.dataSourceId,
      forms[0]?.sourceId,forms[0]?.dataSourceId
    ].filter(Boolean);
  }

  function syntheticStates(row,family,rarity){
    const expected=STATE_BY_RARITY[rarity]||[];
    return expected.map(([state,suffix,stars])=>{
      const sourceId=`${family}${suffix}`;
      return normalizeState({state,sourceId,dataSourceId:sourceId,imageSourceId:sourceId,url:imageUrl(sourceId),stars,title:row?.subtitle||row?.title||'',description:''},family);
    }).filter(Boolean);
  }

  function stateRank(state){
    const raw=String(state?.state||state?.sourceId||state?.imageSourceId||'').toLowerCase();
    if(/final|fa|03$/.test(raw))return 2;
    if(/evolved|awaken|02$/.test(raw))return 1;
    return 0;
  }

  function mergeVariants(existing,states,count){
    const out=[];
    const seen=new Set();
    const add=variant=>{
      const normalized=normalizeState(variant);
      if(!normalized)return;
      const key=`${normalized.state}|${normalized.sourceId}|${normalized.dataSourceId}|${normalized.url}`;
      if(seen.has(key))return;
      seen.add(key);
      out.push(normalized);
    };
    arr(existing).forEach(add);
    arr(states).forEach(add);
    return out.sort((a,b)=>stateRank(a)-stateRank(b)).slice(0,count);
  }

  function nearestForm(row,state,index){
    const forms=arr(row?.forms);
    const statsRows=arr(row?.statsByForm);
    const exact=forms.find(form=>cleanKey(form?.sourceId)===cleanKey(state.dataSourceId)||cleanKey(form?.sourceId)===cleanKey(state.sourceId))||
      statsRows.find(form=>cleanKey(form?.sourceId)===cleanKey(state.dataSourceId)||cleanKey(form?.sourceId)===cleanKey(state.sourceId));
    return exact||forms[Math.min(index,Math.max(forms.length-1,0))]||statsRows[Math.min(index,Math.max(statsRows.length-1,0))]||forms[forms.length-1]||statsRows[statsRows.length-1]||{};
  }

  function targetCount(row,states,rarity){
    if(states?.length>=3)return 3;
    if(states?.length>=2)return 2;
    if(rarity==='SSR')return 3;
    if(rarity==='SR')return 2;
    return Math.max(arr(row?.imageVariants).length,arr(row?.imagesLarge).length,1);
  }

  function repairRow(row,map){
    if(!row||typeof row!=='object')return row;
    let familyEntry=null;
    for(const candidate of candidates(row)){
      familyEntry=map.get(cleanKey(candidate));
      if(familyEntry)break;
    }
    const family=clean(familyEntry?.family)||familyOf(row);
    const rarity=inferRarity(row,familyEntry);
    if(!family)return row;

    const mapStates=arr(familyEntry?.states);
    const fallbackStates=syntheticStates(row,family,rarity);
    const count=Math.min(3,targetCount(row,mapStates.length?mapStates:fallbackStates,rarity));
    const variants=mergeVariants(row.imageVariants,[...mapStates,...fallbackStates],count);
    if(variants.length<2)return row;
    if(arr(row.imageVariants).length>=variants.length&&arr(row.forms).length>=variants.length&&arr(row.statsByForm).length>=variants.length&&arr(row.descriptionByForm).length>=variants.length)return row;

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
