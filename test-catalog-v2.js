/* test-catalog-v2.js — V2 hero/details bridge. */
(function(){
  const ENTRY_BASE = './apkfiles/entries';
  const CATEGORIES = ['characters','weapons','accessories','bosses'];
  let descMap = null;
  let activeCard = null;
  const $ = id => document.getElementById(id);
  const clean = v => String(v || '').toLowerCase().replace(/\d+$/,'').replace(/[^a-z0-9]+/g,'');
  const directKey = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g,'');
  function loadElementNormalizer(){
    if(!document.querySelector('link[data-v2-element-surface]')){
      const l=document.createElement('link');
      l.rel='stylesheet';
      l.href='./test-catalog-v2-elements.css?v=2';
      l.setAttribute('data-v2-element-surface','1');
      document.head.appendChild(l);
    }
    if(window.EvertaleElementReference) return;
    const s=document.createElement('script');
    s.src='./element-normalizer.js?v=1';
    s.defer=true;
    document.head.appendChild(s);
  }
  async function fetchJson(url){ const r = await fetch(`${url}?v=1780518798`, { cache:'no-store' }); if(!r.ok) return null; return await r.json(); }
  function addMap(m, key, rows){ const keys=[key, clean(key), directKey(key)].filter(Boolean); keys.forEach(k=>{ if(k && rows?.length && !m.has(k)) m.set(k, rows); }); }
  function rowsFromEntry(e){
    if(Array.isArray(e?.states) && e.states.length) return e.states.map(s => ({ title:s.title||e.title||'', name:s.name||e.name||'', description:s.description||e.description||'', sourceId:s.sourceId||s.dataSourceId||e.sourceId||e.internal?.sourceId||'', image:s.image||s.url||e.image||'' }));
    if(Array.isArray(e?.forms) && e.forms.length) return e.forms.map(s => ({ title:s.title||e.title||'', name:s.name||e.name||'', description:s.description||e.description||'', sourceId:s.sourceId||s.dataSourceId||e.sourceId||e.internal?.sourceId||'', image:s.image||s.url||e.image||'' }));
    const resolvedText = Object.values(e?.resolved?.activeSkills || {}).map(x => x?.localization?.description || '').filter(Boolean).join('\n\n');
    return [{ title:e.title||'', name:e.name||e.displayName||'', description:e.description||e.effect||e.profile||e.raw?.profile||resolvedText||'', sourceId:e.sourceId||e.internal?.sourceId||e.name||e.id||'', image:e.image||'' }];
  }
  async function loadDescMap(){
    if(descMap) return descMap;
    const m = new Map();
    for(const cat of CATEGORIES){
      const bundle = await fetchJson(`${ENTRY_BASE}/bundles/${cat}.bundle.json`);
      const rows = Array.isArray(bundle?.entries) ? bundle.entries : [];
      rows.forEach(e => {
        const descRows = rowsFromEntry(e).filter(Boolean);
        [e.family,e.id,e.sourceId,e.internal?.sourceId,e.name,e.displayName,e.title,e.sortName].forEach(v => addMap(m, v, descRows));
        descRows.forEach(s => [s.sourceId,s.name,s.title].forEach(v => addMap(m, v, descRows)));
      });
    }
    descMap = m;
    return m;
  }
  function text(sel,root=document){return root.querySelector(sel)?.textContent?.trim()||''}
  function htmlText(sel,root=document){return root.querySelector(sel)?.innerHTML?.trim()||''}
  function cardKeyList(card){return [card.getAttribute('data-duo-root'),card.getAttribute('data-duo-active-id'),card.getAttribute('data-source-id'),card.getAttribute('data-id'),card.getAttribute('data-family'),text('.unitName',card),text('.unitTitle',card)].flatMap(v=>[v,clean(v),directKey(v)]).filter(Boolean)}
  function exactStat(card, stat){return card?.querySelector(`.stat[data-stat="${stat}"] .statVal`)?.textContent?.trim()||'—'}
  function pills(card){return [...card.querySelectorAll('.tag')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,5)}
  function activeIdx(card){return parseInt(card.querySelector('.stateBtn.active')?.getAttribute('data-idx')||card.querySelector('.unitThumb img')?.getAttribute('data-state')||card.getAttribute('data-duo-index')||'0',10)||0}
  function ensureSkillActions(){
    if($('v2SkillActions'))return;
    const stats=$('v2Cost')?.closest('.v2-stats');
    if(!stats)return;
    stats.insertAdjacentHTML('afterend','<div class="v2-skill-actions" id="v2SkillActions"><button type="button" class="v2-skill-action" data-v2-skill="active">Active Skills</button><button type="button" class="v2-skill-action" data-v2-skill="passive">Passive Skills</button></div>');
  }
  function setHero(card,rows){
    activeCard=card;
    ensureSkillActions();
    const img=card.querySelector('.unitThumb img')?.src||'';
    $('v2FeatureArt').innerHTML=img?`<img src="${img}" alt="" loading="lazy" decoding="async">`:'<div class="v2-feature-empty">No image</div>';
    $('v2Kind').textContent=card.getAttribute('data-kind')||card.getAttribute('data-type')||'Catalog';
    $('v2Name').textContent=text('.unitName',card)||'Unknown';
    $('v2Title').textContent=text('.unitTitle',card)||'';
    $('v2Pills').innerHTML=pills(card).map(p=>`<span class="v2-pill">${p}</span>`).join('');
    $('v2Hp').textContent=exactStat(card,'hp');
    $('v2Atk').textContent=exactStat(card,'atk');
    $('v2Spd').textContent=exactStat(card,'spd');
    $('v2Cost').textContent=exactStat(card,'cost');
    const idx=Math.min(activeIdx(card),Math.max((rows||[]).length-1,0));
    $('v2AwakenTabs').innerHTML=(rows||[]).map((r,i)=>`<button type="button" class="${i===idx?'active':''}" data-v2-idx="${i}">${i+1}</button>`).join('');
    $('v2Desc').textContent=(rows&&rows[idx]&&(rows[idx].description||rows[idx].title||''))||text('.descriptionText',card)||text('.leaderDesc',card)||'No description loaded for this state.';
  }
  async function selectCard(card){if(!card)return;document.querySelectorAll('.unitCard.v2-selected').forEach(c=>c.classList.remove('v2-selected'));card.classList.add('v2-selected');const map=await loadDescMap();let rows=[];for(const key of cardKeyList(card)){rows=map.get(key)||[];if(rows.length)break;}setHero(card,rows)}
  function ensureSkillPrompt(){
    let pop=$('v2SkillPop');
    if(pop)return pop;
    document.body.insertAdjacentHTML('beforeend','<div class="v2-skill-pop" id="v2SkillPop" aria-hidden="true"><div class="v2-skill-card"><div class="v2-skill-head"><h3 id="v2SkillTitle">Skills</h3><button type="button" class="v2-skill-close" id="v2SkillClose" aria-label="Close">×</button></div><div class="v2-skill-list" id="v2SkillList"></div></div></div>');
    pop=$('v2SkillPop');
    $('v2SkillClose')?.addEventListener('click',closeSkillPrompt);
    pop.addEventListener('click',e=>{if(e.target===pop)closeSkillPrompt();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSkillPrompt();});
    return pop;
  }
  function closeSkillPrompt(){const pop=$('v2SkillPop'); if(pop){pop.classList.remove('open'); pop.setAttribute('aria-hidden','true');}}
  function extractSkills(card,type){
    const panel=card?.querySelector(type==='active'?'.activeSkillPanel':'.passiveSkillPanel');
    const boxes=[...(panel?.querySelectorAll('.skillBox')||[])];
    return boxes.map(box=>({name:text('strong',box)||'Unnamed Skill',meta:text('.skillBoxHead span',box),desc:htmlText('.skillBoxText',box).replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').trim()}));
  }
  function openSkillPrompt(type){
    const card=activeCard||document.querySelector('.unitCard.v2-selected')||document.querySelector('.unitCard');
    if(!card)return;
    const skills=extractSkills(card,type);
    const pop=ensureSkillPrompt();
    const title=type==='active'?'Active Skills':'Passive Skills';
    $('v2SkillTitle').textContent=`${text('.unitName',card)||'Selected'} — ${title}`;
    $('v2SkillList').innerHTML=skills.length?skills.map(s=>`<div class="v2-skill-item"><strong>${s.name}</strong>${s.meta?`<span>${s.meta}</span>`:''}<p>${s.desc||'No description loaded.'}</p></div>`).join(''):`<div class="v2-skill-item"><strong>No ${title}</strong><p>No ${title.toLowerCase()} were found on this entry.</p></div>`;
    pop.classList.add('open');
    pop.setAttribute('aria-hidden','false');
  }
  function wire(){
    loadElementNormalizer();
    const grid=$('catalogGrid');if(!grid)return;
    document.addEventListener('click',e=>{const btn=e.target.closest('[data-v2-skill]'); if(btn)openSkillPrompt(btn.getAttribute('data-v2-skill'));});
    grid.addEventListener('click',e=>{const card=e.target.closest('.unitCard');if(card)setTimeout(()=>selectCard(card),70)});
    grid.addEventListener('click',e=>{if(e.target.closest('.stateBtn,.duoFormBtn')){const card=e.target.closest('.unitCard');setTimeout(()=>selectCard(card),120)}});
    $('v2AwakenTabs')?.addEventListener('click',async e=>{const btn=e.target.closest('button');const card=document.querySelector('.unitCard.v2-selected');if(!btn||!card)return;const map=await loadDescMap();let rows=[];for(const key of cardKeyList(card)){rows=map.get(key)||[];if(rows.length)break;}[...$('v2AwakenTabs').children].forEach((b,i)=>b.classList.toggle('active',i===Number(btn.dataset.v2Idx)));$('v2Desc').textContent=rows[Number(btn.dataset.v2Idx)]?.description||'No description loaded for this state.'});
    new MutationObserver(()=>{const cards=document.querySelectorAll('.unitCard');$('v2Count').textContent=cards.length?`• ${cards.length} visible`:'';if(!document.querySelector('.unitCard.v2-selected')&&cards[0])selectCard(cards[0]);window.EvertaleElementReference?.normalizeAll?.();}).observe(grid,{childList:true});
    setTimeout(()=>{const first=document.querySelector('.unitCard');if(first)selectCard(first);window.EvertaleElementReference?.normalizeAll?.();},1200);
  }
  document.addEventListener('DOMContentLoaded',wire);
})();
