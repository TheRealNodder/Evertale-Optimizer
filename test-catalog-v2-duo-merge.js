/* test-catalog-v2-duo-merge.js — V2-only parent/child card merge pass. */
(function(){
  const DUO_URL='./apkfiles/Duo.json';
  const DISPLAY_URL='./apkfiles/DuoDisplay.json';
  let mapsPromise=null;
  let timer=null;

  function text(v){return String(v||'').trim();}
  function compact(v){return text(v).toLowerCase().replace(/[^a-z0-9]+/g,'');}
  function strip(v){return text(v).replace(/\d+$/,'');}
  function key(v){return compact(strip(v));}
  function cardName(card){return text(card?.querySelector('.unitName')?.textContent);}
  function cardTitle(card){return text(card?.querySelector('.unitTitle')?.textContent);}
  function cardKeys(card){
    const vals=[
      card?.getAttribute('data-id'),
      card?.getAttribute('data-source-id'),
      card?.getAttribute('data-family'),
      cardName(card),
      cardTitle(card)
    ].filter(Boolean);
    const out=[];
    vals.forEach(v=>{
      out.push(key(v));
      out.push(compact(v));
    });
    return Array.from(new Set(out.filter(Boolean)));
  }
  function payload(card){
    return {
      html:card.innerHTML,
      className:card.className,
      kind:card.getAttribute('data-kind')||'',
      id:card.getAttribute('data-id')||'',
      sourceId:card.getAttribute('data-source-id')||'',
      family:card.getAttribute('data-family')||'',
      name:cardName(card),
      title:cardTitle(card),
      active:card.getAttribute('data-active-skills')||'',
      passive:card.getAttribute('data-passive-skills')||''
    };
  }
  function addLink(parent,child,parentForChild,parentKeys){
    const p=key(parent), c=key(child);
    if(!p||!c||p===c)return;
    parentKeys.add(p);
    parentForChild.set(c,p);
  }
  function rootOf(k,parentForChild){
    let current=k;
    const seen=new Set();
    while(parentForChild.has(current)&&!seen.has(current)){
      seen.add(current);
      current=parentForChild.get(current);
    }
    return current;
  }
  async function loadMaps(){
    if(mapsPromise)return mapsPromise;
    mapsPromise=Promise.all([
      fetch(DUO_URL,{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({})),
      fetch(DISPLAY_URL,{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
    ]).then(([duo,display])=>{
      const parentForChild=new Map();
      const parentKeys=new Set();
      const direct=duo&&duo.directSpecificLinks&&typeof duo.directSpecificLinks==='object'?duo.directSpecificLinks:{};
      Object.entries(direct).forEach(([parent,children])=>{
        if(Array.isArray(children))children.forEach(child=>addLink(parent,child,parentForChild,parentKeys));
      });
      const parentCards=display&&display.parentCards&&typeof display.parentCards==='object'?display.parentCards:{};
      Object.entries(parentCards).forEach(([parent,cfg])=>{
        const children=Array.isArray(cfg&&cfg.children)?cfg.children:[];
        children.forEach(child=>addLink(parent,child,parentForChild,parentKeys));
      });
      return {parentForChild,parentKeys};
    });
    return mapsPromise;
  }
  function findGroup(card,maps){
    const keys=cardKeys(card);
    for(const k of keys){
      if(maps.parentKeys.has(k))return {root:k,isParent:true};
      if(maps.parentForChild.has(k))return {root:rootOf(k,maps.parentForChild),isParent:false};
    }
    return null;
  }
  function shortName(v){
    return text(v).replace(/\s*[-–—].*$/,'').replace(/\s+/g,' ');
  }
  function labelFor(payloads){
    const names=Array.from(new Set(payloads.map(p=>shortName(p.name)).filter(Boolean)));
    if(names.length>1)return names.slice(0,2).join(' / ');
    return names[0]||'Forms';
  }
  function hideChild(card){
    card.hidden=true;
    card.setAttribute('hidden','');
    card.setAttribute('aria-hidden','true');
    card.setAttribute('data-duo-hidden-child','true');
    card.classList.add('hidden','v2-duo-hidden-child');
    card.style.setProperty('display','none','important');
  }
  function showParent(card){
    card.hidden=false;
    card.removeAttribute('hidden');
    card.removeAttribute('aria-hidden');
    card.removeAttribute('data-duo-hidden-child');
    card.classList.remove('hidden','v2-duo-hidden-child');
    card.style.removeProperty('display');
  }
  function applyPayload(card,p,index,payloads){
    card.innerHTML=p.html;
    card.className=p.className;
    card.setAttribute('data-kind',p.kind);
    card.setAttribute('data-id',p.id);
    card.setAttribute('data-source-id',p.sourceId);
    card.setAttribute('data-family',p.family);
    if(p.active)card.setAttribute('data-active-skills',p.active);
    if(p.passive)card.setAttribute('data-passive-skills',p.passive);
    card.setAttribute('data-duo-parent','true');
    card.setAttribute('data-duo-index',String(index));
    showParent(card);
    installButton(card,payloads);
  }
  function installButton(parent,payloads){
    if(!parent||!payloads||payloads.length<2)return;
    parent.querySelector('.duoFormBtn')?.remove();
    const host=parent.querySelector('.metaMain')||parent.querySelector('.metaHeader')||parent.querySelector('.meta')||parent;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='duoFormBtn';
    const current=Number(parent.getAttribute('data-duo-index')||0);
    const base=labelFor(payloads);
    btn.textContent=`${base} ${current+1}/${payloads.length}`;
    btn.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      const next=(Number(parent.getAttribute('data-duo-index')||0)+1)%payloads.length;
      applyPayload(parent,payloads[next],next,payloads);
    });
    host.appendChild(btn);
  }
  async function merge(){
    const grid=document.getElementById('catalogGrid');
    if(!grid)return;
    const maps=await loadMaps();
    const cards=Array.from(grid.querySelectorAll('.unitCard[data-kind="characters"]'));
    if(!cards.length)return;

    const groups=new Map();
    cards.forEach(card=>{
      const info=findGroup(card,maps);
      if(!info)return;
      if(!groups.has(info.root))groups.set(info.root,{root:info.root,parent:null,children:[],payloads:[]});
      const group=groups.get(info.root);
      if(info.isParent&&!group.parent)group.parent=card;
      else group.children.push(card);
      group.payloads.push(payload(card));
    });

    groups.forEach(group=>{
      const allCards=[group.parent,...group.children].filter(Boolean);
      if(allCards.length<2)return;
      const parent=group.parent||allCards[0];
      const payloads=[];
      const seen=new Set();
      [parent,...allCards.filter(c=>c!==parent)].forEach(card=>{
        const p=payload(card);
        const id=compact(p.id||p.sourceId||p.family||p.name);
        if(seen.has(id))return;
        seen.add(id);
        payloads.push(p);
      });
      allCards.forEach(card=>{
        if(card===parent)return;
        hideChild(card);
      });
      showParent(parent);
      parent.setAttribute('data-duo-parent','true');
      parent.setAttribute('data-duo-index',parent.getAttribute('data-duo-index')||'0');
      installButton(parent,payloads);
    });
    window.__EVERTALE_V2_DUO_MERGE_REPORT={groups:groups.size,hidden:grid.querySelectorAll('[data-duo-hidden-child="true"]').length,parents:grid.querySelectorAll('[data-duo-parent="true"]').length};
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>merge().catch(console.warn),120);}
  document.addEventListener('DOMContentLoaded',()=>{
    schedule();
    const grid=document.getElementById('catalogGrid');
    if(grid)new MutationObserver(schedule).observe(grid,{childList:true,subtree:false});
    ['catalogSearch','catalogType','catalogSort'].forEach(id=>document.getElementById(id)?.addEventListener('input',schedule));
    ['catalogType','catalogSort'].forEach(id=>document.getElementById(id)?.addEventListener('change',schedule));
  });
})();