(function(){
  const mapUrl='./apkfiles/entries/maps/character_parent_child_map.json';
  const forced={
    Aigis:'BeautyBeastRegular',
    SnowBlackBride:'SnowWhiteBride'
  };
  let cached=null;
  function idOf(row){return String(row?.id||row?.family||row?.sourceId||'').trim();}
  function add(map,key,id){key=String(key||'').trim();id=String(id||'').trim();if(key&&id&&!map.has(key))map.set(key,id);}
  function addList(out,seen,value){const id=String(value||'').trim();if(id&&!seen.has(id)){seen.add(id);out.push(id);}}
  function addForcedParents(map){
    map=map&&typeof map==='object'?map:{parents:{},children:{}};
    map.parents=map.parents&&typeof map.parents==='object'?map.parents:{};
    map.children=map.children&&typeof map.children==='object'?map.children:{};
    for(const [child,parent] of Object.entries(forced)){
      map.parents[parent]=Array.from(new Set([...(Array.isArray(map.parents[parent])?map.parents[parent]:[]),child]));
      map.children[child]=[parent];
    }
    return map;
  }
  async function loadMap(){
    if(cached)return cached;
    try{const res=await fetch(mapUrl,{cache:'default'});cached=addForcedParents(res.ok?await res.json():null);}
    catch{cached=addForcedParents(null);}
    return cached;
  }
  function aliases(row,map){
    const out=[],seen=new Set(),id=idOf(row);
    addList(out,seen,id);addList(out,seen,row?.sourceId);addList(out,seen,row?.family);
    (Array.isArray(row?.characterAliases)?row.characterAliases:[]).forEach(v=>addList(out,seen,v));
    (Array.isArray(row?.formSourceIds)?row.formSourceIds:[]).forEach(v=>addList(out,seen,v));
    (Array.isArray(row?.statsByForm)?row.statsByForm:[]).forEach(s=>{addList(out,seen,s?.sourceId);addList(out,seen,s?.dataSourceId);addList(out,seen,s?.imageSourceId);});
    (Array.isArray(row?.imageVariants)?row.imageVariants:[]).forEach(s=>{addList(out,seen,s?.sourceId);addList(out,seen,s?.dataSourceId);addList(out,seen,s?.imageSourceId);});
    (Array.isArray(map?.parents?.[id])?map.parents[id]:[]).forEach(v=>addList(out,seen,v));
    return out;
  }
  function clean(rows,map){
    const list=Array.isArray(rows)?rows:[];
    const byId=new Set(list.map(idOf).filter(Boolean));
    const forcedParents=new Set(Object.values(forced));
    const childMap=map?.children||{};
    return list.filter(row=>{
      const id=idOf(row);
      if(forcedParents.has(id))return true;
      if(forced[id])return !byId.has(forced[id]);
      const parents=Array.isArray(childMap[id])?childMap[id]:[];
      return !parents.some(parent=>byId.has(String(parent)));
    }).map(row=>({...row,characterAliases:aliases(row,map)}));
  }
  function patchData(data){
    if(!data||typeof data.loadCharactersMerged!=='function')return false;
    if(data.__rosterParentFilterV3)return true;
    data.__rosterParentFilterV3=true;
    const base=data.loadCharactersMerged.bind(data);
    data.loadCharactersMerged=async function(){return clean(await base(),await loadMap());};
    data.cleanPlayableCharacters=clean;
    data.loadCharacterParentMap=loadMap;
    return true;
  }
  function installSetter(){
    if(window.EvertaleData){patchData(window.EvertaleData);return;}
    let current;
    try{
      Object.defineProperty(window,'EvertaleData',{configurable:true,get(){return current;},set(value){current=value;patchData(current);}});
    }catch{wait();}
  }
  function wait(){if(!patchData(window.EvertaleData))setTimeout(wait,30);}
  installSetter();
  window.EvertaleRosterParentFilter={clean,loadMap,forced};
})();
