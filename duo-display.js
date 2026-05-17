/* duo-display.js — robust duo/summon/switch/transform card collapse.
   Uses:
   - apkfiles/DuoDisplay.json for preferred UI labels/groups
   - apkfiles/Duo.json for broader summon/switch/transform child visibility
*/
(function(){
  const DISPLAY_URL = './apkfiles/DuoDisplay.json';
  const DUO_URL = './apkfiles/Duo.json';
  let dataPromise = null;
  let renderTimer = null;

  function pageName(){
    const p = String(location.pathname || '').toLowerCase();
    if(p.includes('roster')) return 'roster';
    if(p.includes('optimizer')) return 'optimizer';
    return 'catalog';
  }
  function normId(v){ return String(v ?? '').trim(); }
  function safeText(v){ return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function normName(v){ return String(v || '').toLowerCase().replace(/[\u2019']/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }

  async function fetchJsonOptional(url){
    try{
      const res = await fetch(url, { cache:'no-store' });
      if(!res.ok) return null;
      return await res.json();
    }catch(err){
      console.warn('[DuoDisplay] optional JSON skipped:', url, err);
      return null;
    }
  }

  function makeUF(){
    const parent = new Map();
    const find = (x) => {
      x = normId(x);
      if(!parent.has(x)) parent.set(x, x);
      const p = parent.get(x);
      if(p !== x) parent.set(x, find(p));
      return parent.get(x);
    };
    const union = (a,b) => {
      a = normId(a); b = normId(b);
      if(!a || !b) return;
      const ra = find(a), rb = find(b);
      if(ra !== rb) parent.set(rb, ra);
    };
    return { parent, find, union };
  }

  function addLinksFromMap(uf, map){
    if(!map || typeof map !== 'object') return;
    for(const [parent, kids] of Object.entries(map)){
      if(!Array.isArray(kids)) continue;
      for(const kid of kids) uf.union(parent, kid);
    }
  }

  function buildDuoData(display, duo){
    const uf = makeUF();
    const displayParentCards = display?.parentCards || {};
    const buttonById = new Map();
    const groupById = new Map();
    const explicitChildren = new Set();

    for(const [parent, cfg] of Object.entries(displayParentCards)){
      const children = Array.isArray(cfg?.children) ? cfg.children : [];
      if(cfg?.buttonLabel) buttonById.set(parent, cfg.buttonLabel);
      if(cfg?.group) groupById.set(parent, cfg.group);
      for(const child of children){
        uf.union(parent, child);
        explicitChildren.add(normId(child));
        if(cfg?.buttonLabel) buttonById.set(normId(child), cfg.buttonLabel);
        if(cfg?.group) groupById.set(normId(child), cfg.group);
      }
    }

    // Broad mechanics: include these so summon/switch/transform helper entries do not show as standalone.
    addLinksFromMap(uf, duo?.directSpecificLinks);
    addLinksFromMap(uf, duo?.genericHelperSummons);
    addLinksFromMap(uf, duo?.enemyImposterExchangeUnits);
    addLinksFromMap(uf, duo?.selfCloneOrDuplicateUnits);

    const groups = new Map();
    for(const id of uf.parent.keys()){
      const root = uf.find(id);
      if(!groups.has(root)) groups.set(root, new Set());
      groups.get(root).add(id);
    }

    const childSet = new Set();
    for(const [parent, kids] of Object.entries(displayParentCards)){
      (Array.isArray(kids?.children) ? kids.children : []).forEach(k => childSet.add(normId(k)));
    }
    for(const map of [duo?.directSpecificLinks, duo?.genericHelperSummons, duo?.enemyImposterExchangeUnits, duo?.selfCloneOrDuplicateUnits]){
      if(!map || typeof map !== 'object') continue;
      for(const kids of Object.values(map)) if(Array.isArray(kids)) kids.forEach(k => childSet.add(normId(k)));
    }

    return { display: display || {}, duo: duo || {}, groups, childSet, buttonById, groupById, displayParentCards };
  }

  async function loadDuoData(){
    if(!dataPromise){
      dataPromise = Promise.all([fetchJsonOptional(DISPLAY_URL), fetchJsonOptional(DUO_URL)]).then(([display, duo]) => buildDuoData(display, duo));
    }
    return dataPromise;
  }

  function filterDuoChildren(units, data){
    if(!Array.isArray(units) || !data?.childSet?.size) return units;
    return units.filter(u => !data.childSet.has(normId(u?.id || u?.sourceId || u?.family)));
  }

  function installDataFilter(){
    const data = window.EvertaleData;
    if(!data || data.__duoDisplayPatched) return;
    data.__duoDisplayPatched = true;
    const originalMerged = data.loadCharactersMerged;
    if(typeof originalMerged === 'function'){
      data.loadCharactersMerged = async function(...args){
        const units = await originalMerged.apply(this, args);
        if(pageName() === 'catalog') return units;
        const duoData = await loadDuoData();
        return filterDuoChildren(units, duoData);
      };
    }
  }

  function cardId(card){ return normId(card?.getAttribute('data-id') || card?.getAttribute('data-unit-id') || ''); }
  function cardName(card){ return card?.querySelector('.unitName')?.textContent?.trim() || ''; }
  function cardTitle(card){ return card?.querySelector('.unitTitle')?.textContent?.trim() || ''; }

  function cloneCardPayload(card){
    return {
      id: cardId(card),
      html: card.innerHTML,
      className: card.className,
      dataKind: card.getAttribute('data-kind') || '',
      name: cardName(card),
      title: cardTitle(card),
    };
  }

  function choosePreferredCard(cards, data){
    if(!cards.length) return null;
    if(cards.length === 1) return cards[0];

    // Prefer combined/compound cards such as Beauty & Beast over individual cards.
    let best = null;
    let bestScore = -Infinity;
    for(const card of cards){
      const id = cardId(card);
      const name = normName(cardName(card));
      const title = normName(cardTitle(card));
      const group = normName(data.groupById.get(id) || '');
      let score = 0;
      if(/[&]/.test(cardName(card)) || /\band\b/.test(name)) score += 100;
      if(/beauty.*beast|beast.*beauty/.test(id.toLowerCase()) || /beauty.*beast|beast.*beauty/.test(name)) score += 90;
      if(/snowwhite|snow white/.test(id.toLowerCase()) || /snow white/.test(name)) score += 70;
      if(/new|bride|regular/.test(id.toLowerCase())) score += 8;
      if(group && (group.includes(name) || name.includes(group.split(' ')[0] || ''))) score += 5;
      if(title.includes('pair') || title.includes('duo')) score += 20;
      if(score > bestScore){ bestScore = score; best = card; }
    }
    return best || cards[0];
  }

  function buttonLabelFor(ids, data){
    for(const id of ids){
      const label = data.buttonById.get(id);
      if(label) return label;
    }
    return 'Forms';
  }

  function installButton(parentCard, payloads, label){
    if(parentCard.querySelector('.duoFormBtn')) return;
    const ids = payloads.map(p => p.id).filter(Boolean);
    parentCard.setAttribute('data-duo-parent', 'true');
    parentCard.setAttribute('data-duo-index', '0');
    parentCard.setAttribute('data-duo-ids', JSON.stringify(ids));
    window.__duoPayloads = window.__duoPayloads || new Map();
    window.__duoPayloads.set(cardId(parentCard), payloads);

    const host = parentCard.querySelector('.metaMain') || parentCard.querySelector('.metaHeader') || parentCard.querySelector('.meta') || parentCard;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'duoFormBtn';
    btn.textContent = label;
    btn.addEventListener('click', evt => {
      evt.preventDefault();
      evt.stopPropagation();
      const parentId = cardId(parentCard) || ids[0];
      const list = window.__duoPayloads?.get(parentId) || payloads;
      if(!list.length) return;
      let idx = Number.parseInt(parentCard.getAttribute('data-duo-index') || '0', 10);
      idx = (Number.isFinite(idx) ? idx + 1 : 1) % list.length;
      const chosen = list[idx];
      const keepBtn = btn;
      parentCard.innerHTML = chosen.html;
      parentCard.className = chosen.className;
      parentCard.setAttribute('data-duo-parent', 'true');
      parentCard.setAttribute('data-duo-index', String(idx));
      parentCard.setAttribute('data-duo-ids', JSON.stringify(ids));
      const newHost = parentCard.querySelector('.metaMain') || parentCard.querySelector('.metaHeader') || parentCard.querySelector('.meta') || parentCard;
      keepBtn.textContent = `${label} ${idx + 1}/${list.length}`;
      newHost.appendChild(keepBtn);
    });
    host.appendChild(btn);
  }

  async function collapseCatalogCards(){
    if(pageName() !== 'catalog') return;
    const grid = document.getElementById('catalogGrid');
    if(!grid) return;
    const data = await loadDuoData();
    const allCards = Array.from(grid.querySelectorAll('.unitCard[data-kind="characters"]'));
    if(!allCards.length) return;

    const cardsById = new Map();
    for(const card of allCards){
      const id = cardId(card);
      if(id) cardsById.set(id, card);
      card.hidden = false;
      card.style.display = '';
      card.removeAttribute('data-duo-hidden-child');
    }

    const used = new Set();
    for(const groupSet of data.groups.values()){
      const ids = Array.from(groupSet).filter(Boolean);
      const cards = ids.map(id => cardsById.get(id)).filter(Boolean);
      if(cards.length < 2) continue;
      if(cards.some(c => used.has(c))) continue;
      const parent = choosePreferredCard(cards, data);
      if(!parent) continue;
      const parentId = cardId(parent);
      const ordered = [parent, ...cards.filter(c => c !== parent)];
      const payloads = ordered.map(cloneCardPayload);
      const label = buttonLabelFor(ids, data);
      for(const card of cards){
        used.add(card);
        if(card !== parent){
          card.hidden = true;
          card.style.display = 'none';
          card.setAttribute('data-duo-hidden-child','true');
        }
      }
      installButton(parent, payloads, label);
      parent.setAttribute('data-duo-root-id', parentId);
    }
  }

  function scheduleCollapse(){
    if(pageName() !== 'catalog') return;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => collapseCatalogCards().catch(err => console.warn('[DuoDisplay] collapse failed:', err)), 80);
  }

  function installCatalogObserver(){
    if(pageName() !== 'catalog') return;
    document.addEventListener('DOMContentLoaded', () => {
      scheduleCollapse();
      const grid = document.getElementById('catalogGrid');
      if(!grid) return;
      const obs = new MutationObserver(() => scheduleCollapse());
      obs.observe(grid, { childList:true, subtree:false });
      document.getElementById('catalogSearch')?.addEventListener('input', scheduleCollapse);
      document.getElementById('catalogType')?.addEventListener('change', scheduleCollapse);
      document.getElementById('catalogSort')?.addEventListener('change', scheduleCollapse);
    });
  }

  function injectStyle(){
    if(document.getElementById('duoDisplayStyle')) return;
    const style = document.createElement('style');
    style.id = 'duoDisplayStyle';
    style.textContent = `.duoFormBtn{margin-top:6px;justify-self:start;align-self:start;border:1px solid rgba(255,255,255,.22);background:rgba(28,224,154,.12);color:var(--text,#f6f7ff);border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;cursor:pointer}.duoFormBtn:hover{background:rgba(28,224,154,.2)}.unitCard[data-duo-parent="true"]{outline:1px solid rgba(28,224,154,.35)}.unitCard[data-duo-hidden-child="true"]{display:none!important}`;
    document.head.appendChild(style);
  }

  injectStyle();
  installDataFilter();
  installCatalogObserver();
  window.EvertaleDuoDisplay = { load: loadDuoData, filterDuoChildren };
})();
