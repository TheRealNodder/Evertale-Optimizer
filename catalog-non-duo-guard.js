/* catalog-non-duo-guard.js
   Prevent state-only characters from being treated as duo/form-switch units.

   JeanneFusion has 5★ / 6★ / FA image states, but no summon active skill.
   It must keep awaken state buttons only and must not receive duoForms or a
   duoFormBtn from parent/child fallback maps.
*/
(function(){
  const NON_DUO_FAMILIES=new Set(['jeannefusion']);
  const clean=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'').replace(/\d+$/,'');
  const isNonDuoKey=v=>NON_DUO_FAMILIES.has(clean(v));
  const isNonDuoCard=card=>!!card&&[
    card.dataset?.family,
    card.dataset?.sourceId,
    card.dataset?.id,
    card.getAttribute?.('data-family'),
    card.getAttribute?.('data-source-id'),
    card.getAttribute?.('data-id')
  ].some(isNonDuoKey);

  function stripCard(card){
    if(!isNonDuoCard(card))return;
    card.removeAttribute('data-duo-index');
    card.removeAttribute('data-duo-forms');
    card.querySelectorAll('.duoFormBtn,[data-duo-forms]').forEach(el=>el.remove());
  }

  function stripAll(root=document){
    root.querySelectorAll?.('#catalogGrid .unitCard,.unitCard').forEach(stripCard);
  }

  function installFetchGuard(){
    if(window.__EVERTALE_NON_DUO_FETCH_GUARD)return;
    const originalFetch=window.fetch?.bind(window);
    if(!originalFetch)return;
    window.fetch=async function(input,init){
      const response=await originalFetch(input,init);
      const url=String(typeof input==='string'?input:input?.url||'');
      const target=url.includes('character_parent_child_map.json')||url.includes('/Duo.json')||url.includes('/DuoDisplay.json');
      if(!target||!response.ok)return response;
      try{
        const clone=response.clone();
        const data=await clone.json();
        pruneData(data);
        return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers:response.headers});
      }catch{return response;}
    };
    window.__EVERTALE_NON_DUO_FETCH_GUARD=true;
  }

  function pruneData(data){
    if(!data||typeof data!=='object')return data;
    if(data.aliases&&typeof data.aliases==='object'){
      for(const [key,value] of Object.entries({...data.aliases})){
        if(isNonDuoKey(key)||isNonDuoKey(value))delete data.aliases[key];
      }
    }
    if(data.parents&&typeof data.parents==='object'){
      for(const [parent,children] of Object.entries({...data.parents})){
        if(isNonDuoKey(parent)){delete data.parents[parent];continue;}
        if(Array.isArray(children))data.parents[parent]=children.filter(child=>!isNonDuoKey(child));
        if(Array.isArray(data.parents[parent])&&!data.parents[parent].length)delete data.parents[parent];
      }
    }
    if(data.children&&typeof data.children==='object'){
      for(const [child,parents] of Object.entries({...data.children})){
        if(isNonDuoKey(child)){delete data.children[child];continue;}
        if(Array.isArray(parents))data.children[child]=parents.filter(parent=>!isNonDuoKey(parent));
        if(Array.isArray(data.children[child])&&!data.children[child].length)delete data.children[child];
      }
    }
    if(Array.isArray(data.groups)){
      data.groups=data.groups.filter(group=>![group?.parent,...(Array.isArray(group?.children)?group.children:[]),...(Array.isArray(group?.members)?group.members:[])].some(isNonDuoKey));
    }
    if(data.parentCards&&typeof data.parentCards==='object'){
      for(const [parent,cfg] of Object.entries({...data.parentCards})){
        if(isNonDuoKey(parent)){delete data.parentCards[parent];continue;}
        if(cfg&&Array.isArray(cfg.children))cfg.children=cfg.children.filter(child=>!isNonDuoKey(child));
      }
    }
    for(const value of Object.values(data)){
      if(value&&typeof value==='object')pruneData(value);
    }
    return data;
  }

  installFetchGuard();
  document.addEventListener('DOMContentLoaded',()=>{
    stripAll();
    const grid=document.getElementById('catalogGrid');
    if(grid&&'MutationObserver'in window){
      const obs=new MutationObserver(mutations=>{
        for(const mutation of mutations){
          mutation.addedNodes.forEach(node=>{
            if(node.nodeType!==1)return;
            if(node.classList?.contains('unitCard'))stripCard(node);
            stripAll(node);
          });
        }
      });
      obs.observe(grid,{childList:true,subtree:true});
      window.__EVERTALE_NON_DUO_GUARD_OBSERVER=obs;
    }
  });
  document.addEventListener('v2:card-selected',event=>stripCard(event.detail?.card));
  window.__EVERTALE_NON_DUO_GUARD={families:[...NON_DUO_FAMILIES]};
})();
