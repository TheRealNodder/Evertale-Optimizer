/* catalog-sort.js — display-only sorter for catalog cards */
(function(){
  const SORT_KEY = 'evertale_catalog_sort_v1';
  const DEFAULT_SORT = 'newest';
  const KIND_RANK = { characters: 0, weapons: 1, accessories: 2, bosses: 3 };
  let characterOrder = new Map();
  let observer = null;
  let sorting = false;

  function $(id){ return document.getElementById(id); }
  function norm(value){ return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function title(card){ return (card.querySelector('.unitName')?.textContent || '').trim(); }
  function kind(card){ return card.getAttribute('data-kind') || ''; }
  function id(card){ return card.getAttribute('data-id') || ''; }
  function kindRank(card){ return KIND_RANK[kind(card)] ?? 99; }
  function originalIndex(card){ return Number(card.getAttribute('data-sort-original') || '0'); }
  function characterOrderIndex(card){
    if (kind(card) !== 'characters') return null;
    const keys = [id(card), title(card)].map(norm).filter(Boolean);
    for (const key of keys) if (characterOrder.has(key)) return characterOrder.get(key);
    return null;
  }

  async function loadCharacterOrder(){
    try{
      const res = await fetch('./apkfiles/entries/maps/character_order_map.json', { cache: 'no-store' });
      if(!res.ok) return;
      const json = await res.json();
      const rows = Array.isArray(json?.order) ? json.order : [];
      characterOrder = new Map();
      rows.forEach((row, idx) => {
        const order = Number(row.order || idx + 1);
        [row.key, row.sourceId, row.displayName].forEach(value => {
          const key = norm(value);
          if(key && !characterOrder.has(key)) characterOrder.set(key, order);
        });
      });
    }catch(err){
      console.warn('[CatalogSort] character order map unavailable', err);
    }
  }

  function sortCards(cards, mode){
    const rows = cards.map((card, index) => {
      if(!card.hasAttribute('data-sort-original')) card.setAttribute('data-sort-original', String(index));
      return { card, index, order: characterOrderIndex(card), name: title(card).toLowerCase() };
    });

    rows.sort((a, b) => {
      if(mode === 'az' || mode === 'za'){
        const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
        if(cmp) return mode === 'az' ? cmp : -cmp;
        return a.index - b.index;
      }

      const kr = kindRank(a.card) - kindRank(b.card);
      if(kr) return kr;

      const ao = Number.isFinite(a.order) ? a.order : null;
      const bo = Number.isFinite(b.order) ? b.order : null;
      if(ao !== null && bo !== null && ao !== bo){
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
    await loadCharacterOrder();
    init();
  });
})();
