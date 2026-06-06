/* catalog-sort.js — stable display-only sorter.
   Safe with lazy batch rendering: sort is scheduled, not run recursively per DOM mutation.
*/
(function(){
  const SORT_KEY = 'evertale_catalog_sort_v6';
  const DEFAULT_SORT = 'newest';
  const KIND_RANK = { characters: 0, weapons: 1, accessories: 2, bosses: 3 };
  const INDEX_FILES = {
    characters: './apkfiles/entries/characters/index.json',
    weapons: './apkfiles/entries/weapons/index.json',
    accessories: './apkfiles/entries/accessories/index.json',
    bosses: './apkfiles/entries/bosses/index.json',
  };
  let orderMaps = { characters: new Map(), weapons: new Map(), accessories: new Map(), bosses: new Map() };
  let sorting = false;
  let scheduled = false;
  let lastSignature = '';

  function $(id){ return document.getElementById(id); }
  function norm(value){ return String(value || '').toLowerCase().replace(/[\u2019']/g, '').replace(/[^a-z0-9]+/g, ''); }
  function stripHandle(value){ return String(value || '').split('/').pop().replace(/\.json$/i,'').replace(/^\d+_/,''); }
  function family(value){ return String(value || '').replace(/\d+$/, ''); }
  function title(card){ return (card.querySelector('.unitName')?.textContent || '').trim(); }
  function subtitle(card){ return (card.querySelector('.unitTitle')?.textContent || '').trim(); }
  function kind(card){ return card.getAttribute('data-kind') || ''; }
  function id(card){ return card.getAttribute('data-id') || ''; }
  function kindRank(card){ return KIND_RANK[kind(card)] ?? 99; }
  function originalIndex(card){ return Number(card.getAttribute('data-sort-original') || '0'); }
  function sortName(card){ return title(card).trim().toLowerCase(); }
  function numericValue(value){ const n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; }
  function handleFromFile(file){ const m = String(file || '').split('/').pop().match(/^(\d+)_/); return m ? numericValue(m[1]) : null; }
  function unique(values){ const out=[]; const seen=new Set(); values.forEach(v => { const s=String(v || '').trim(); const n=norm(s); if(s && n && !seen.has(n)){ seen.add(n); out.push(s); } }); return out; }
  function suffixVariants(value){ const raw=String(value||'').trim(); if(!raw)return[]; return /01$/i.test(raw)?[raw,raw.replace(/01$/i,'')]:[raw,raw+'01']; }
  function bossVariants(value){ const raw=String(value||'').trim(); if(!raw)return[]; const vals=[raw]; const m=raw.match(/^(.*Boss)(\d{2})$/i); if(m)vals.push(m[1]); else if(/Boss$/i.test(raw))['01','02','03','04','05'].forEach(s=>vals.push(raw+s)); return vals; }
  function greatAxeVariants(value){ const raw=String(value||'').trim(); if(!raw)return[]; return [raw, raw.replace('Greataxe','GreatAxe'), raw.replace('GreatAxe','Greataxe'), raw.replace('Greatsword','GreatSword'), raw.replace('GreatSword','Greatsword')]; }
  function addKey(map,key,order){ const n=norm(key); if(n&&order&&!map.has(n))map.set(n,order); }
  function addAliases(map,value,order){ if(!value||!order)return; const raw=String(value||''); const stem=stripHandle(raw); const baseRaw=family(raw); const baseStem=family(stem); let values=[raw,stem,baseRaw,baseStem]; [raw,stem,baseRaw,baseStem].forEach(v=>{ values=values.concat(suffixVariants(v),bossVariants(v),greatAxeVariants(v)); }); values.forEach(v=>addKey(map,v,order)); }
  function addIndexRow(map,row){ const order=handleFromFile(row.file)||numericValue(row.fileHandleOrder)||numericValue(row.sourceOrder)||numericValue(row.order)||numericValue(row.visualOrder); if(!order)return; [row.sourceId,row.family,row.key,row.name,row.displayName,row.title,row.sortName,row.file].forEach(v=>addAliases(map,v,order)); }
  async function fetchJson(url){ const res=await fetch(url,{cache:'no-store'}); if(!res.ok)throw new Error(`${url}: ${res.status}`); return await res.json(); }
  async function loadIndexOrder(kindKey){ const map=new Map(); try{ const json=await fetchJson(INDEX_FILES[kindKey]); const rows=Array.isArray(json?.entries)?json.entries:[]; rows.forEach(row=>addIndexRow(map,row)); }catch(err){ console.warn(`[CatalogSort] Index order unavailable for ${kindKey}`,err); } return map; }
  async function loadAllOrders(){ const pairs=await Promise.all(['characters','weapons','accessories','bosses'].map(async k=>[k,await loadIndexOrder(k)])); pairs.forEach(([k,map])=>{orderMaps[k]=map;}); }
  function cardNativeOrder(card){
    // Weapons are chronologically ordered by their file-handle prefix:
    // 0001_* is oldest, larger prefixes are newer.  Prefer that prefix over
    // any generated order/sourceOrder so stale maps cannot reshuffle weapons.
    if(kind(card)==='weapons'){
      const handle = handleFromFile(card.getAttribute('data-file') || id(card));
      if(handle)return handle;
    }
    return numericValue(card.getAttribute('data-file-handle-order'))||numericValue(card.getAttribute('data-source-order'))||numericValue(card.getAttribute('data-order'));
  }
  function cardAliasKeys(card){ let values=[id(card),stripHandle(id(card)),family(id(card)),family(stripHandle(id(card))),title(card),subtitle(card),`${title(card)} ${subtitle(card)}`,card.getAttribute('data-source-id'),card.getAttribute('data-family'),card.getAttribute('data-order-key'),card.getAttribute('data-file')]; values.slice().forEach(v=>{ values=values.concat(suffixVariants(v),bossVariants(v),greatAxeVariants(v)); }); return unique(values).map(norm).filter(Boolean); }
  function orderIndex(card){
    const native=cardNativeOrder(card);
    if(native)return native;
    const map=orderMaps[kind(card)];
    if(!map)return null;
    for(const key of cardAliasKeys(card)) if(map.has(key)) return map.get(key);
    return null;
  }
  function sortCards(cards,mode){ const rows=cards.map((card,index)=>{ if(!card.hasAttribute('data-sort-original'))card.setAttribute('data-sort-original',String(index)); return{card,index,order:orderIndex(card),name:sortName(card)}; }); rows.sort((a,b)=>{ if(mode==='az'||mode==='za'){ const kr=kindRank(a.card)-kindRank(b.card); if(kr)return kr; const cmp=a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true}); return cmp?(mode==='az'?cmp:-cmp):a.index-b.index; } const kr=kindRank(a.card)-kindRank(b.card); if(kr)return kr; const ao=Number.isFinite(a.order)?a.order:null; const bo=Number.isFinite(b.order)?b.order:null; if(ao!==null&&bo!==null&&ao!==bo)return mode==='oldest'?ao-bo:bo-ao; if(ao!==null&&bo===null)return-1; if(ao===null&&bo!==null)return 1; return mode==='oldest'?originalIndex(a.card)-originalIndex(b.card):originalIndex(b.card)-originalIndex(a.card); }); return rows.map(row=>row.card); }
  function signatureFor(cards,mode){ return cards.map(c=>`${kind(c)}:${id(c)}:${orderIndex(c)}`).join('|')+'::'+mode; }
  function applySort(force){
    const grid=$('catalogGrid'); const select=$('catalogSort');
    if(!grid||!select||sorting)return;
    const cards=Array.from(grid.querySelectorAll('.unitCard'));
    if(cards.length<2)return;
    const mode=select.value||DEFAULT_SORT;
    const signature=signatureFor(cards,mode);
    if(!force&&signature===lastSignature)return;
    lastSignature=signature;
    sorting=true;
    const sorted=sortCards(cards,mode);
    const alreadySorted=sorted.every((card,i)=>card===cards[i]);
    if(!alreadySorted){ const frag=document.createDocumentFragment(); sorted.forEach(card=>frag.appendChild(card)); grid.appendChild(frag); }
    requestAnimationFrame(()=>{ sorting=false; });
  }
  function scheduleSort(force=false){
    if(scheduled)return;
    scheduled=true;
    setTimeout(()=>{ scheduled=false; applySort(force); },120);
  }
  function init(){
    const select=$('catalogSort'); const grid=$('catalogGrid');
    if(!select||!grid)return;
    const saved=localStorage.getItem(SORT_KEY)||DEFAULT_SORT;
    select.value=['newest','oldest','az','za'].includes(saved)?saved:DEFAULT_SORT;
    select.addEventListener('change',()=>{ localStorage.setItem(SORT_KEY,select.value||DEFAULT_SORT); lastSignature=''; scheduleSort(true); });
    new MutationObserver(mutations=>{
      if(!mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.classList?.contains('unitCard')||n.querySelector?.('.unitCard')))))return;
      scheduleSort(false);
    }).observe(grid,{childList:true});
    scheduleSort(true);
    setTimeout(()=>scheduleSort(true),600);
  }
  document.addEventListener('DOMContentLoaded',async()=>{ await loadAllOrders(); init(); });
})();
