/* catalog-image-loader.js
   Isolated ImageKit URL resolver and cache-version guard.
   Owns image URL freshness only. Does not own layout, card behavior, popup behavior, sidebar behavior, or awaken clicks.
*/
(function(){
  const DEFAULT_BASE='https://ik.imagekit.io/r8fsa98s9';
  const DEFAULT_MANIFEST='./apkfiles/entries/maps/image_manifest.json';
  const CONFIG=window.EVERTALE_LIVE_CONFIG||{};
  const FALLBACK_VERSION=String(CONFIG.imageVersion||CONFIG.dataVersion||CONFIG.version||'1');
  const CATEGORY_PATH={characters:'characters',weapons:'weapons',accessories:'accessories',bosses:'bosses'};
  const CATEGORY_ALIAS={character:'characters',characters:'characters',weapon:'weapons',weapons:'weapons',accessory:'accessories',accessories:'accessories',boss:'bosses',bosses:'bosses'};

  let manifest=null;
  let readyPromise=null;
  let readyResolved=false;
  const readyCallbacks=[];

  const clean=value=>String(value||'').trim();
  const trimSlash=value=>String(value||'').replace(/\/+$/,'');
  const normalizeCategory=value=>CATEGORY_ALIAS[String(value||'').trim().toLowerCase()]||String(value||'').trim().toLowerCase();
  const normalizeSource=value=>clean(value).replace(/\.png(?:\?.*)?$/i,'');

  function sanitizeBase(value){
    const raw=clean(value);
    if(!raw)return DEFAULT_BASE;
    const md=raw.match(/\((https?:\/\/[^)]+)\)/)||raw.match(/\[(https?:\/\/[^\]]+)\]/);
    return trimSlash(md?md[1]:raw);
  }

  function versionedManifestUrl(url){
    const token=CONFIG.dataVersion||CONFIG.version||Date.now();
    const sep=String(url).includes('?')?'&':'?';
    return `${url}${sep}v=${encodeURIComponent(token)}`;
  }

  function stripVersionParam(url,param='imgv'){
    if(!url)return url;
    try{
      const u=new URL(url,window.location.href);
      u.searchParams.delete(param);
      return u.href;
    }catch{
      return String(url).replace(new RegExp(`([?&])${param}=[^&]*&?`),'$1').replace(/[?&]$/,'');
    }
  }

  function versionImageUrl(url,explicitVersion){
    if(!url)return url;
    const version=clean(explicitVersion)||clean(manifest?.version)||FALLBACK_VERSION;
    if(!version)return url;
    const base=stripVersionParam(url,'imgv');
    const sep=String(base).includes('?')?'&':'?';
    return `${base}${sep}imgv=${encodeURIComponent(version)}`;
  }

  function canonicalUrl(category,sourceId){
    const cat=normalizeCategory(category);
    const folder=CATEGORY_PATH[cat]||cat;
    const src=normalizeSource(sourceId);
    if(!folder||!src)return '';
    return `${DEFAULT_BASE}/${folder}/${src}.png`;
  }

  function manifestEntry(category,sourceId){
    const cat=normalizeCategory(category);
    const src=normalizeSource(sourceId);
    if(!manifest||!cat||!src)return null;
    return manifest?.[cat]?.[src]||manifest?.[cat]?.[`${src}.png`]||null;
  }

  function urlFromManifest(category,sourceId){
    const entry=manifestEntry(category,sourceId);
    if(!entry)return '';
    const base=sanitizeBase(entry.base||manifest.base);
    const path=clean(entry.path||entry.url||entry.image);
    const raw=path.startsWith('http')?path:`${base}${path.startsWith('/')?'':'/'}${path}`;
    return versionImageUrl(raw,entry.version||manifest.version);
  }

  function resolveImage(category,sourceId,fallbackUrl){
    const fromManifest=urlFromManifest(category,sourceId);
    if(fromManifest)return fromManifest;
    const fallback=clean(fallbackUrl)||canonicalUrl(category,sourceId);
    return versionImageUrl(fallback,manifest?.version||FALLBACK_VERSION);
  }

  function resolveCharacterState(family,suffix,fallbackUrl){
    const sourceId=`${normalizeSource(family)}${clean(suffix).padStart(2,'0')}`;
    return resolveImage('characters',sourceId,fallbackUrl);
  }

  function sourceFromUrl(url){
    return clean(url).split('/').pop()?.replace(/\.png(?:\?.*)?$/i,'')||'';
  }

  function resolveVariant(category,variant,rowSourceId){
    if(!variant||typeof variant!=='object')return variant;
    const sourceId=normalizeSource(variant.sourceId||variant.imageSourceId||variant.dataSourceId||rowSourceId||sourceFromUrl(variant.url||variant.image));
    const fallback=variant.url||variant.image||'';
    const resolved=resolveImage(category,sourceId,fallback);
    return {...variant,url:resolved,image:resolved};
  }

  function resolveLooseImageObject(category,obj,rowSourceId){
    if(!obj||typeof obj!=='object')return obj;
    const sourceId=normalizeSource(obj.sourceId||obj.imageSourceId||obj.dataSourceId||rowSourceId||sourceFromUrl(obj.url||obj.image));
    const fallback=obj.url||obj.image||'';
    const resolved=fallback||sourceId?resolveImage(category,sourceId,fallback):'';
    return resolved?{...obj,url:obj.url?resolved:obj.url,image:obj.image?resolved:obj.image}:obj;
  }

  function resolveRow(category,row){
    if(!row||typeof row!=='object')return row;
    const cat=normalizeCategory(category||row.kind||row.category||'');
    if(!cat)return row;
    const sourceId=normalizeSource(row.sourceId||row.imageSourceId||row.dataSourceId||row.id||row.name||sourceFromUrl(row.image));
    const next={...row};
    if(Array.isArray(next.imageVariants))next.imageVariants=next.imageVariants.map(v=>resolveVariant(cat,v,sourceId));
    if(Array.isArray(next.imagesLarge))next.imagesLarge=next.imagesLarge.map((url,i)=>{
      const variant=next.imageVariants?.[i];
      return variant?.url||resolveImage(cat,sourceFromUrl(url)||sourceId,url);
    });
    if(next.imageVariants?.[0]?.url)next.image=next.imageVariants[0].url;
    else if(next.image)next.image=resolveImage(cat,sourceId,next.image);
    if(Array.isArray(next.forms))next.forms=next.forms.map(form=>resolveLooseImageObject(cat,form,sourceId));
    if(Array.isArray(next.statsByForm))next.statsByForm=next.statsByForm.map(form=>resolveLooseImageObject(cat,form,sourceId));
    if(Array.isArray(next.descriptionByForm))next.descriptionByForm=next.descriptionByForm.map(form=>resolveLooseImageObject(cat,form,sourceId));
    return next;
  }

  function resolveRows(category,rows){
    if(!Array.isArray(rows))return rows;
    return rows.map(row=>resolveRow(category,row));
  }

  function warmImages(urls){
    (urls||[]).filter(Boolean).slice(0,80).forEach(url=>{try{const img=new Image();img.decoding='async';img.src=url;}catch{}});
  }

  function badImageKey(url){
    const version=clean(manifest?.version)||FALLBACK_VERSION;
    try{return `evertale_bad_img_${version}_${btoa(String(url)).slice(0,48)}`;}catch{return `evertale_bad_img_${version}_${String(url).slice(0,48)}`;}
  }

  function handleImageError(imgElement,fallbackUrl){
    if(!imgElement)return;
    const current=imgElement.currentSrc||imgElement.src||'';
    const key=badImageKey(current);
    try{
      if(localStorage.getItem(key)){if(fallbackUrl&&imgElement.src!==fallbackUrl)imgElement.src=fallbackUrl;return;}
      localStorage.setItem(key,'1');
    }catch{}
    if(fallbackUrl&&imgElement.src!==fallbackUrl)imgElement.src=fallbackUrl;
  }

  async function init(manifestUrl=DEFAULT_MANIFEST){
    if(readyPromise)return readyPromise;
    readyPromise=(async()=>{
      try{
        const res=await fetch(versionedManifestUrl(manifestUrl),{cache:'no-cache'});
        manifest=res.ok?await res.json():null;
      }catch(err){
        console.warn('[EvertaleImageLoader] Manifest unavailable; using versioned canonical image URLs.',err);
        manifest=null;
      }finally{
        readyResolved=true;
        readyCallbacks.splice(0).forEach(cb=>{try{cb();}catch{}});
      }
      return manifest;
    })();
    return readyPromise;
  }

  function ready(callback){
    if(typeof callback!=='function')return readyPromise||Promise.resolve(manifest);
    if(readyResolved)callback();
    else readyCallbacks.push(callback);
    return readyPromise||Promise.resolve(manifest);
  }

  function installDataHook(){
    const api=window.EvertaleData;
    if(!api||typeof api.loadEntryCategory!=='function'||api.__imageLoaderInstalled)return false;
    const original=api.loadEntryCategory.bind(api);
    api.loadEntryCategory=async function(category,...rest){
      const rows=await original(category,...rest);
      await (readyPromise||init());
      return resolveRows(category,rows);
    };
    api.__imageLoaderInstalled=true;
    return true;
  }

  window.EvertaleImageLoader={
    init,ready,resolveImage,resolveCharacterState,versionImageUrl,resolveRow,resolveRows,warmImages,handleImageError,installDataHook,
    get manifest(){return manifest;},
    get isReady(){return readyResolved;}
  };

  init(DEFAULT_MANIFEST);
  if(!installDataHook())document.addEventListener('DOMContentLoaded',installDataHook,{once:true});
})();
