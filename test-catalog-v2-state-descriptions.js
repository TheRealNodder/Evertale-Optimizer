/* test-catalog-v2-state-descriptions.js
   Description-only bridge for Test Catalog V2.
   Reads awaken-state descriptions from character_families.bundle.json.
*/
(function(){
  const FAMILY_BUNDLE = './apkfiles/entries/bundles/character_families.bundle.json';
  let familyMap = null;
  let forcedIndex = null;
  let forcedUntil = 0;
  let pendingTimer = null;
  let lastWriteKey = '';

  const qs = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const key = value => String(value || '').toLowerCase().replace(/\d+$/,'').replace(/[^a-z0-9]+/g,'');
  const selectedCard = () => qs('#catalogGrid .unitCard.v2-selected') || qs('#catalogGrid .unitCard');

  function imgKeyFromCard(card){
    const src = qs('.unitThumb img', card)?.getAttribute('src') || qs('.unitThumb img', card)?.src || '';
    return key(String(src).split('/').pop().replace(/\.png(?:\?.*)?$/i,''));
  }

  function clampIndex(value, card){
    const count = Math.max(qsa('#v2AwakenTabs button').length, qsa('.stateRow .stateBtn', card || document).length, 3);
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(count - 1, Math.floor(n))) : 0;
  }

  function rememberIndex(value, card){
    forcedIndex = clampIndex(value, card || selectedCard());
    forcedUntil = Date.now() + 1200;
  }

  function stateIndex(card){
    if(forcedIndex !== null && Date.now() < forcedUntil) return clampIndex(forcedIndex, card);
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

  function storeRowsOnCard(card, rows, idx, description){
    const panel = qs('.descriptionPanel', card);
    if(panel && panel.getAttribute('data-v2-state-description-ready') !== '1'){
      try{ panel.setAttribute('data-descriptions', encodeURIComponent(JSON.stringify(rows))); }catch{}
      panel.setAttribute('data-v2-state-description-ready','1');
    }
    const desc = qs('.descriptionText', card);
    if(desc && desc.textContent !== (description || '')) desc.textContent = description || '';
    const img = qs('.unitThumb img', card);
    if(img && img.getAttribute('data-state') !== String(idx)) img.setAttribute('data-state', String(idx));
    if(card?.getAttribute('data-duo-index') !== String(idx)) card?.setAttribute('data-duo-index', String(idx));
  }

  async function hydrate(){
    const card = selectedCard();
    if(!card) return;
    const rows = await rowsForCard(card);
    if(!rows.length) return;
    const idx = Math.min(stateIndex(card), rows.length - 1);
    const description = rows[idx]?.description || 'No description loaded for this state.';
    const writeKey = `${card.getAttribute('data-source-id') || card.getAttribute('data-family') || ''}|${idx}|${description}`;
    if(writeKey === lastWriteKey) return;
    lastWriteKey = writeKey;
    storeRowsOnCard(card, rows, idx, description);
    setTextNode(qs('#v2Desc'), description);
    if(qs('#v2SidebarDetailTabs button.active')?.dataset?.sidebarDetail === 'description') setTextNode(qs('#v2SidebarDetailPanel'), description);
    if(qs('.v2-detail-tab-btn.active')?.getAttribute('data-v2-detail-kind') === 'description') setTextNode(qs('.v2-detail-scroll-panel'), description);
  }

  function schedule(delay=70){
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => hydrate().catch(console.warn), delay);
  }
  function scheduleBackup(){ setTimeout(() => hydrate().catch(console.warn), 240); }
  function scheduleStable(){ schedule(35); scheduleBackup(); }

  function captureIndexFromEvent(event){
    const card = selectedCard();
    const sidebarBtn = event.target.closest('#v2AwakenTabs button');
    if(sidebarBtn){
      rememberIndex(sidebarBtn.dataset.v2Idx ?? sidebarBtn.dataset.awakenIndex ?? Array.from(sidebarBtn.parentNode.children).indexOf(sidebarBtn), card);
      return;
    }
    const stateBtn = event.target.closest('.stateRow .stateBtn');
    if(stateBtn) rememberIndex(stateBtn.dataset.idx ?? Array.from(stateBtn.parentNode.children).indexOf(stateBtn), stateBtn.closest('.unitCard') || card);
  }

  window.addEventListener('pointerdown', event => {
    if(event.target.closest('#v2AwakenTabs button,.stateRow .stateBtn')){ captureIndexFromEvent(event); scheduleStable(); }
  }, true);

  window.addEventListener('click', event => {
    if(event.target.closest('#v2AwakenTabs button,.stateRow .stateBtn,#catalogGrid .unitCard,.duoFormBtn,#v2SidebarDetailTabs button,.v2-detail-tab-btn')){
      captureIndexFromEvent(event);
      scheduleStable();
    }
  }, true);

  document.addEventListener('v2:hero-state-change', event => {
    if(event?.detail?.index !== undefined) rememberIndex(event.detail.index, event.detail.card || selectedCard());
    scheduleStable();
  });

  document.addEventListener('DOMContentLoaded', () => { scheduleStable(); setTimeout(scheduleStable, 900); });
})();
