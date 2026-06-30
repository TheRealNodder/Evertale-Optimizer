(function(){
  const ownedKey='evertale_owned_units_v1';
  const legacyKey='evertale_owned';
  function idOf(row){return String(row?.id||row?.family||row?.sourceId||'').trim();}
  function add(map,key,id){key=String(key||'').trim();id=String(id||'').trim();if(key&&id&&!map.has(key))map.set(key,id);}
  function buildAliasMap(){
    const rows=window.__evertaleRosterState&&Array.isArray(window.__evertaleRosterState.units)?window.__evertaleRosterState.units:[];
    const map=new Map();
    for(const row of rows){
      const id=idOf(row);
      add(map,id,id);add(map,row?.sourceId,id);add(map,row?.family,id);
      (Array.isArray(row?.characterAliases)?row.characterAliases:[]).forEach(v=>add(map,v,id));
      (Array.isArray(row?.formSourceIds)?row.formSourceIds:[]).forEach(v=>add(map,v,id));
      (Array.isArray(row?.statsByForm)?row.statsByForm:[]).forEach(s=>{add(map,s?.sourceId,id);add(map,s?.dataSourceId,id);add(map,s?.imageSourceId,id);});
      (Array.isArray(row?.imageVariants)?row.imageVariants:[]).forEach(s=>{add(map,s?.sourceId,id);add(map,s?.dataSourceId,id);add(map,s?.imageSourceId,id);});
    }
    return map;
  }
  function syncFromBackup(text){
    let parsed=null;
    try{parsed=JSON.parse(String(text||''));}catch{return 0;}
    const profiles=parsed&&typeof parsed.profiles==='object'?parsed.profiles:null;
    if(!profiles)return 0;
    const aliases=buildAliasMap();
    const owned=[];
    const seen=new Set();
    for(const key of Object.keys(profiles)){
      const id=aliases.get(key)||key;
      if(!id||seen.has(id))continue;
      seen.add(id);owned.push(id);
    }
    if(!owned.length)return 0;
    localStorage.setItem(ownedKey,JSON.stringify(owned));
    localStorage.setItem(legacyKey,JSON.stringify(owned));
    return owned.length;
  }
  function bind(){
    const input=document.getElementById('rosterImportProfilesFile');
    if(!input||input.dataset.ownedSyncBound)return;
    input.dataset.ownedSyncBound='1';
    input.addEventListener('change',event=>{
      const file=event.target.files&&event.target.files[0];
      if(!file)return;
      const reader=new FileReader();
      reader.onload=()=>syncFromBackup(reader.result||'');
      reader.readAsText(file);
    },true);
  }
  function wait(){bind();setTimeout(bind,250);setTimeout(bind,900);}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',wait,{once:true}):wait();
})();
