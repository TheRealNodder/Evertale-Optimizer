/* test-catalog-v2-duo-merge.js — V2-only parent/child card merge pass. */
(function(){
  const DUO_URL='./apkfiles/Duo.json';
  const DISPLAY_URL='./apkfiles/DuoDisplay.json';
  let mapsPromise=null;
  let timer=null;

  function text(v){return String(v||'').trim();}
  function key(v){return text(v).toLowerCase();}
  function family(v){return text(v).replace(/\d+$/,'');}
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
    vals.forEach(v=>{out.push(text(v));out.push(family(v));out.push(key(v));out.push(key(family(v)));});
    return Array.from(new Set(out.filter(Boolean)));
  }
  function root(parent, child, roots){
    parent=family(parent); child=family(child);
    if(!parent||!child)return;
    if(!roots.has(parent))roots.set(parent,parent);
    roots.set(child,parent);
  }
  function rootOf(id, roots){
    let r=family(id);
    let seen=0;
    while(roots.has(r)&&roots.get(r)!==r&&seen++<12)r=roots.get(r);
    return r;
  }
  async function loadMaps(){
    if(mapsPromise)return mapsPromise;
    mapsPromise=Promise.all([
      fetch(DUO_URL,{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({})),
      fetch(DISPLAY_URL,{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))
    ]).then(([duo,display])=>{
      const roots=new Map();
      const parentPreferred=new Set();
      const direct=duo&&duo.directSpecificLinks&&typeof duo.directSpecificLinks==='object'?duo.directSpecificLinks:{};
      Object.entries(direct).forEach(([p,children])=>{
        if(!Array.isArray(children))return;
        parentPreferred.add(family(p));
        children.forEach(c=>root(p,c,roots));
      });
      const pc=display&&display.parentCards&&typeof display.parentCards==='object'?display.parentCards:{};
      Object.entries(pc).forEach(([p,cfg])=>{
        const children=Array.isArray(cfg&&cfg.children)?cfg.children:[];
        parentPreferred.add(family(p));
        children.forEach(c=>root(p,c,roots));
      });
      return {roots,parentPreferred};
    });
    return mapsPromise;
  }
  function parentScore(card, maps){
    const ids=cardKeys(card).map(family);
    let score=0;
    ids.forEach(id=>{if(maps.parentPreferred.has(id))score+=1000;});
    const all=(cardName(card)+' '+cardTitle(card)+' '+ids.join(' ')).toLowerCase();
    if(all.includes('ludmillaballet')||all.includes('red dragon dancer'))score+=800;
    if(all.includes('yanderemaidballet')||all.includes('clarice'))score+=100;
    if(all.includes('beautybeastregular')||all.includes('beauty & beast'))score+=600;
    return score;
  }
  function addParentButton(parent, cards){
    if(parent.querySelector('.duoFormBtn'))return;
    const names=Array.from(new Set(cards.map(cardName).filter(Boolean)));
    const label=names.length>1?names.slice(0,2).join(' / '):(names[0]||'Forms');
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='duoFormBtn';
    btn.textContent=label;
    const host=parent.querySelector('.metaMain')||parent.querySelector('.metaHeader')||parent.querySelector('.meta')||parent;
    host.appendChild(btn);
  }
  async function merge(){
    const grid=document.getElementById('catalogGrid');
    if(!grid)return;
    const maps=await loadMaps();
    const cards=Array.from(grid.querySelectorAll('.unitCard[data-kind="characters"]'));
    if(!cards.length)return;
    cards.forEach(c=>{c.hidden=false;c.style.display='';c.removeAttribute('data-duo-hidden-child');});
    const groups=new Map();
    cards.forEach(card=>{
      const keys=cardKeys(card);
      let rootKey='';
      for(const k of keys){
        const r=rootOf(k,maps.roots);
        if(r&&maps.roots.has(r)){rootKey=r;break;}
      }
      if(!rootKey)return;
      if(!groups.has(rootKey))groups.set(rootKey,[]);
      groups.get(rootKey).push(card);
    });
    groups.forEach(groupCards=>{
      const unique=Array.from(new Set(groupCards));
      if(unique.length<2)return;
      const parent=unique.slice().sort((a,b)=>parentScore(b,maps)-parentScore(a,maps))[0];
      unique.forEach(card=>{
        if(card===parent)return;
        card.hidden=true;
        card.style.display='none';
        card.setAttribute('data-duo-hidden-child','true');
      });
      parent.setAttribute('data-duo-parent','true');
      addParentButton(parent,unique);
    });
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
