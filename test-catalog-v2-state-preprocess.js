/* test-catalog-v2-state-preprocess.js — V2-only data normalization before catalog-v2-lite renders. */
(function(){
  function normalizeKey(value){
    return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
  }

  function patchEntries(entries){
    if(!entries || !Array.isArray(entries.characters)) return entries;
    const byPlayableId = new Map();
    for(const entry of entries.characters){
      const id = normalizeKey(entry && entry.id);
      if(!id) continue;
      if(!byPlayableId.has(id)) byPlayableId.set(id, []);
      byPlayableId.get(id).push(entry);
    }

    let patched = 0;
    for(const [id, rows] of byPlayableId.entries()){
      if(rows.length < 2) continue;
      for(const row of rows){
        row._v2OriginalFamily = row.family || row.internal?.family || row.raw?.family || null;
        row._v2PlayableStateGroup = id;
        row.family = row.id;
        patched += 1;
      }
    }

    window.__EVERTALE_V2_STATE_PREPROCESS_REPORT = {
      duplicatePlayableGroups: [...byPlayableId.values()].filter(rows => rows.length > 1).length,
      patchedRows: patched
    };
    return entries;
  }

  function install(){
    const loader = window.EvertaleData;
    if(!loader || typeof loader.loadAllEntries !== 'function') return false;
    if(loader.__v2StatePreprocessInstalled) return true;
    const original = loader.loadAllEntries.bind(loader);
    loader.loadAllEntries = async function(){
      const entries = await original();
      return patchEntries(entries);
    };
    loader.__v2StatePreprocessInstalled = true;
    return true;
  }

  if(!install()){
    document.addEventListener('DOMContentLoaded', install, {once:true});
  }
})();
