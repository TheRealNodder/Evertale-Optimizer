/* catalog-sort.js — display-only sorter for catalog cards */
(function(){
  const SORT_KEY = 'evertale_catalog_sort_v1';
  const DEFAULT_SORT = 'newest';
  const KIND_RANK = { characters: 0, weapons: 1, accessories: 2, bosses: 3 };
  const EXPLORER_ORDER_FILES = {
    characters: './apkfiles/entries/maps/explorer_character_order.json',
    weapons: './apkfiles/entries/maps/explorer_weapon_order.json',
    accessories: './apkfiles/entries/maps/explorer_accessory_order.json',
    bosses: './apkfiles/entries/maps/explorer_boss_order.json',
  };
  const LEGACY_ORDER_FILES = {
    characters: './apkfiles/entries/maps/character_order_map.json',
    weapons: './apkfiles/entries/maps/weapon_order_map.json',
    accessories: './apkfiles/entries/maps/accessory_order_map.json',
    bosses: './apkfiles/entries/maps/boss_order_map.json',
  };
  let orderMaps = { characters: new Map(), weapons: new Map(), accessories: new Map(), bosses: new Map() };
  let observer = null;
  let sorting = false;

  function $(id){ return document.getElementById(id); }
  function norm(value){ return String(value || '').toLowerCase().replace(/[\u2019']/g, '').replace(/[^a-z0-9]+/g, ''); }
  function title(card){ return (card.querySelector('.unitName')?.textContent || '').trim(); }
  function subtitle(card){ return (card.querySelector('.unitTitle')?.textContent || '').trim(); }
  function kind(card){ return card.getAttribute('data-kind') || ''; }
  function id(card){ return card.getAttribute('data-id') || ''; }
  function kindRank(card){ return KIND_RANK[kind(card)] ?? 99; }
  function originalIndex(card){ return Number(card.getAttribute('data-sort-original') || '0'); }
  function sortName(card){ return title(card).trim().toLowerCase(); }

  function orderIndex(card){
    const explicit = Number(card.getAttribute('data-order') || '');
    if(Number.isFinite(explicit) && explicit > 0) return explicit;
    const k = kind(card);
    const map = orderMaps[k];
    if(!map) return null;
    const keys = [
      id(card),
      title(card),
      subtitle(card),
      `${title(card)} ${subtitle(card)}`,
    ].map(norm).filter(Boolean);
    for (const key of keys) if (map.has(key)) return map.get(key);
    return null;
  }

  function addOrderKeys(map, row, fallbackIndex){
    const rawOrder = Number(row.order ?? row.sourceOrder ?? row.fileHandleOrder ?? row.visualOrder ?? fallbackIndex + 1);
    const order = Number.isFinite(rawOrder) ? rawOrder : fallbackIndex + 1;
    [
      row.key,
      row.sourceId,
      row.displayName,
      row.sortName,
      row.name,
      row.title,
      row.file,
    ].forEach(value => {
      const key = norm(value);
      if(key && !map.has(key)) map.set(key, order);
    });
  }

  async function fetchOrderFile(url){
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error(`${url}: ${res.status}`);
    return await res.json();
  }

  async function loadOneOrder(kindKey){
    const map = new Map();
    try{
      const json = await fetchOrderFile(EXPLORER_ORDER_FILES[kindKey]);
      const rows = Array.isArray(json?.order) ? json.order : [];
      rows.forEach((row, idx) => addOrderKeys(map, row, idx));
      if(map.size) return map;
    }catch(err){
      console.warn(`[CatalogSort] Explorer order unavailable for ${kindKey}`, err);
    }

    try{
      const json = await fetchOrderFile(LEGACY_ORDER_FILES[kindKey]);
      const rows = Array.isArray(json?.order) ? json.order : [];
      rows.forEach((row, idx) => addOrderKeys(map, row, idx));
    }catch(err){
      console.warn(`[CatalogSort] Legacy order unavailable for ${kindKey}`, err);
    }
    return map;
  }

  async function loadAllOrders(){
    const entries = await Promise.all(Object.keys(orderMaps).map(async kindKey => [kindKey, await loadOneOrder(kindKey)]));
    entries.forEach(([kindKey, map]) => { orderMaps[kindKey] = map; });
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
        if(cmp) return mode === 'az' ? cmp : -cmp;
        return a.index - b.index;
      }

      const kr = kindRank(a.card) - kindRank(b.card);
      if(kr) return kr;

      const ao = Number.isFinite(a.order) ? a.order : null;
      const bo = Number.isFinite(b.order) ? b.order : null;
      if(ao !== null && bo !== null && ao !== bo){
        // Higher numeric entry handles are newer, e.g. 0737_* should sort above 0736_*.
        return mode === 'oldest' ? ao - bo : bo - ao;
      }
      if(ao !== null && bo === null) return -1;
      if(ao === null && bo !== null) return 1;
      return mode === 'oldest' ? originalIndex(a.card) - originalIndex(b.card) : originalIndex(b.card) - originalIndex(a.card);
    });

    return rows.map(row => row.card);
  }

  function applySort(){
    const grid = $('catalogGrid');
    const select = $('catalogSort');
    if(!grid || !select || sorting) return;
    const cards = Array.from(grid.querySelectorAll('.unitCard'));
    if(cards.length < 2) return;

    sorting = true;
    const mode = select.value || DEFAULT_SORT;
    const sorted = sortCards(cards, mode);
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
    select.addEventListener('change', () => {
      localStorage.setItem(SORT_KEY, select.value || DEFAULT_SORT);
      applySort();
    });

    observer = new MutationObserver(() => applySort());
    observer.observe(grid, { childList: true });
    applySort();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadAllOrders();
    init();
  });
})();
