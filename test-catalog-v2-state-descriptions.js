/* test-catalog-v2-state-descriptions.js
   Description-only bridge for live Catalog.
   Card selection no longer inherits another card's awaken state.
   Sidebar awaken hydration follows the fast selected-card authority.
*/
(function(){
  const FAMILY_BUNDLE = './apkfiles/entries/bundles/character_families.bundle.json';
  let familyMap = null;
  const forcedByCard = new Map();
  let pendingTimer = null;
  let lastWriteKey = '';

  const qs = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const key = value => String(value || '').toLowerCase().replace(/\d+$/,'').replace(/[^a-z0-9]+/g,'');
  const cardId = card => String(card?.getAttribute('data-id') || card?.getAttribute('data-source-id') || card?.getAttribute('data-family') || qs('.unitName',card)?.textContent || '').trim();
  function cardById(id){return id?qs(`#catalogGrid .unitCard[data-id="${CSS.escape(id)}"]`)||qs(`#catalogGrid .unitCard[data-source-id="${CSS.escape(id)}"]`)||qs(`#catalogGrid .unitCard[data-family="${CSS.escape(id)}"]`):null;}
  const selectedCard = () => cardById(window.__EVERTALE_FAST_SELECTED_CARD_ID) || cardById(qs('#v2AwakenTabs')?.dataset?.v2ActiveCard) || qs('#catalogGrid .unitCard.v2-selected') || qs('#catalogGrid .unitCard');

  function imgKeyFromCard(card){
    const src = qs('.unitThumb img', card)?.getAttribute('src') || qs('.unitThumb img', card)?.src || '';
    return key(String(src).split('/').pop().replace(/\.png(?:\?.*)?$/i,''));
  }

  function clampIndex(value, card){
    const count = Math.max(qsa('.stateRow .stateBtn:not(.v2-state-hidden)', card || document).length, qsa('.stateRow .stateBtn', card || document).length, 1);
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(count - 1, Math.floor(n))) : 0;
  }

  function rememberIndex(value, card){
    const target = card || selectedCard();
    const id = cardId(target);
    if(!id) return;
    forcedByCard.set(id, clampIndex(value, target));
  }

  function stateIndex(card){
    const id = cardId(card);
    if(id && forcedByCard.has(id)) return clampIndex(forcedByCard.get(id), card);
    return clampIndex(qs('.stateRow .stateBtn.active', card)?.dataset?.idx || qs('.unitThumb img', card)?.dataset?.state || card?.getAttribute('data-duo-index') || 0, card);
  }

  function add(map, raw, rows){
    const k = key(raw);
    if(k && rows.length && !map.has(k)) map.set(k, rows);
  }

  async function loadFamilies(){
    if(familyMap) return familyMap;
    const res = await fetch(FAMILY_BUNDLE, { cache:'default' });
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
      imgKeyFromCard(card),
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
    const next = text || 'No description loaded for this state.';
    if(host.textContent === next) return;
    host.textContent = next;
  }

  function storeRowsOnCard(card, rows, description){
    const panel = qs('.descriptionPanel', card);
    if(panel && panel.getAttribute('data-v2-state-description-ready') !== '1'){
      try{ panel.setAttribute('data-descriptions', encodeURIComponent(JSON.stringify(rows))); }catch{}
      panel.setAttribute('data-v2-state-description-ready','1');
    }
    const desc = qs('.descriptionText', card);
    if(desc && desc.textContent !== (description || '')) desc.textContent = description || '';
  }

  async function hydrate(){
    const card = selectedCard();
    if(!card) return;
    const rows = await rowsForCard(card);
    if(!rows.length) return;
    const idx = Math.min(stateIndex(card), rows.length - 1);
    const description = rows[idx]?.description || 'No description loaded for this state.';
    const writeKey = `${cardId(card)}|${idx}|${description}`;
    if(writeKey === lastWriteKey) return;
    lastWriteKey = writeKey;
    storeRowsOnCard(card, rows, description);
    setTextNode(qs('#v2Desc'), description);
    if(qs('#v2SidebarDetailTabs button.active')?.dataset?.sidebarDetail === 'description') setTextNode(qs('#v2SidebarDetailPanel'), description);
    if(qs('.v2-detail-tab-btn.active')?.getAttribute('data-v2-detail-kind') === 'description') setTextNode(qs('.v2-detail-scroll-panel'), description);
  }

  function schedule(delay=70){
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => hydrate().catch(console.warn), delay);
  }
  function scheduleStable(){ schedule(35); setTimeout(() => hydrate().catch(console.warn), 240); }

  function captureIndexFromEvent(event){
    const sidebarBtn = event.target.closest('#v2AwakenTabs button');
    if(sidebarBtn){ rememberIndex(sidebarBtn.dataset.v2Idx ?? sidebarBtn.dataset.awakenIndex ?? Array.from(sidebarBtn.parentNode.children).indexOf(sidebarBtn), selectedCard()); return; }
    const stateBtn = event.target.closest('.stateRow .stateBtn');
    if(stateBtn) rememberIndex(stateBtn.dataset.idx ?? Array.from(stateBtn.parentNode.children).indexOf(stateBtn), stateBtn.closest('.unitCard') || selectedCard());
  }

  window.addEventListener('pointerdown', event => {
    if(event.target.closest('#v2AwakenTabs button,.stateRow .stateBtn')){ captureIndexFromEvent(event); scheduleStable(); }
  }, true);

  window.addEventListener('click', event => {
    if(event.target.closest('#v2AwakenTabs button,.stateRow .stateBtn')) captureIndexFromEvent(event);
    if(event.target.closest('#v2AwakenTabs button,.stateRow .stateBtn,#catalogGrid .unitCard,.duoFormBtn,#v2SidebarDetailTabs button,.v2-detail-tab-btn')) scheduleStable();
  }, true);

  document.addEventListener('v2:hero-state-change', event => {
    if(event?.detail?.index !== undefined) rememberIndex(event.detail.index, event.detail.card || selectedCard());
    scheduleStable();
  });

  document.addEventListener('DOMContentLoaded', () => { scheduleStable(); setTimeout(scheduleStable, 900); });
})();
