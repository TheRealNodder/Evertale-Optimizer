/* test-catalog-v2-state-descriptions.js
   Description-only bridge for Test Catalog V2.
   Reads awaken-state descriptions from character_families.bundle.json.
*/
(function(){
  const FAMILY_BUNDLE = './apkfiles/entries/bundles/character_families.bundle.json';
  let familyMap = null;

  const qs = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const key = value => String(value || '').toLowerCase().replace(/\d+$/,'').replace(/[^a-z0-9]+/g,'');
  const selectedCard = () => qs('#catalogGrid .unitCard.v2-selected') || qs('#catalogGrid .unitCard');

  function clampIndex(value, card){
    const count = Math.max(qsa('#v2AwakenTabs button').length, qsa('.stateRow .stateBtn', card || document).length, 3);
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(count - 1, Math.floor(n))) : 0;
  }

  function stateIndex(card){
    const active = qs('#v2AwakenTabs button.active') || qs('#v2AwakenTabs button[aria-pressed="true"]');
    const tabIndex = active?.dataset?.v2Idx ?? active?.dataset?.awakenIndex;
    if(tabIndex !== undefined && tabIndex !== null && tabIndex !== '') return clampIndex(tabIndex, card);
    return clampIndex(qs('.stateRow .stateBtn.active', card)?.dataset?.idx || qs('.unitThumb img', card)?.dataset?.state || card?.getAttribute('data-duo-index') || 0, card);
  }

  function add(map, raw, rows){
    const k = key(raw);
    if(k && rows.length && !map.has(k)) map.set(k, rows);
  }

  async function loadFamilies(){
    if(familyMap) return familyMap;
    const res = await fetch(FAMILY_BUNDLE, { cache:'no-store' });
    const json = await res.json();
    const map = new Map();
    (Array.isArray(json?.entries) ? json.entries : []).forEach(entry => {
      const rows = (Array.isArray(entry?.states) ? entry.states : []).slice(0, 3).map(state => ({
        sourceId: state?.sourceId || state?.dataSourceId || '',
        name: state?.name || entry?.name || '',
        title: state?.title || entry?.title || '',
        description: state?.description || ''
      }));
      if(!rows.length) return;
      [entry?.family, entry?.id, entry?.sourceId, entry?.name, entry?.title].forEach(value => add(map, value, rows));
      rows.forEach(row => [row.sourceId, row.name, row.title].forEach(value => add(map, value, rows)));
    });
    familyMap = map;
    return map;
  }

  function cardKeys(card){
    return [
      card?.getAttribute('data-family'),
      card?.getAttribute('data-duo-root'),
      card?.getAttribute('data-duo-active-id'),
      card?.getAttribute('data-source-id'),
      card?.getAttribute('data-id'),
      qs('.unitName', card)?.textContent,
      qs('.unitTitle', card)?.textContent
    ].map(key).filter(Boolean);
  }

  async function rowsForCard(card){
    if(!card) return [];
    const map = await loadFamilies();
    for(const k of cardKeys(card)){
      const rows = map.get(k);
      if(rows?.length) return rows;
    }
    return [];
  }

  function setTextNode(host, text){
    if(!host) return;
    host.textContent = text || 'No description loaded for this state.';
  }

  async function hydrate(){
    const card = selectedCard();
    if(!card) return;
    const rows = await rowsForCard(card);
    if(!rows.length) return;
    const idx = Math.min(stateIndex(card), rows.length - 1);
    const description = rows[idx]?.description || 'No description loaded for this state.';
    setTextNode(qs('#v2Desc'), description);
    if(qs('#v2SidebarDetailTabs button.active')?.dataset?.sidebarDetail === 'description') setTextNode(qs('#v2SidebarDetailPanel'), description);
    if(qs('.v2-detail-tab-btn.active')?.getAttribute('data-v2-detail-kind') === 'description') setTextNode(qs('.v2-detail-scroll-panel'), description);
  }

  function schedule(){ setTimeout(() => hydrate().catch(console.warn), 80); }

  window.addEventListener('pointerdown', event => { if(event.target.closest('#v2AwakenTabs button')) schedule(); }, true);
  window.addEventListener('click', event => {
    if(event.target.closest('#v2AwakenTabs button,#catalogGrid .unitCard,.stateRow .stateBtn,.duoFormBtn,#v2SidebarDetailTabs button,.v2-detail-tab-btn')) schedule();
  }, true);
  document.addEventListener('v2:hero-state-change', schedule);
  document.addEventListener('DOMContentLoaded', () => { schedule(); setTimeout(schedule, 800); setTimeout(schedule, 1600); });
})();
