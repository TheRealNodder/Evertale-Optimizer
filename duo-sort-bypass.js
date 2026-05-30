/* duo-sort-bypass.js — final display-layer safety bypass for duo child cards.
   Runs with catalog-sort.js. If a user/tool declares a duo parent, child cards are hidden
   from visible catalog display and marked so sort/re-render cycles do not expose them.
*/
(function(){
  const DISPLAY_URL = './apkfiles/DuoDisplay.json';
  const FAMILY_BUNDLE_URL = './apkfiles/entries/bundles/character_families.bundle.json';
  let cache = null;
  let busy = false;
  let timer = null;

  function norm(v){ return String(v || '').trim(); }
  function key(v){ return norm(v).toLowerCase().replace(/\d+$/,'').replace(/[^a-z0-9]+/g,''); }
  function rawKey(v){ return norm(v).toLowerCase().replace(/[^a-z0-9]+/g,''); }
  async function json(url){ try{ const r = await fetch(url, { cache:'no-store' }); return r.ok ? await r.json() : null; }catch{ return null; } }
  function addAlias(alias, k, v){ k = rawKey(k); v = rawKey(v); if(k && v && !alias.has(k)) alias.set(k, v); }
  function aliasOf(alias, id){ const r = rawKey(id); const s = key(id); return alias.get(r) || alias.get(s) || r || s; }

  function buildAlias(bundle){
    const alias = new Map();
    const rows = Array.isArray(bundle?.entries) ? bundle.entries : [];
    for(const row of rows){
      const family = norm(row?.family || row?.id || row?.sourceId);
      if(!family) continue;
      addAlias(alias, family, family);
      addAlias(alias, row?.id, family);
      addAlias(alias, row?.sourceId, family);
      addAlias(alias, row?.name, family);
      addAlias(alias, row?.title, family);
      (Array.isArray(row?.rawFormSourceIds) ? row.rawFormSourceIds : []).forEach(src => {
        addAlias(alias, src, family);
        addAlias(alias, String(src || '').replace(/\d+$/,''), family);
      });
      (Array.isArray(row?.states) ? row.states : []).forEach(st => {
        addAlias(alias, st?.sourceId, family);
        addAlias(alias, st?.dataSourceId, family);
        addAlias(alias, st?.imageSourceId, family);
        addAlias(alias, st?.name, family);
        addAlias(alias, String(st?.sourceId || '').replace(/\d+$/,''), family);
        addAlias(alias, String(st?.dataSourceId || '').replace(/\d+$/,''), family);
      });
      (Array.isArray(row?.imageVariants) ? row.imageVariants : []).forEach(st => {
        addAlias(alias, st?.sourceId, family);
        addAlias(alias, st?.dataSourceId, family);
        addAlias(alias, st?.imageSourceId, family);
      });
    }
    return alias;
  }

  async function load(){
    if(cache) return cache;
    const [display, bundle] = await Promise.all([json(DISPLAY_URL), json(FAMILY_BUNDLE_URL)]);
    const alias = buildAlias(bundle);
    const groups = [];
    const parentCards = display?.parentCards || {};
    for(const [parent, cfg] of Object.entries(parentCards)){
      const children = Array.isArray(cfg?.children) ? cfg.children : [];
      const parentId = aliasOf(alias, parent);
      const childIds = children.map(child => aliasOf(alias, child)).filter(Boolean).filter(child => child !== parentId);
      if(parentId && childIds.length) groups.push({ parentId, childIds, label: cfg?.buttonLabel || 'Forms' });
    }
    cache = { groups, alias };
    return cache;
  }

  function cardIds(card, alias){
    const values = [
      card.getAttribute('data-id'),
      card.getAttribute('data-unit-id'),
      card.querySelector('.unitName')?.textContent,
      card.querySelector('.unitTitle')?.textContent,
    ];
    const ids = new Set();
    values.forEach(v => { const a = aliasOf(alias, v); if(a) ids.add(a); });
    return ids;
  }

  async function applyBypass(){
    if(busy) return;
    busy = true;
    try{
      const grid = document.getElementById('catalogGrid');
      if(!grid) return;
      const { groups, alias } = await load();
      if(!groups.length) return;
      const cards = Array.from(grid.querySelectorAll('.unitCard[data-kind="characters"]'));
      if(!cards.length) return;

      const records = cards.map(card => ({ card, ids: cardIds(card, alias) }));
      const hasId = (record, id) => record.ids.has(id);

      // Reset only the bypass flags owned by this script. The data-loader collapse can still hide rows earlier.
      records.forEach(({card}) => {
        if(card.getAttribute('data-sort-bypass') === 'duo-child'){
          card.hidden = false;
          card.style.display = '';
          card.removeAttribute('data-sort-bypass');
          card.removeAttribute('data-duo-hidden-child');
        }
      });

      for(const group of groups){
        const parent = records.find(record => hasId(record, group.parentId));
        if(!parent) continue;
        parent.card.setAttribute('data-duo-parent', 'true');
        parent.card.setAttribute('data-duo-label', group.label || 'Forms');
        for(const childId of group.childIds){
          records.forEach(record => {
            if(record.card === parent.card) return;
            if(!hasId(record, childId)) return;
            record.card.hidden = true;
            record.card.style.display = 'none';
            record.card.setAttribute('data-sort-bypass', 'duo-child');
            record.card.setAttribute('data-duo-hidden-child', 'true');
            record.card.setAttribute('aria-hidden', 'true');
          });
        }
      }
    } finally {
      busy = false;
    }
  }

  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(() => applyBypass().catch(console.warn), 80);
  }

  function style(){
    if(document.getElementById('duoSortBypassStyle')) return;
    const s = document.createElement('style');
    s.id = 'duoSortBypassStyle';
    s.textContent = '.unitCard[data-sort-bypass="duo-child"],.unitCard[data-duo-hidden-child="true"]{display:none!important}.unitCard[data-duo-parent="true"]{outline:1px solid rgba(28,224,154,.35)}';
    document.head.appendChild(s);
  }

  document.addEventListener('DOMContentLoaded', () => {
    style();
    schedule();
    const grid = document.getElementById('catalogGrid');
    if(grid) new MutationObserver(schedule).observe(grid, { childList:true, subtree:false });
    ['catalogSearch','catalogType','catalogSort'].forEach(id => {
      const el = document.getElementById(id);
      if(el){ el.addEventListener('input', schedule); el.addEventListener('change', schedule); }
    });
    window.addEventListener('pageshow', schedule);
    setTimeout(schedule, 300);
    setTimeout(schedule, 1000);
  });
})();
