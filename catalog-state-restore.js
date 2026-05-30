/* catalog-state-restore.js — final catalog correction layer.
   Correct rules:
   - Characters may show up to THREE state circles: base / evolved / final.
   - The previous bug was FOUR circles, not three.
   - Duo parent cards inherit the newest numeric handle from their child forms, so a
     parent like LudmillaBallet sorts at the newest child handle while child cards stay hidden.
*/
(function(){
  const FAMILY_BUNDLE_URL = './apkfiles/entries/bundles/character_families.bundle.json';
  const CHARACTER_INDEX_URL = './apkfiles/entries/characters/index.json';
  const DUO_DISPLAY_URL = './apkfiles/DuoDisplay.json';
  let cache = null;
  let timer = null;
  let busy = false;

  function norm(v){ return String(v || '').trim(); }
  function key(v){ return norm(v).toLowerCase().replace(/\d+$/,'').replace(/[^a-z0-9]+/g,''); }
  function rawKey(v){ return norm(v).toLowerCase().replace(/[^a-z0-9]+/g,''); }
  function safe(v){ return String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function handleFromFile(file){ const m = String(file || '').split('/').pop().match(/^(\d+)_/); return m ? Number(m[1]) : null; }
  async function json(url){ try{ const r = await fetch(url, { cache:'no-store' }); return r.ok ? await r.json() : null; }catch{ return null; } }

  function addAlias(map, k, family){
    family = norm(family);
    if(!family) return;
    [k, String(k || '').replace(/\d+$/,'')].forEach(value => {
      const rk = rawKey(value);
      const sk = key(value);
      if(rk && !map.has(rk)) map.set(rk, family);
      if(sk && !map.has(sk)) map.set(sk, family);
    });
  }

  function addState(states, state){
    const url = state?.url || state?.image;
    if(!url) return;
    if(states.some(s => s.url === url)) return;
    states.push({
      state: state?.state || 'state',
      url,
      sourceId: state?.sourceId || state?.imageSourceId || state?.dataSourceId || '',
      dataSourceId: state?.dataSourceId || state?.sourceId || '',
      title: state?.title || '',
      description: state?.description || ''
    });
  }

  function readCardId(card){ return norm(card.getAttribute('data-id') || card.getAttribute('data-unit-id') || ''); }
  function readCardName(card){ return norm(card.querySelector('.unitName')?.textContent || ''); }
  function readCardTitle(card){ return norm(card.querySelector('.unitTitle')?.textContent || ''); }
  function familyForCard(card, alias){
    const values = [readCardId(card), readCardName(card), readCardTitle(card)];
    for(const value of values){
      const rk = rawKey(value);
      const sk = key(value);
      if(alias.has(rk)) return alias.get(rk);
      if(alias.has(sk)) return alias.get(sk);
    }
    return readCardId(card);
  }

  async function load(){
    if(cache) return cache;
    const [familyBundle, characterIndex, duoDisplay] = await Promise.all([
      json(FAMILY_BUNDLE_URL),
      json(CHARACTER_INDEX_URL),
      json(DUO_DISPLAY_URL)
    ]);

    const families = Array.isArray(familyBundle?.entries) ? familyBundle.entries : [];
    const indexRows = Array.isArray(characterIndex?.entries) ? characterIndex.entries : [];
    const handleBySource = new Map();
    indexRows.forEach(row => {
      const handle = handleFromFile(row?.file) || Number(row?.fileHandleOrder || 0) || null;
      const source = norm(row?.sourceId || row?.internal?.sourceId || '');
      const family = norm(row?.family || '').replace(/\d+$/,'');
      if(source && handle) handleBySource.set(rawKey(source), Math.max(handleBySource.get(rawKey(source)) || 0, handle));
      if(family && handle) handleBySource.set(rawKey(family), Math.max(handleBySource.get(rawKey(family)) || 0, handle));
    });

    const alias = new Map();
    const statesByFamily = new Map();
    const handleByFamily = new Map();

    families.forEach(row => {
      const family = norm(row?.family || row?.id || row?.sourceId);
      if(!family) return;
      addAlias(alias, family, family);
      addAlias(alias, row?.id, family);
      addAlias(alias, row?.sourceId, family);
      addAlias(alias, row?.name, family);
      addAlias(alias, row?.title, family);
      addAlias(alias, row?.subtitle, family);

      const states = [];
      (Array.isArray(row?.states) ? row.states : []).forEach(st => {
        addState(states, st);
        addAlias(alias, st?.sourceId, family);
        addAlias(alias, st?.dataSourceId, family);
        addAlias(alias, st?.imageSourceId, family);
        const h = handleBySource.get(rawKey(st?.sourceId)) || handleBySource.get(rawKey(st?.dataSourceId));
        if(h) handleByFamily.set(family, Math.max(handleByFamily.get(family) || 0, h));
      });
      (Array.isArray(row?.imageVariants) ? row.imageVariants : []).forEach(st => addState(states, st));
      (Array.isArray(row?.rawFormSourceIds) ? row.rawFormSourceIds : []).forEach(src => {
        addAlias(alias, src, family);
        const h = handleBySource.get(rawKey(src));
        if(h) handleByFamily.set(family, Math.max(handleByFamily.get(family) || 0, h));
      });
      const ownHandle = handleBySource.get(rawKey(family));
      if(ownHandle) handleByFamily.set(family, Math.max(handleByFamily.get(family) || 0, ownHandle));
      if(states.length) statesByFamily.set(family, states.slice(0, 3));
    });

    const parentCards = duoDisplay?.parentCards || {};
    for(const [parent, cfg] of Object.entries(parentCards)){
      const parentFamily = alias.get(rawKey(parent)) || alias.get(key(parent)) || norm(parent);
      if(!parentFamily) continue;
      let maxHandle = handleByFamily.get(parentFamily) || 0;
      const parentStates = statesByFamily.get(parentFamily) || [];
      (Array.isArray(cfg?.children) ? cfg.children : []).forEach(child => {
        const childFamily = alias.get(rawKey(child)) || alias.get(key(child)) || norm(child).replace(/\d+$/,'');
        const childHandle = handleByFamily.get(childFamily) || handleBySource.get(rawKey(child)) || handleBySource.get(rawKey(String(child).replace(/\d+$/,''))) || 0;
        maxHandle = Math.max(maxHandle, childHandle);
        const childStates = statesByFamily.get(childFamily) || [];
        childStates.forEach(st => addState(parentStates, st));
        addAlias(alias, child, parentFamily);
        addAlias(alias, childFamily, parentFamily);
      });
      if(parentStates.length) statesByFamily.set(parentFamily, parentStates.slice(0, 3));
      if(maxHandle) handleByFamily.set(parentFamily, maxHandle);
    }

    cache = { alias, statesByFamily, handleByFamily };
    return cache;
  }

  function restoreStates(card, states){
    const visible = (states || []).filter(s => s && s.url).slice(0, 3);
    if(visible.length < 2) return;
    const urls = visible.map(s => s.url);
    const encoded = encodeURIComponent(JSON.stringify(urls));
    const img = card.querySelector('.unitThumb img');
    if(img){
      img.setAttribute('data-imgs', encoded);
      if(!urls.includes(img.getAttribute('src'))) img.setAttribute('src', urls[0]);
      img.setAttribute('data-state', img.getAttribute('data-state') || '0');
    }
    let row = card.querySelector('.stateRow');
    if(!row){
      const host = card.querySelector('.metaMain') || card.querySelector('.metaHeader') || card.querySelector('.meta');
      if(!host) return;
      row = document.createElement('div');
      row.className = 'stateRow';
      host.appendChild(row);
    }
    row.setAttribute('data-imgs', encoded);
    row.innerHTML = urls.map((_, i) => `<button type="button" class="stateBtn ${i === 0 ? 'active' : ''}" data-idx="${i}" aria-label="State ${i + 1}"></button>`).join('');
    row.style.display = '';
  }

  function resortVisibleCards(){
    const grid = document.getElementById('catalogGrid');
    const select = document.getElementById('catalogSort');
    if(!grid || !select || select.value !== 'newest') return;
    const cards = Array.from(grid.querySelectorAll('.unitCard'));
    if(cards.length < 2) return;
    const rank = { characters:0, weapons:1, accessories:2, bosses:3 };
    cards.sort((a, b) => {
      const ka = rank[a.getAttribute('data-kind') || ''] ?? 99;
      const kb = rank[b.getAttribute('data-kind') || ''] ?? 99;
      if(ka !== kb) return ka - kb;
      const ao = Number(a.getAttribute('data-order') || 0);
      const bo = Number(b.getAttribute('data-order') || 0);
      if(ao !== bo) return bo - ao;
      return 0;
    });
    const frag = document.createDocumentFragment();
    cards.forEach(card => frag.appendChild(card));
    grid.appendChild(frag);
  }

  async function apply(){
    if(busy) return;
    busy = true;
    try{
      const grid = document.getElementById('catalogGrid');
      if(!grid) return;
      const data = await load();
      const cards = Array.from(grid.querySelectorAll('.unitCard[data-kind="characters"]'));
      for(const card of cards){
        if(card.getAttribute('data-sort-bypass') === 'duo-child') continue;
        const family = familyForCard(card, data.alias);
        const states = data.statesByFamily.get(family);
        const handle = data.handleByFamily.get(family);
        if(handle) card.setAttribute('data-order', String(handle));
        if(states) restoreStates(card, states);
      }
      resortVisibleCards();
    } finally {
      busy = false;
    }
  }

  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(() => apply().catch(console.warn), 120);
  }

  document.addEventListener('DOMContentLoaded', () => {
    schedule();
    const grid = document.getElementById('catalogGrid');
    if(grid) new MutationObserver(schedule).observe(grid, { childList:true });
    ['catalogSearch','catalogType','catalogSort'].forEach(id => {
      const el = document.getElementById(id);
      if(el){ el.addEventListener('input', schedule); el.addEventListener('change', schedule); }
    });
    setTimeout(schedule, 400);
    setTimeout(schedule, 1200);
  });
})();
