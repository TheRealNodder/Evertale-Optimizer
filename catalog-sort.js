/* catalog-sort.js — stable display-only sorter.
   Critical rule: trust the card/bundle order first. Index/order maps are fallback only.
   This prevents stale weapon maps from overriding the rebuilt weapons.bundle.json order.
*/
(function(){
  const SORT_KEY = 'evertale_catalog_sort_v7';
  const DEFAULT_SORT = 'newest';
  const KIND_RANK = { characters: 0, weapons: 1, accessories: 2, bosses: 3 };
  const INDEX_FILES = {
    characters: './apkfiles/entries/characters/index.json',
    weapons: './apkfiles/entries/weapons/index.json',
    accessories: './apkfiles/entries/accessories/index.json',
    bosses: './apkfiles/entries/bosses/index.json'
  };

  let orderMaps = { characters:new Map(), weapons:new Map(), accessories:new Map(), bosses:new Map() };
  let sorting = false;
  let scheduled = false;
  let lastSignature = '';

  function $(id){ return document.getElementById(id); }
  function norm(v){ return String(v || '').toLowerCase().replace(/[\u2019']/g,'').replace(/[^a-z0-9]+/g,''); }
  function stripHandle(v){ return String(v || '').split('/').pop().replace(/\.json$/i,'').replace(/^\d+_/,''); }
  function family(v){ return String(v || '').replace(/\d+$/,''); }
  function title(card){ return (card.querySelector('.unitName')?.textContent || '').trim(); }
  function subtitle(card){ return (card.querySelector('.unitTitle')?.textContent || '').trim(); }
  function kind(card){ return card.getAttribute('data-kind') || ''; }
  function id(card){ return card.getAttribute('data-id') || ''; }
  function kindRank(card){ return KIND_RANK[kind(card)] ?? 99; }
  function originalIndex(card){ return Number(card.getAttribute('data-sort-original') || '0'); }
  function sortName(card){ return title(card).trim().toLowerCase(); }
  function numericValue(v){ const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; }
  function handleFromFile(file){ const m = String(file || '').split('/').pop().match(/^(\d+)_/); return m ? numericValue(m[1]) : null; }
  function cardNativeOrder(card){
    return numericValue(card.getAttribute('data-order')) ||
           numericValue(card.getAttribute('data-source-order')) ||
           numericValue(card.getAttribute('data-file-handle-order')) ||
           handleFromFile(card.getAttribute('data-file'));
  }
  function unique(values){
    const out=[]; const seen=new Set();
    values.forEach(v=>{ const s=String(v||'').trim(); const n=norm(s); if(s && n && !seen.has(n)){ seen.add(n); out.push(s); } });
    return out;
  }
  function suffixVariants(value){
    const raw=String(value||'').trim();
    if(!raw) return [];
    return /01$/i.test(raw) ? [raw, raw.replace(/01$/i,'')] : [raw, raw + '01'];
  }
  function addKey(map,key,order){ const n=norm(key); if(n && order && !map.has(n)) map.set(n,order); }
  function addAliases(map,value,order){
    if(!value || !order) return;
    const raw=String(value||'');
    const stem=stripHandle(raw);
    const values=[raw, stem, family(raw), family(stem)];
    values.slice().forEach(v=>values.push(...suffixVariants(v)));
    values.forEach(v=>addKey(map,v,order));
  }
  function addIndexRow(map,row){
    const order = handleFromFile(row.file) || numericValue(row.fileHandleOrder) || numericValue(row.sourceOrder) || numericValue(row.order) || numericValue(row.visualOrder);
    if(!order) return;
    [row.sourceId,row.family,row.key,row.name,row.displayName,row.title,row.sortName,row.file].forEach(v=>addAliases(map,v,order));
  }
  async function fetchJson(url){
    const res=await fetch(url,{cache:'default'});
    if(!res.ok) throw new Error(`${url}: ${res.status}`);
    return await res.json();
  }
  async function loadIndexOrder(kindKey){
    const map=new Map();
    try{
      const json=await fetchJson(INDEX_FILES[kindKey]);
      const rows=Array.isArray(json?.entries)?json.entries:[];
      rows.forEach(row=>addIndexRow(map,row));
    }catch(err){
      console.warn(`[CatalogSort] fallback index order unavailable for ${kindKey}`,err);
    }
    return map;
  }
  async function loadAllOrders(){
    const pairs=await Promise.all(['characters','weapons','accessories','bosses'].map(async k=>[k,await loadIndexOrder(k)]));
    pairs.forEach(([k,map])=>{orderMaps[k]=map;});
  }
  function cardAliasKeys(card){
    let values=[id(card),stripHandle(id(card)),family(id(card)),family(stripHandle(id(card))),title(card),subtitle(card),`${title(card)} ${subtitle(card)}`,card.getAttribute('data-source-id'),card.getAttribute('data-family'),card.getAttribute('data-order-key'),card.getAttribute('data-file')];
    values.slice().forEach(v=>values.push(...suffixVariants(v)));
    return unique(values).map(norm).filter(Boolean);
  }
  function orderIndex(card){
    // Native/bundle order wins. This is required for weapons because old weapon_order_map/index files can be stale.
    const native = cardNativeOrder(card);
    if(native) return native;
    const map=orderMaps[kind(card)];
    if(!map) return null;
    for(const key of cardAliasKeys(card)) if(map.has(key)) return map.get(key);
    return null;
  }
  function sortCards(cards,mode){
    const rows=cards.map((card,index)=>{
      if(!card.hasAttribute('data-sort-original')) card.setAttribute('data-sort-original',String(index));
      return {card,index,order:orderIndex(card),name:sortName(card)};
    });
    rows.sort((a,b)=>{
      if(mode==='az'||mode==='za'){
        const kr=kindRank(a.card)-kindRank(b.card);
        if(kr) return kr;
        const cmp=a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true});
        return cmp ? (mode==='az'?cmp:-cmp) : a.index-b.index;
      }
      const kr=kindRank(a.card)-kindRank(b.card);
      if(kr) return kr;
      const ao=Number.isFinite(a.order)?a.order:null;
      const bo=Number.isFinite(b.order)?b.order:null;
      if(ao!==null&&bo!==null&&ao!==bo) return mode==='oldest' ? ao-bo : bo-ao;
      if(ao!==null&&bo===null) return -1;
      if(ao===null&&bo!==null) return 1;
      return mode==='oldest' ? originalIndex(a.card)-originalIndex(b.card) : originalIndex(b.card)-originalIndex(a.card);
    });
    return rows.map(r=>r.card);
  }
  function signatureFor(cards,mode){ return cards.map(c=>`${kind(c)}:${id(c)}:${orderIndex(c)}`).join('|')+'::'+mode; }
  function applySort(force=false){
    const grid=$('catalogGrid'); const select=$('catalogSort');
    if(!grid||!select||sorting) return;
    const cards=Array.from(grid.querySelectorAll('.unitCard'));
    if(cards.length<2) return;
    const mode=select.value||DEFAULT_SORT;
    const signature=signatureFor(cards,mode);
    if(!force && signature===lastSignature) return;
    lastSignature=signature;
    sorting=true;
    const sorted=sortCards(cards,mode);
    const alreadySorted=sorted.every((card,i)=>card===cards[i]);
    if(!alreadySorted){
      const frag=document.createDocumentFragment();
      sorted.forEach(card=>frag.appendChild(card));
      grid.appendChild(frag);
    }
    requestAnimationFrame(()=>{sorting=false;});
  }
  function scheduleSort(force=false){
    if(scheduled) return;
    scheduled=true;
    setTimeout(()=>{scheduled=false; applySort(force);},120);
  }
  function init(){
    const select=$('catalogSort'); const grid=$('catalogGrid');
    if(!select||!grid) return;
    const saved=localStorage.getItem(SORT_KEY)||DEFAULT_SORT;
    select.value=['newest','oldest','az','za'].includes(saved)?saved:DEFAULT_SORT;
    select.addEventListener('change',()=>{localStorage.setItem(SORT_KEY,select.value||DEFAULT_SORT); lastSignature=''; scheduleSort(true);});
    new MutationObserver(mutations=>{
      if(!mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.classList?.contains('unitCard')||n.querySelector?.('.unitCard'))))) return;
      scheduleSort(false);
    }).observe(grid,{childList:true});
    scheduleSort(true);
    setTimeout(()=>scheduleSort(true),700);
  }
  document.addEventListener('DOMContentLoaded',async()=>{ await loadAllOrders(); init(); });
})();
