/* data-loader-index-authority.js
   Guard for live entry visibility.

   The primary loader prefers compact category bundles for speed. If generated
   entry files and index.json exist but the category bundle is stale or short,
   this guard appends the missing indexed entries so Catalog/Roster/Optimizer
   are not capped by an older bundle.

   Intentional scope:
   - No UI/layout/sidebar mutation.
   - No image/photo loader changes.
   - Weapons are skipped because weapon bundles intentionally collapse many raw
     state rows into one visible weapon-family card.
*/
(function(){
  const CONFIG=window.EVERTALE_LIVE_CONFIG||{};
  const ENTRY_BASE=CONFIG.entryBase||'./apkfiles/entries';
  const DATA_VERSION=CONFIG.dataVersion||CONFIG.version||'';
  const CACHE_MODE=CONFIG.bundleCacheMode||CONFIG.cacheMode||'default';
  const GUARDED=new Set(['characters','accessories','bosses']);
  const REPORT={enabled:true,categories:{}};

  function versionedUrl(url){
    if(!DATA_VERSION)return url;
    const sep=String(url).includes('?')?'&':'?';
    return `${url}${sep}v=${encodeURIComponent(DATA_VERSION)}`;
  }

  async function fetchJson(url,optional=true){
    try{
      const res=await fetch(versionedUrl(url),{cache:CACHE_MODE});
      if(!res.ok){if(optional)return null;throw new Error(`${res.status} ${url}`);}
      return await res.json();
    }catch(err){if(optional)return null;throw err;}
  }

  function sourceIdOf(row){
    const internal=row&&typeof row.internal==='object'?row.internal:{};
    return String(internal.sourceId||row?.sourceId||row?.family||row?.id||row?.name||'').trim();
  }

  function normalizeFile(file){
    return String(file||'').replace(/^\.\//,'').replace(/^entries\//,'');
  }

  async function loadIndexedExtras(category,bundleRows){
    if(!GUARDED.has(category))return {rows:[],report:{skipped:'unguarded-category'}};
    const [index,bundle]=await Promise.all([
      fetchJson(`${ENTRY_BASE}/${category}/index.json`,true),
      fetchJson(`${ENTRY_BASE}/bundles/${category}.bundle.json`,true)
    ]);
    const indexRows=Array.isArray(index?.entries)?index.entries:[];
    const bundled=Array.isArray(bundle?.entries)?bundle.entries:[];
    const bundleCount=bundled.length||Number(bundle?.count)||0;
    const report={indexCount:indexRows.length,bundleCount,loadedCount:Array.isArray(bundleRows)?bundleRows.length:0,extraCount:0,extraFiles:[]};

    if(!indexRows.length||bundleCount>=indexRows.length){
      report.status='bundle-current';
      return {rows:[],report};
    }

    const seen=new Set();
    for(const row of bundled)seen.add(sourceIdOf(row));
    for(const row of bundleRows||[])seen.add(sourceIdOf(row));

    const missing=indexRows.filter(row=>{
      const sid=sourceIdOf(row);
      return sid&&!seen.has(sid);
    });

    const extras=[];
    for(const row of missing){
      const file=normalizeFile(row.file);
      if(!file)continue;
      try{
        const entry=await fetchJson(`${ENTRY_BASE}/${category}/entries/${file}`,false);
        const sid=sourceIdOf(row);
        const order=Number(row.fileHandleOrder||row.sourceOrder||row.order||0)||undefined;
        if(entry&&typeof entry==='object'){
          entry.internal={...(entry.internal||{})};
          if(sid&&!entry.internal.sourceId)entry.internal.sourceId=sid;
          if(order){
            entry.fileHandleOrder=entry.fileHandleOrder||order;
            entry.sourceOrder=entry.sourceOrder||order;
            entry.visualOrder=entry.visualOrder||order;
            entry.order=entry.order||order;
          }
          entry._bundleSourceFile=entry._bundleSourceFile||`entries/${file}`;
          extras.push(entry);
          report.extraFiles.push(file);
        }
      }catch(err){
        (report.errors||(report.errors=[])).push(`${file}: ${err&&err.message?err.message:err}`);
      }
    }

    report.extraCount=extras.length;
    report.status=extras.length?'appended-index-extras':'short-bundle-no-extras-loaded';
    return {rows:extras,report};
  }

  function install(){
    const loader=window.EvertaleData;
    if(!loader||typeof loader.loadEntryCategory!=='function')return false;
    if(loader.__indexAuthorityInstalled)return true;
    const original=loader.loadEntryCategory.bind(loader);
    loader.loadEntryCategory=async function(category,...rest){
      const rows=await original(category,...rest);
      try{
        const bundleStatus=typeof loader.getCategoryBundleStatus==='function'?await loader.getCategoryBundleStatus(category):null;
        if(bundleStatus&&bundleStatus.source==='category-bundle'&&bundleStatus.count>=bundleStatus.sourceIndexCount){
          const report={status:'bundle-metadata-current',loadedCount:Array.isArray(rows)?rows.length:0,...bundleStatus};
          REPORT.categories[category]=report;
          window.__EVERTALE_INDEX_AUTHORITY_REPORT=REPORT;
          return rows;
        }
        const {rows:extras,report}=await loadIndexedExtras(category,rows);
        REPORT.categories[category]=report;
        window.__EVERTALE_INDEX_AUTHORITY_REPORT=REPORT;
        if(Array.isArray(extras)&&extras.length)return [...(Array.isArray(rows)?rows:[]),...extras];
      }catch(err){
        REPORT.categories[category]={status:'error',error:err&&err.message?err.message:String(err)};
        window.__EVERTALE_INDEX_AUTHORITY_REPORT=REPORT;
      }
      return rows;
    };
    loader.__indexAuthorityInstalled=true;
    window.__EVERTALE_INDEX_AUTHORITY_REPORT=REPORT;
    return true;
  }

  if(!install())document.addEventListener('DOMContentLoaded',install,{once:true});
})();
