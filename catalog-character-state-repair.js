/* catalog-character-state-repair.js
   Narrow Catalog data shim: guarantees character families expose their expected awaken image states before catalog-v2-lite renders cards.
   This does not mutate generated apkfiles data. It only repairs the in-memory rows returned by EvertaleData.loadEntryCategory('characters').
*/
(function(){
  const IMG_BASE='https://ik.imagekit.io/r8fsa98s9/characters/';
  const STATE_BY_RARITY={
    SSR:[['base','01',5],['evolved','02',6],['final','03',6]],
    SR:[['base','01',3],['evolved','02',4]]
  };

  function clean(value){return String(value||'').trim();}
  function stripSuffix(value){return clean(value).replace(/\d+$/,'');}
  function inferRarity(row){
    const explicit=clean(row?.rarity).toUpperCase();
    if(explicit)return explicit;
    const stars=Number(row?.stars||row?.raw?.stars||0);
    const evolved=Number(row?.evolvedStars||row?.raw?.evolvedStars||0);
    const max=Math.max(stars,evolved);
    if(max>=5)return 'SSR';
    if(max>=3)return 'SR';
    if(max>=2)return 'R';
    return 'N';
  }
  function familyOf(row){return clean(row?.family)||stripSuffix(row?.sourceId)||stripSuffix(row?.id)||stripSuffix(row?.name);}
  function urlFor(family,suffix){return `${IMG_BASE}${family}${suffix}.png`;}
  function variantKey(v){return clean(v?.url||v?.image)||clean(v?.sourceId||v?.imageSourceId||v?.dataSourceId);}
  function findExisting(existing,family,suffix){
    const source=`${family}${suffix}`;
    return existing.find(v=>{
      const ids=[v?.sourceId,v?.imageSourceId,v?.dataSourceId].map(clean);
      if(ids.includes(source))return true;
      const url=clean(v?.url||v?.image);
      return url.endsWith(`/${source}.png`);
    })||null;
  }
  function repairRow(row){
    if(!row||typeof row!=='object')return row;
    const family=familyOf(row);
    const expected=STATE_BY_RARITY[inferRarity(row)];
    if(!family||!expected)return row;

    const existing=[];
    if(Array.isArray(row.imageVariants))existing.push(...row.imageVariants);
    if(Array.isArray(row.imagesLarge))row.imagesLarge.forEach((url,i)=>existing.push({url,image:url,sourceId:`${family}${String(i+1).padStart(2,'0')}`}));
    if(row.image)existing.push({url:row.image,image:row.image,sourceId:row.sourceId||`${family}01`});

    const repaired=[];
    for(const [state,suffix,stars] of expected){
      const sourceId=`${family}${suffix}`;
      const found=findExisting(existing,family,suffix)||{};
      const url=clean(found.url||found.image)||urlFor(family,suffix);
      repaired.push({
        ...found,
        state:found.state||state,
        url,
        image:url,
        stars:found.stars||stars,
        sourceId:found.sourceId||sourceId,
        dataSourceId:found.dataSourceId||found.sourceId||sourceId,
        imageSourceId:found.imageSourceId||found.sourceId||sourceId,
        title:found.title||row.subtitle||row.title||'',
        description:found.description||''
      });
    }

    const seen=new Set();
    row.imageVariants=repaired.filter(v=>{const k=variantKey(v);if(!k||seen.has(k))return false;seen.add(k);return true;});
    row.imagesLarge=row.imageVariants.map(v=>v.url||v.image).filter(Boolean);
    row.image=row.imagesLarge[0]||row.image;
    return row;
  }
  function repairRows(rows){return Array.isArray(rows)?rows.map(repairRow):rows;}
  function install(){
    const api=window.EvertaleData;
    if(!api||api.__characterStateRepairInstalled||typeof api.loadEntryCategory!=='function')return false;
    const original=api.loadEntryCategory.bind(api);
    api.loadEntryCategory=async function(category,...rest){
      const rows=await original(category,...rest);
      return category==='characters'?repairRows(rows):rows;
    };
    api.__characterStateRepairInstalled=true;
    return true;
  }
  if(!install())document.addEventListener('DOMContentLoaded',install,{once:true});
})();
