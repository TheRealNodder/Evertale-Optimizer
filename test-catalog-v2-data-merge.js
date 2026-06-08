/* test-catalog-v2-data-merge.js — strict pre-render parent/child merge for Test Catalog V2. */
(function(){
  const DUO_URL='./apkfiles/Duo.json';
  const DISPLAY_URL='./apkfiles/DuoDisplay.json';
  let configPromise=null;

  function text(value){return String(value||'').trim();}
  function strip(value){return text(value).replace(/\d+$/,'');}
  function key(value){return strip(value).toLowerCase();}
  function rowFamily(row){return text(row&&row.family)||strip(row&&row.sourceId)||strip(row&&row.id)||strip(row&&row.name);}
  function rowKey(row){return key(rowFamily(row));}
  function rowName(row){return text(row&&row.name)||text(row&&row.displayName)||text(row&&row.title)||rowFamily(row);}
  function uniq(list){return Array.from(new Set((list||[]).filter(Boolean)));}

  async function json(url){
    try{
      const response=await fetch(url,{cache:'no-store'});
      return response.ok?await response.json():{};
    }catch(_){
      return {};
    }
  }

  function addLink(parent, child, parentForChild, preferredParents){
    const p=key(parent);
    const c=key(child);
    if(!p||!c||p===c)return;
    preferredParents.add(p);
    parentForChild.set(c,p);
  }

  async function loadConfig(){
    if(configPromise)return configPromise;
    configPromise=Promise.all([json(DUO_URL),json(DISPLAY_URL)]).then(([duo,display])=>{
      const parentForChild=new Map();
      const preferredParents=new Set();
      const direct=duo&&duo.directSpecificLinks&&typeof duo.directSpecificLinks==='object'?duo.directSpecificLinks:{};
      Object.entries(direct).forEach(([parent,children])=>{
        if(Array.isArray(children))children.forEach(child=>addLink(parent,child,parentForChild,preferredParents));
      });
      const parentCards=display&&display.parentCards&&typeof display.parentCards==='object'?display.parentCards:{};
      Object.entries(parentCards).forEach(([parent,cfg])=>{
        const children=Array.isArray(cfg&&cfg.children)?cfg.children:[];
        children.forEach(child=>addLink(parent,child,parentForChild,preferredParents));
      });
      return {parentForChild,preferredParents};
    });
    return configPromise;
  }

  function resolveRoot(familyKey,parentForChild){
    let current=familyKey;
    const seen=new Set();
    while(parentForChild.has(current)&&!seen.has(current)){
      seen.add(current);
      current=parentForChild.get(current);
    }
    return current;
  }

  function chooseParent(rows,rootKey,preferredParents){
    const scored=rows.map(row=>{
      const rk=rowKey(row);
      let score=0;
      if(rk===rootKey)score+=10000;
      if(preferredParents.has(rk))score+=5000;
      const all=(rowFamily(row)+' '+rowName(row)+' '+text(row&&row.title)).toLowerCase();
      if(all.includes('ludmillaballet')||all.includes('red dragon dancer'))score+=1200;
      if(all.includes('yanderemaidballet')||all.includes('clarice'))score-=200;
      if(all.includes('beautybeastregular')||all.includes('beauty & beast'))score+=1000;
      return {row,score};
    });
    scored.sort((a,b)=>b.score-a.score);
    return scored[0]&&scored[0].row?scored[0].row:rows[0];
  }

  function mergeCharacterGroup(rows,rootKey,preferredParents){
    const parent=chooseParent(rows,rootKey,preferredParents);
    const children=rows.filter(row=>row!==parent);
    if(!children.length)return parent;
    const merged=Object.assign({},parent);
    const parentVariants=Array.isArray(parent.imageVariants)?parent.imageVariants:[];
    const childVariants=children.flatMap(row=>Array.isArray(row.imageVariants)?row.imageVariants:[]);
    const parentImages=Array.isArray(parent.imagesLarge)?parent.imagesLarge:[];
    const childImages=children.flatMap(row=>Array.isArray(row.imagesLarge)?row.imagesLarge:[]);
    const parentForms=Array.isArray(parent.forms)?parent.forms:[];
    const childForms=children.flatMap(row=>Array.isArray(row.forms)?row.forms:[]);
    merged.imageVariants=uniq([...parentVariants,...childVariants]);
    merged.imagesLarge=uniq([...parentImages,...childImages]);
    merged.forms=[...parentForms,...childForms];
    merged.v2MergedChildren=children.map(row=>({family:rowFamily(row),name:rowName(row),title:text(row&&row.title)}));
    merged.v2MergedNames=uniq([rowName(parent),...children.map(rowName)]);
    return merged;
  }

  function mergeCharacters(characters,config){
    const parentForChild=config.parentForChild;
    const preferredParents=config.preferredParents;
    const groups=new Map();
    const passthrough=[];
    for(const row of characters||[]){
      const k=rowKey(row);
      const root=resolveRoot(k,parentForChild);
      if(root!==k||preferredParents.has(k)){
        if(!groups.has(root))groups.set(root,[]);
        groups.get(root).push(row);
      }else{
        passthrough.push(row);
      }
    }
    const merged=[];
    groups.forEach((rows,root)=>merged.push(mergeCharacterGroup(rows,root,preferredParents)));
    return [...merged,...passthrough];
  }

  function install(){
    if(!window.EvertaleData||!window.EvertaleData.loadAllEntries||window.EvertaleData.__v2StrictMergeInstalled)return false;
    const original=window.EvertaleData.loadAllEntries.bind(window.EvertaleData);
    window.EvertaleData.loadAllEntries=async function(){
      const data=await original();
      const config=await loadConfig();
      const characters=mergeCharacters(data&&data.characters?data.characters:[],config);
      window.__EVERTALE_V2_MERGE_REPORT={before:data&&data.characters?data.characters.length:0,after:characters.length,removed:(data&&data.characters?data.characters.length:0)-characters.length};
      return Object.assign({},data,{characters});
    };
    window.EvertaleData.__v2StrictMergeInstalled=true;
    return true;
  }

  if(!install()){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }
})();
