/* catalog-sort.js — stable display-only sorter.
   Characters use ONLY filename handles from apkfiles/entries/characters/index.json.
   Other categories keep their existing explorer/legacy map behavior.
*/
(function(){
  const SORT_KEY = 'evertale_catalog_sort_v1';
  const DEFAULT_SORT = 'newest';
  const KIND_RANK = { characters: 0, weapons: 1, accessories: 2, bosses: 3 };
  const CHARACTER_INDEX = './apkfiles/entries/characters/index.json';
  const EXPLORER_ORDER_FILES = {
    weapons: './apkfiles/entries/maps/explorer_weapon_order.json',
    accessories: './apkfiles/entries/maps/explorer_accessory_order.json',
    bosses: './apkfiles/entries/maps/explorer_boss_order.json',
  };
  const LEGACY_ORDER_FILES = {
    weapons: './apkfiles/entries/maps/weapon_order_map.json',
    accessories: './apkfiles/entries/maps/accessory_order_map.json',
    bosses: './apkfiles/entries/maps/boss_order_map.json',
  };
  let orderMaps = { characters: new Map(), weapons: new Map(), accessories: new Map(), bosses: new Map() };
  let sorting = false;
  let lastSignature = '';

  function $(id){ return document.getElementById(id); }
  function norm(value){ return String(value || '').toLowerCase().replace(/[\u2019']/g, '').replace(/[^a-z0-9]+/g, ''); }
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

  function addKey(map, key, order){
    key = norm(key);
    if(key && order && !map.has(key)) map.set(key, order);
  }

  function addCharacterIndexRow(map, row){
    const order = handleFromFile(row.file) || numericValue(row.fileHandleOrder) || numericValue(row.sourceOrder);
    if(!order) return;
    const src = row.sourceId || '';
    const fam = row.family || family(src);
    addKey(map, src, order);
    addKey(map, family(src), order);
    addKey(map, fam, order);
    addKey(map, family(fam), order);
    addKey(map, row.file, order);
  }

  function addOrderKeys(map, row, fallbackIndex){
    const order = numericValue(row.fileHandleOrder) || numericValue(row.sourceOrder) || handleFromFile(row.file) || numericValue(row.order) || numericValue(row.visualOrder) || (fallbackIndex + 1);
    [row.key,row.sourceId,row.displayName,row.sortName,row.name,row.title,row.file].forEach(value => addKey(map, value, order));
  }

  async function fetchJson(url){
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error(`${url}: ${res.status}`);
    return await res.json();
  }

  async function loadCharacterHandleOrder(){
    const map = new Map();
    try{
      const json = await fetchJson(CHARACTER_INDEX);
      const rows = Array.isArray(json?.entries) ? json.entries : [];
      rows.forEach(row => addCharacterIndexRow(map, row));
    }catch(err){
      console.warn('[CatalogSort] Character handle index unavailable', err);
    }
    return map;
  }

  async function loadOtherOrder(kindKey){
    const map = new Map();
    try{
      const json = await fetchJson(EXPLORER_ORDER_FILES[kindKey]);
      const rows = Array.isArray(json?.order) ? json.order : [];
      rows.forEach((row, idx) => addOrderKeys(map, row, idx));
      if(map.size) return map;
    }catch(err){ console.warn(`[CatalogSort] Explorer order unavailable for ${kindKey}`, err); }
    try{
      const json = await fetchJson(LEGACY_ORDER_FILES[kindKey]);
      const rows = Array.isArray(json?.order) ? json.order : [];
      rows.forEach((row, idx) => addOrderKeys(map, row, idx));
    }catch(err){ console.warn(`[CatalogSort] Legacy order unavailable for ${kindKey}`, err); }
    return map;
  }

  async function loadAllOrders(){
    orderMaps.characters = await loadCharacterHandleOrder();
    const rest = await Promise.all(['weapons','accessories','bosses'].map(async k => [k, await loadOtherOrder(k)]));
    rest.forEach(([k, map]) => { orderMaps[k] = map; });
  }

  function orderIndex(card){
    const k = kind(card);
    const map = orderMaps[k];
    if(!map) return null;
    const keys = [id(card), family(id(card)), title(card), subtitle(card), `${title(card)} ${subtitle(card)}`].map(norm).filter(Boolean);
    for (const key of keys) if (map.has(key)) return map.get(key);
    return numericValue(card.getAttribute('data-order'));
  }

  function sortCards(cards, mode){
    const rows = cards.map((card, index) => {
      if(!card.hasAttribute('data-sort-original')) card.setAttribute('data-sort-original', String(index));
      return { card, index, order: orderIndex(card), name: sortName(card) };
    });
    rows.sort((a, b) => {
      if(mode === 'az' || mode === 'za'){
        const kr = kindRank(a.card) - kindRank(b.card);
        if(kr) return kr;
        const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
        return cmp ? (mode === 'az' ? cmp : -cmp) : a.index - b.index;
      }
      const kr = kindRank(a.card) - kindRank(b.card);
      if(kr) return kr;
      const ao = Number.isFinite(a.order) ? a.order : null;
      const bo = Number.isFinite(b.order) ? b.order : null;
      if(ao !== null && bo !== null && ao !== bo) return mode === 'oldest' ? ao - bo : bo - ao;
      if(ao !== null && bo === null) return -1;
      if(ao === null && bo !== null) return 1;
      return mode === 'oldest' ? originalIndex(a.card) - originalIndex(b.card) : originalIndex(b.card) - originalIndex(a.card);
    });
    return rows.map(row => row.card);
  }

  function applySort(force){
    const grid = $('catalogGrid');
    const select = $('catalogSort');
    if(!grid || !select || sorting) return;
    const cards = Array.from(grid.querySelectorAll('.unitCard'));
    if(cards.length < 2) return;
    const signature = cards.map(c => `${kind(c)}:${id(c)}`).join('|') + '::' + (select.value || DEFAULT_SORT);
    if(!force && signature === lastSignature) return;
    lastSignature = signature;
    sorting = true;
    const sorted = sortCards(cards, select.value || DEFAULT_SORT);
    const frag = document.createDocumentFragment();
    sorted.forEach(card => frag.appendChild(card));
    grid.appendChild(frag);
    requestAnimationFrame(() => { sorting = false; });
  }

  function init(){
    const select = $('catalogSort');
    const grid = $('catalogGrid');
    if(!select || !grid) return;
    const saved = localStorage.getItem(SORT_KEY) || DEFAULT_SORT;
    select.value = ['newest','oldest','az','za'].includes(saved) ? saved : DEFAULT_SORT;
    select.addEventListener('change', () => { localStorage.setItem(SORT_KEY, select.value || DEFAULT_SORT); lastSignature=''; applySort(true); });
    new MutationObserver(() => applySort(false)).observe(grid, { childList: true });
    setTimeout(() => applySort(true), 0);
    setTimeout(() => applySort(true), 700);
  }

  document.addEventListener('DOMContentLoaded', async () => { await loadAllOrders(); init(); });
})();
