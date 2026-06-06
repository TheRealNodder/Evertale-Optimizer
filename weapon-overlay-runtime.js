/* weapon-overlay-runtime.js — use restored known-good weapon overlay when present.
   Overlay source:
   apkfiles/entries/overlays/weapons_overlay.json

   Behavior:
   - If overlay exists, catalog weapons come from overlay.
   - Overlay order is preserved under default Newest Added sort.
   - Current indexed weapons from apkfiles/entries/weapons/index.json are appended only if not already in the overlay.
   - This prevents raw discovered weapon variants from flooding the test/live catalog.
*/
(function(){
  const OVERLAY_URL = './apkfiles/entries/overlays/weapons_overlay.json';
  const INDEX_URL = './apkfiles/entries/weapons/index.json';
  const ENTRY_BASE = './apkfiles/entries/weapons';
  const OVERLAY_ORDER_BASE = 900000;
  let overlayPromise = null;

  function norm(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');}
  function basename(v){return String(v||'').split(/[?#]/)[0].split('/').pop().replace(/\.[a-z0-9]+$/i,'');}
  function sourceKeys(row){
    return [
      row?.id,
      row?.sourceId,
      row?.name,
      row?.displayName,
      row?.title,
      row?.internal?.sourceId,
      row?.internal?.weaponId,
      row?.internal?.family,
      row?.raw?.name,
      basename(row?.image),
      basename(row?.raw?.image)
    ].map(norm).filter(Boolean);
  }
  function hasAnyKey(set,row){return sourceKeys(row).some(k=>set.has(k));}
  function addKeys(set,row){sourceKeys(row).forEach(k=>set.add(k));}
  function overlaySortOrder(index,total){return OVERLAY_ORDER_BASE + (total - index);}
  function appendSortOrder(index){return OVERLAY_ORDER_BASE + 1000 + index;}
  async function fetchJson(url, optional=true){
    try{const r=await fetch(url,{cache:'no-store'}); if(!r.ok){if(optional)return null; throw new Error(`${url}: ${r.status}`);} return await r.json();}
    catch(e){if(optional)return null; throw e;}
  }
  function overlayRows(payload){
    const rows = Array.isArray(payload?.weapons) ? payload.weapons : Array.isArray(payload?.entries) ? payload.entries : [];
    const total = rows.length;
    return rows.map((w,i)=>{
      const sourceId = w.sourceId || w.internal?.sourceId || w.raw?.name || basename(w.image) || w.id || w.name;
      return {
        ...w,
        kind:'weapons',
        category:'weapons',
        sourceId,
        internal:{...(w.internal||{}),source:'weapon_overlay',sourceId,weaponId:w.internal?.weaponId || w.raw?.name || basename(w.image)},
        order:overlaySortOrder(i,total),
        fileHandleOrder:overlaySortOrder(i,total),
        sourceOrder:overlaySortOrder(i,total),
        _weaponOverlay:true,
        _weaponOverlayIndex:i
      };
    });
  }
  async function indexedWeaponRows(existingRows){
    const index = await fetchJson(INDEX_URL,true);
    const entries = Array.isArray(index?.entries) ? index.entries : [];
    if(!entries.length) return [];
    const bySource = new Map();
    for(const row of existingRows||[]){
      sourceKeys(row).forEach(k=>{if(!bySource.has(k))bySource.set(k,row);});
    }
    const loaded=[];
    for(const row of entries){
      const keys=sourceKeys(row);
      let found=keys.map(k=>bySource.get(k)).find(Boolean);
      if(!found && row.file){
        const rel=String(row.file).replace(/^\.\//,'').replace(/^entries\//,'');
        found=await fetchJson(`${ENTRY_BASE}/entries/${rel}`,true) || await fetchJson(`${ENTRY_BASE}/${rel}`,true);
      }
      if(found) loaded.push({...found,order:row.fileHandleOrder ?? row.sourceOrder ?? row.order ?? found.order});
    }
    return loaded;
  }
  async function loadOverlayWeapons(existingRows=[]){
    if(overlayPromise) return overlayPromise.then(fn=>fn(existingRows));
    overlayPromise = (async()=>{
      const payload = await fetchJson(OVERLAY_URL,true);
      const base = overlayRows(payload);
      if(!base.length) return null;
      return async function merge(existing){
        const out=[...base];
        const keys=new Set();
        out.forEach(row=>addKeys(keys,row));
        const indexed=await indexedWeaponRows(existing);
        let appendIndex=0;
        for(const row of indexed){
          if(!hasAnyKey(keys,row)){
            const order=appendSortOrder(appendIndex++);
            out.unshift({...row,order,fileHandleOrder:order,sourceOrder:order,_weaponOverlayAppend:true});
            addKeys(keys,row);
          }
        }
        return out;
      };
    })();
    const fn = await overlayPromise;
    return fn ? await fn(existingRows) : null;
  }
  function patch(){
    const d=window.EvertaleData;
    if(!d || d.__weaponOverlayPatched) return false;
    d.__weaponOverlayPatched=true;
    const originalLoadEntryCategory=d.loadEntryCategory;
    if(typeof originalLoadEntryCategory==='function'){
      d.loadEntryCategory=async function(category,...args){
        const rows=await originalLoadEntryCategory.apply(this,[category,...args]);
        if(category==='weapons') return await loadOverlayWeapons(rows) || rows;
        return rows;
      };
    }
    const originalLoadAllEntries=d.loadAllEntries;
    if(typeof originalLoadAllEntries==='function'){
      d.loadAllEntries=async function(...args){
        const all=await originalLoadAllEntries.apply(this,args);
        if(all && Array.isArray(all.weapons)) all.weapons = await loadOverlayWeapons(all.weapons) || all.weapons;
        return all;
      };
    }
    return true;
  }
  function boot(){if(!patch())setTimeout(boot,50);}
  boot();
})();
