/* weapon-overlay-runtime.js
   Restores the curated legacy weapon rows without letting the overlay
   override chronological weapon sorting.

   Important:
   - Weapon chronology is the numeric file-handle prefix.
   - 0001_* is oldest; larger prefixes are newer.
   - The overlay is only a display/data source. It must not invent 900000+
     sort values, because catalog-sort.js will correctly sort for newest/oldest.
*/
(function(){
  'use strict';

  const OVERLAY_URL = './apkfiles/entries/overlays/weapons_overlay.json';
  const INDEX_URL = './apkfiles/entries/weapons/index.json';
  const ENTRY_BASE = './apkfiles/entries/weapons';
  const UNKNOWN_ORDER = 999999;
  let overlayPromise = null;
  let indexPromise = null;

  function norm(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');}
  function basename(v){return String(v||'').split(/[?#]/)[0].split('/').pop().replace(/\.[a-z0-9]+$/i,'');}
  function stripFormSuffix(v){return String(v||'').replace(/\d+$/,'');}
  function handleOrderFromFile(v){
    const match = String(v||'').split(/[?#]/)[0].split('/').pop().match(/^(\d+)_/);
    return match ? Number(match[1]) : null;
  }
  function firstNumber(...values){
    for(const value of values){
      const n = Number(value);
      if(Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }
  function sourceKeys(row){
    const sourceId = row?.sourceId || row?.internal?.sourceId || row?.internal?.weaponId || row?.raw?.name;
    const family = row?.family || row?.internal?.family || stripFormSuffix(sourceId);
    return [
      row?.id,
      sourceId,
      family,
      row?.name,
      row?.displayName,
      row?.title,
      row?.raw?.name,
      basename(row?.image),
      basename(row?.raw?.image),
      basename(row?.file),
      basename(row?.path)
    ].map(norm).filter(Boolean);
  }
  function addKeys(set,row){sourceKeys(row).forEach(k=>set.add(k));}
  function hasAnyKey(set,row){return sourceKeys(row).some(k=>set.has(k));}

  async function fetchJson(url, optional=true){
    try{
      const r=await fetch(url,{cache:'default'});
      if(!r.ok){if(optional)return null; throw new Error(`${url}: ${r.status}`);}
      return await r.json();
    }catch(e){if(optional)return null; throw e;}
  }

  async function loadIndex(){
    if(indexPromise) return indexPromise;
    indexPromise = (async()=>{
      const index = await fetchJson(INDEX_URL,true);
      const rows = Array.isArray(index?.entries) ? index.entries : [];
      const byKey = new Map();
      rows.forEach((row, i)=>{
        const fileOrder = handleOrderFromFile(row.file);
        const order = fileOrder || firstNumber(row.fileHandleOrder,row.sourceOrder,row.order,row.visualOrder) || i + 1;
        const enriched = {...row, order, fileHandleOrder:order, sourceOrder:order};
        sourceKeys(enriched).forEach(k=>{ if(k && !byKey.has(k)) byKey.set(k,enriched); });
      });
      return {rows, byKey};
    })();
    return indexPromise;
  }

  function enrichWithIndexOrder(row, indexData){
    let indexRow = null;
    for(const key of sourceKeys(row)){
      indexRow = indexData.byKey.get(key);
      if(indexRow) break;
    }
    const order = handleOrderFromFile(indexRow?.file || row?.file || row?.path)
      || firstNumber(indexRow?.fileHandleOrder,indexRow?.sourceOrder,indexRow?.order,row?.fileHandleOrder,row?.sourceOrder,row?.order)
      || UNKNOWN_ORDER;
    const file = indexRow?.file || row?.file || row?.path || '';
    const sourceId = row.sourceId || row.internal?.sourceId || row.raw?.name || indexRow?.sourceId || basename(row.image) || row.id || row.name;
    return {
      ...row,
      kind:'weapons',
      category:'weapons',
      id: row.id || sourceId,
      sourceId,
      file,
      order,
      fileHandleOrder: order,
      sourceOrder: order,
      internal:{
        ...(row.internal||{}),
        source:'weapon_overlay',
        sourceId,
        weaponId: row.internal?.weaponId || row.raw?.name || indexRow?.sourceId || basename(row.image)
      },
      _weaponOverlay:true
    };
  }

  function overlayRows(payload, indexData){
    const rows = Array.isArray(payload?.weapons) ? payload.weapons : Array.isArray(payload?.entries) ? payload.entries : [];
    return rows.map(row=>enrichWithIndexOrder(row,indexData));
  }

  async function indexedWeaponRows(existingRows, indexData){
    const entries = Array.isArray(indexData?.rows) ? indexData.rows : [];
    if(!entries.length) return [];
    const bySource = new Map();
    for(const row of existingRows||[]){
      sourceKeys(row).forEach(k=>{if(!bySource.has(k))bySource.set(k,row);});
    }
    const loaded=[];
    for(const indexRow of entries){
      const keys=sourceKeys(indexRow);
      let found=keys.map(k=>bySource.get(k)).find(Boolean);
      if(!found && indexRow.file){
        const rel=String(indexRow.file).replace(/^\.\//,'').replace(/^entries\//,'');
        found=await fetchJson(`${ENTRY_BASE}/entries/${rel}`,true) || await fetchJson(`${ENTRY_BASE}/${rel}`,true);
      }
      if(found) loaded.push(enrichWithIndexOrder(found,indexData));
    }
    return loaded;
  }

  async function loadOverlayWeapons(existingRows=[]){
    if(overlayPromise) return overlayPromise.then(fn=>fn(existingRows));
    overlayPromise = (async()=>{
      const [payload,indexData] = await Promise.all([fetchJson(OVERLAY_URL,true), loadIndex()]);
      const base = overlayRows(payload,indexData);
      if(!base.length) return null;
      return async function merge(existing){
        const out=[...base];
        const keys=new Set();
        out.forEach(row=>addKeys(keys,row));
        const indexed=await indexedWeaponRows(existing,indexData);
        for(const row of indexed){
          if(!hasAnyKey(keys,row)){
            out.push({...row,_weaponOverlayAppend:true});
            addKeys(keys,row);
          }
        }
        out.sort((a,b)=>(Number(a.order)||UNKNOWN_ORDER)-(Number(b.order)||UNKNOWN_ORDER));
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
