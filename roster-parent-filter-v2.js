(function(){
  const mapUrl='./apkfiles/entries/maps/character_parent_child_map.json';
  let cached=null;
  function idOf(row){return String(row?.id||row?.family||row?.sourceId||'').trim();}
  function add(out,seen,value){const id=String(value||'').trim();if(id&&!seen.has(id)){seen.add(id);out.push(id);}}
  function aliases(row,map){
    const out=[],seen=new Set(),id=idOf(row);
    add(out,seen,id);add(out,seen,row?.sourceId);add(out,seen,row?.family);
    (Array.isArray(row?.formSourceIds)?row.formSourceIds:[]).forEach(v=>add(out,seen,v));
    (Array.isArray(row?.statsByForm)?row.statsByForm:[]).forEach(s=>{add(out,seen,s?.sourceId);add(out,seen,s?.dataSourceId);add(out,seen,s?.imageSourceId);});
    (Array.isArray(row?.imageVariants)?row.imageVariants:[]).forEach(s=>{add(out,seen,s?.sourceId);add(out,seen,s?.dataSourceId);add(out,seen,s?.imageSourceId);});
    (map?.parents?.[id]||[]).forEach(v=>add(out,seen,v));
    return out;
  }
  async function loadMap(){
    if(cached)return cached;
    try{const res=await fetch(mapUrl,{cache:'default'});cached=res.ok?await res.json():{parents:{},children:{}};}
    catch{cached={parents:{},children:{}};}
    return cached;
  }
  function clean(rows,map){
    const list=Array.isArray(rows)?rows:[];
    const byId=new Set(list.map(idOf).filter(Boolean));
    const childMap=map?.children||{};
    return list.filter(row=>{
      const id=idOf(row);
      const parents=Array.isArray(childMap[id])?childMap[id]:[];
      return !parents.some(parent=>byId.has(String(parent)));
    }).map(row=>({...row,characterAliases:aliases(row,map)}));
  }
  function patch(){
    const data=window.EvertaleData;
    if(!data||typeof data.loadCharactersMerged!=='function')return false;
    if(data.__rosterParentFilter)return true;
    data.__rosterParentFilter=true;
    const base=data.loadCharactersMerged.bind(data);
    data.loadCharactersMerged=async function(){return clean(await base(),await loadMap());};
    data.cleanPlayableCharacters=clean;
    data.loadCharacterParentMap=loadMap;
    return true;
  }
  function wait(){if(!patch())setTimeout(wait,40);}
  wait();
})();
