(function(){
  const MAP_URL='./apkfiles/entries/maps/character_parent_child_map.json';
  let cached=null;
  function idOf(row){return String(row?.id||row?.family||row?.sourceId||'').trim();}
  function add(out,seen,value){const id=String(value||'').trim();if(!id||seen.has(id))return;seen.add(id);out.push(id);}
  function rowAliases(row,map){
    const out=[],seen=new Set(),id=idOf(row);
    add(out,seen,id);add(out,seen,row?.sourceId);add(out,seen,row?.family);
    (Array.isArray(row?.formSourceIds)?row.formSourceIds:[]).forEach(v=>add(out,seen,v));
    (Array.isArray(row?.characterAliases)?row.characterAliases:[]).forEach(v=>add(out,seen,v));
    (Array.isArray(row?.statsByForm)?row.statsByForm:[]).forEach(s=>{add(out,seen,s?.sourceId);add(out,seen,s?.dataSourceId);add(out,seen,s?.imageSourceId);});
    (Array.isArray(row?.imageVariants)?row.imageVariants:[]).forEach(s=>{add(out,seen,s?.sourceId);add(out,seen,s?.dataSourceId);add(out,seen,s?.imageSourceId);});
    (map?.parents?.[id]||[]).forEach(v=>add(out,seen,v));
    return out;
  }
  async function loadMap(){
    if(cached)return cached;
    try{const res=await fetch(MAP_URL,{cache:'default'});cached=res.ok?await res.json():{parents:{},children:{}};}
    catch{cached={parents:{},children:{}};}
    return cached;
  }
  function clean(rows,map){
    const byId=new Map((Array.isArray(rows)?rows:[]).map(row=>[idOf(row),row]));
    const childMap=map?.children||{};
    return (Array.isArray(rows)?rows:[]).filter(row=>{
      const id=idOf(row);
      const parents=Array.isArray(childMap[id])?childMap[id].filter(parent=>byId.has(String(parent))):[];
      return !parents.length;
    }).map(row=>({...row,characterAliases:rowAliases(row,map)}));
  }
  if(window.EvertaleData&&typeof window.EvertaleData.loadCharactersMerged==='function'){
    const base=window.EvertaleData.loadCharactersMerged.bind(window.EvertaleData);
    window.EvertaleData.loadCharactersMerged=async function(){
      const rows=await base();
      return clean(rows,await loadMap());
    };
    window.EvertaleData.cleanPlayableCharacters=clean;
    window.EvertaleData.loadCharacterParentMap=loadMap;
  }
})();
