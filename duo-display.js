/* duo-display.js — collapse duo/summon/switch/transform child units in UI.
   Uses apkfiles/DuoDisplay.json as the UI-facing canonical map.
   Catalog: hide child cards and add a form button on parent cards.
   Roster/Optimizer: filter child units out of loadCharactersMerged pools.
*/
(function(){
  const DUO_URL = './apkfiles/DuoDisplay.json';
  let duoPromise = null;
  let characterPromise = null;

  function pageName(){
    const p = String(location.pathname || '').toLowerCase();
    if (p.includes('roster')) return 'roster';
    if (p.includes('optimizer')) return 'optimizer';
    return 'catalog';
  }

  function safeText(v){
    return String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function normId(v){ return String(v ?? '').trim(); }

  async function fetchJsonOptional(url){
    try{
      const res = await fetch(url, { cache: 'no-store' });
      if(!res.ok) return null;
      return await res.json();
    }catch(err){
      console.warn('[DuoDisplay] Optional load failed:', url, err);
      return null;
    }
  }

  async function loadDuoDisplay(){
    if(!duoPromise){
      duoPromise = fetchJsonOptional(DUO_URL).then(json => {
        const parentCards = json?.parentCards || {};
        const childToParent = new Map();
        const childSet = new Set();
        for(const [parentId, cfg] of Object.entries(parentCards)){
          for(const childId of (Array.isArray(cfg?.children) ? cfg.children : [])){
            const child = normId(childId);
            if(!child) continue;
            childSet.add(child);
            if(!childToParent.has(child)) childToParent.set(child, parentId);
          }
        }
        return { raw: json || {}, parentCards, childToParent, childSet };
      });
    }
    return duoPromise;
  }

  function filterDuoChildren(units, duo){
    if(!Array.isArray(units) || !duo?.childSet?.size) return units;
    return units.filter(u => !duo.childSet.has(normId(u?.id || u?.sourceId || u?.family)));
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
        const duo = await loadDuoDisplay();
        return filterDuoChildren(units, duo);
      };
    }
  }

  function imageUrlsFromCharacter(u){
    const variants = Array.isArray(u?.imageVariants) ? u.imageVariants.map(v => v && v.url).filter(Boolean) : [];
    const large = Array.isArray(u?.imagesLarge) ? u.imagesLarge.filter(Boolean) : [];
    return variants.length ? variants : (large.length ? large : (u?.image ? [u.image] : []));
  }

  async function loadCharactersForCatalog(){
    if(characterPromise) return characterPromise;
    characterPromise = (async () => {
      const data = window.EvertaleData;
      let rows = [];
      try{
        if(data && typeof data.loadAllEntries === 'function'){
          const entries = await data.loadAllEntries();
          rows = Array.isArray(entries?.characters) ? entries.characters : [];
        }
        if(!rows.length && data && typeof data.loadCharactersMerged === 'function'){
          rows = await data.loadCharactersMerged();
        }
      }catch(err){ console.warn('[DuoDisplay] Character load fallback failed:', err); }
      const map = new Map();
      for(const u of rows || []){
        const id = normId(u?.id || u?.sourceId || u?.family);
        if(id && !map.has(id)) map.set(id, u);
      }
      return map;
    })();
    return characterPromise;
  }

  function skillMetaText(skill){
    const parts=[];
    if(skill && skill.tu !== undefined && skill.tu !== null && skill.tu !== '') parts.push(String(skill.tu)+' TU');
    const sp = skill ? (skill.sp ?? skill.spirit) : null;
    if(sp !== undefined && sp !== null && sp !== '') parts.push((Number(sp)>0?'+':'')+String(sp)+' SP');
    if(skill && skill.targeting) parts.push(String(skill.targeting));
    return parts.join(' • ');
  }

  function skillBoxes(title, rows, kindClass){
    const skills = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if(!skills.length) return '';
    return `<div class="panel skillPanel ${safeText(kindClass || '')}"><div class="panelTitle">${safeText(title)}</div><div class="skillBoxList">${skills.map(s => {
      const name = safeText(s?.name || 'Unnamed');
      const meta = safeText(skillMetaText(s));
      const desc = safeText(s?.description || '').replace(/\n/g,'<br>');
      return `<div class="skillBox"><div class="skillBoxHead"><strong>${name}</strong>${meta?`<span>${meta}</span>`:''}</div>${desc?`<div class="skillBoxText">${desc}</div>`:''}</div>`;
    }).join('')}</div></div>`;
  }

  function normalizeElementDisplay(el){
    const raw = String(el || '').trim();
    return raw ? raw.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : '';
  }

  function updateCatalogCard(card, unit){
    if(!card || !unit) return;
    const name = unit.name || unit.id || '';
    const title = unit.title || unit.subtitle || '';
    const imgs = imageUrlsFromCharacter(unit);
    const imgUrl = imgs[0] || unit.image || '';
    const thumb = card.querySelector('.unitThumb');
    if(thumb){
      thumb.innerHTML = imgUrl ? `<img src="${safeText(imgUrl)}" alt="${safeText(name)}" loading="lazy" decoding="async">` : `<div class="ph">?</div>`;
    }
    const nameEl = card.querySelector('.unitName');
    if(nameEl) nameEl.textContent = name;
    const titleEl = card.querySelector('.unitTitle');
    if(titleEl) titleEl.textContent = title;
    const chipCol = card.querySelector('.chipCol');
    if(chipCol){
      chipCol.innerHTML = `<span class="tag kind">Character</span>${unit.element?`<span class="tag element">${safeText(normalizeElementDisplay(unit.element))}</span>`:''}${unit.rarity?`<span class="tag rarity">${safeText(unit.rarity)}</span>`:''}`;
    }
    const statLine = card.querySelector('.statLine');
    const atk = unit.atk ?? unit.stats?.atk ?? '';
    const hp = unit.hp ?? unit.stats?.hp ?? '';
    const spd = unit.spd ?? unit.stats?.spd ?? '';
    const cost = unit.cost ?? unit.stats?.cost ?? '';
    if(statLine){
      const parts = [];
      if(atk !== '' && atk != null) parts.push(`<div class="stat"><span class="statLabel">ATK</span><span class="statVal">${safeText(atk)}</span></div>`);
      if(hp !== '' && hp != null) parts.push(`<div class="stat"><span class="statLabel">HP</span><span class="statVal">${safeText(hp)}</span></div>`);
      if(spd !== '' && spd != null) parts.push(`<div class="stat"><span class="statLabel">SPD</span><span class="statVal">${safeText(spd)}</span></div>`);
      if(cost !== '' && cost != null) parts.push(`<div class="stat"><span class="statLabel">COST</span><span class="statVal">${safeText(cost)}</span></div>`);
      statLine.innerHTML = parts.join('');
    }
    const leaderName = card.querySelector('.leaderName');
    if(leaderName) leaderName.textContent = unit.leaderSkill?.name || 'No Leader Skill';
    const leaderDesc = card.querySelector('.leaderDesc');
    if(leaderDesc) leaderDesc.textContent = unit.leaderSkill?.description || 'This unit does not provide a leader skill.';
    const descText = card.querySelector('.descriptionText');
    if(descText) descText.textContent = unit.description || unit.flavorText || '';
    const details = card.querySelector('.unitDetails');
    if(details){
      details.querySelectorAll('.activeSkillPanel,.passiveSkillPanel').forEach(el => el.remove());
      details.insertAdjacentHTML('beforeend', skillBoxes('Active Skills', unit.activeSkills, 'activeSkillPanel'));
      details.insertAdjacentHTML('beforeend', skillBoxes('Passive Skills', unit.passiveSkillDetails, 'passiveSkillPanel'));
    }
  }

  async function enhanceCatalog(){
    if(pageName() !== 'catalog') return;
    const grid = document.getElementById('catalogGrid');
    if(!grid) return;
    const duo = await loadDuoDisplay();
    if(!duo?.parentCards) return;
    const characters = await loadCharactersForCatalog();

    grid.querySelectorAll('.unitCard[data-kind="characters"]').forEach(card => {
      const id = normId(card.getAttribute('data-id'));
      if(duo.childSet.has(id)){
        card.hidden = true;
        card.setAttribute('data-duo-hidden-child','true');
        return;
      }
      const cfg = duo.parentCards[id];
      if(!cfg || !Array.isArray(cfg.children) || !cfg.children.length) return;
      if(card.querySelector('.duoFormBtn')) return;
      const forms = [id, ...cfg.children].filter(Boolean);
      card.setAttribute('data-duo-parent','true');
      card.setAttribute('data-duo-forms', JSON.stringify(forms));
      card.setAttribute('data-duo-index','0');
      const host = card.querySelector('.metaMain') || card.querySelector('.metaHeader') || card.querySelector('.meta');
      if(!host) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'duoFormBtn';
      btn.textContent = cfg.buttonLabel || 'Forms';
      btn.title = cfg.group || 'Linked forms';
      btn.addEventListener('click', evt => {
        evt.preventDefault();
        evt.stopPropagation();
        let idx = Number.parseInt(card.getAttribute('data-duo-index') || '0', 10);
        idx = (Number.isFinite(idx) ? idx + 1 : 1) % forms.length;
        card.setAttribute('data-duo-index', String(idx));
        const activeId = forms[idx];
        const unit = characters.get(activeId);
        updateCatalogCard(card, unit);
        btn.textContent = `${cfg.buttonLabel || 'Forms'} ${idx + 1}/${forms.length}`;
      });
      host.appendChild(btn);
    });
  }

  function installCatalogObserver(){
    if(pageName() !== 'catalog') return;
    const run = () => enhanceCatalog().catch(err => console.warn('[DuoDisplay] Catalog enhance failed:', err));
    document.addEventListener('DOMContentLoaded', () => {
      run();
      const grid = document.getElementById('catalogGrid');
      if(!grid) return;
      const obs = new MutationObserver(() => run());
      obs.observe(grid, { childList: true });
    });
  }

  function injectStyle(){
    if(document.getElementById('duoDisplayStyle')) return;
    const style = document.createElement('style');
    style.id = 'duoDisplayStyle';
    style.textContent = `.duoFormBtn{margin-top:6px;justify-self:start;align-self:start;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.065);color:var(--text,#f6f7ff);border-radius:999px;padding:5px 9px;font-size:11px;font-weight:850;cursor:pointer}.duoFormBtn:hover{background:rgba(255,255,255,.12)}.unitCard[data-duo-parent="true"]{outline:1px solid rgba(109,231,183,.14)}`;
    document.head.appendChild(style);
  }

  injectStyle();
  installDataFilter();
  installCatalogObserver();
  window.EvertaleDuoDisplay = { load: loadDuoDisplay, filterDuoChildren };
})();
