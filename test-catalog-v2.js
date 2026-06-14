/* test-catalog-v2.js — V2 hero/details bridge. */
(function(){
  const ENTRY_BASE = './apkfiles/entries';
  const CATEGORIES = ['characters','weapons','accessories','bosses'];
  let descMap = null;
  let activeCard = null;
  let v2AwakenPointerHandled = false;
  let activeSidebarDetailKind = 'leader';
  const $ = id => document.getElementById(id);
  const clean = v => String(v || '').toLowerCase().replace(/\d+$/,'').replace(/[^a-z0-9]+/g,'');
  const directKey = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g,'');

  function hasStylesheet(file){
    return [...document.querySelectorAll('link[rel="stylesheet"]')].some(l => String(l.getAttribute('href') || '').includes(file));
  }

  function loadElementNormalizer(){
    if(!document.querySelector('link[data-v2-element-surface]') && !hasStylesheet('test-catalog-v2-elements.css')){
      const l=document.createElement('link');
      l.rel='stylesheet';
      l.href='./test-catalog-v2-elements.css?v=4';
      l.setAttribute('data-v2-element-surface','1');
      document.head.appendChild(l);
    }
    if(!document.querySelector('link[data-v2-theme]') && !hasStylesheet('test-catalog-v2-theme.css')){
      const t=document.createElement('link');
      t.rel='stylesheet';
      t.href='./test-catalog-v2-theme.css?v=2';
      t.setAttribute('data-v2-theme','1');
      document.head.appendChild(t);
    }
    if(!document.querySelector('link[data-v2-mobile]') && !hasStylesheet('test-catalog-v2-mobile.css')){
      const m=document.createElement('link');
      m.rel='stylesheet';
      m.href='./test-catalog-v2-mobile.css?v=2';
      m.setAttribute('data-v2-mobile','1');
      document.head.appendChild(m);
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

  function addEntryRows(m,e){
    const descRows = rowsFromEntry(e).filter(Boolean);
    [e.family,e.id,e.sourceId,e.internal?.sourceId,e.name,e.displayName,e.title,e.sortName].forEach(v => addMap(m, v, descRows));
    descRows.forEach(s => [s.sourceId,s.name,s.title].forEach(v => addMap(m, v, descRows)));
  }

  async function loadDescMap(){
    if(descMap) return descMap;
    const m = new Map();
    const familyBundle = await fetchJson(`${ENTRY_BASE}/bundles/character_families.bundle.json`);
    (Array.isArray(familyBundle?.entries) ? familyBundle.entries : []).forEach(addEntryRows.bind(null,m));
    for(const cat of CATEGORIES){
      const bundle = await fetchJson(`${ENTRY_BASE}/bundles/${cat}.bundle.json`);
      const rows = Array.isArray(bundle?.entries) ? bundle.entries : [];
      rows.forEach(addEntryRows.bind(null,m));
    }
    descMap = m;
    return m;
  }

  function text(sel,root=document){return root.querySelector(sel)?.textContent?.trim()||''}
  function htmlText(sel,root=document){return root.querySelector(sel)?.innerHTML?.trim()||''}
  function imgKey(card){return clean(String(card?.querySelector('.unitThumb img')?.src||'').split('/').pop()?.replace(/\.png(?:\?.*)?$/i,'')||'')}
  function cardKeyList(card){return [card.getAttribute('data-duo-root'),card.getAttribute('data-duo-active-id'),card.getAttribute('data-source-id'),card.getAttribute('data-id'),card.getAttribute('data-family'),imgKey(card),text('.unitName',card),text('.unitTitle',card)].flatMap(v=>[v,clean(v),directKey(v)]).filter(Boolean)}
  function exactStat(card, stat){return card?.querySelector(`.stat[data-stat="${stat}"] .statVal`)?.textContent?.trim()||'—'}
  function pills(card){return [...card.querySelectorAll('.tag')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,5)}
  function activeIdx(card){return parseInt(card.querySelector('.stateBtn.active')?.getAttribute('data-idx')||card.querySelector('.unitThumb img')?.getAttribute('data-state')||card.getAttribute('data-duo-index')||'0',10)||0}
  function safeIdx(value,max){const n=Number(value);if(!Number.isFinite(n))return 0;return Math.max(0,Math.min(Math.max(max-1,0),Math.floor(n)));}
  function heroImgHtml(src){return src?`<img src="${src}" alt="" loading="lazy" decoding="async">`:'<div class="v2-feature-empty">No image</div>';}
  function setHeroImage(src){
    const host=$('v2FeatureArt');
    if(!host)return;
    const img=host.querySelector('img');
    if(img&&src){if(img.src!==src)img.src=src;return;}
    host.innerHTML=heroImgHtml(src);
  }
  function setText(id,value){const node=$(id);if(node&&node.textContent!==String(value??''))node.textContent=String(value??'');}
  function safeHtml(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/\n/g,'<br>');}

  function ensureSkillActions(){
    if($('v2SkillActions'))return;
    const stats=$('v2Cost')?.closest('.v2-stats');
    if(!stats)return;
    stats.insertAdjacentHTML('afterend','<div class="v2-skill-actions" id="v2SkillActions"><button type="button" class="v2-skill-action" data-v2-skill="active">Active Skills</button><button type="button" class="v2-skill-action" data-v2-skill="passive">Passive Skills</button></div>');
  }

  function ensureSidebarDetails(){
    const description=document.querySelector('.v2-description');
    if(!description)return null;
    let head=description.querySelector('.v2-desc-head');
    if(!head){head=document.createElement('div');head.className='v2-desc-head';description.insertBefore(head,description.firstChild);}
    let tabs=description.querySelector('.v2-detail-tabs');
    if(!tabs){tabs=document.createElement('div');tabs.className='v2-detail-tabs';head.appendChild(tabs);}
    const existing=tabs.querySelector('.v2-detail-tab-btn.active')?.getAttribute('data-v2-detail-kind');
    if(existing)activeSidebarDetailKind=existing;
    const specs=[['leader','Leader Skill'],['active','Active Skill'],['passive','Passive Skill'],['description','Description']];
    tabs.innerHTML=specs.map(([kind,label])=>`<button type="button" class="v2-detail-tab-btn${kind===activeSidebarDetailKind?' active':''}" data-v2-detail-kind="${kind}">${label}</button>`).join('');
    let panel=description.querySelector('.v2-detail-scroll-panel');
    if(!panel){panel=document.createElement('div');panel.className='v2-detail-scroll-panel';description.appendChild(panel);}
    return panel;
  }

  function skillDetailHtml(card,type){
    const rows=extractSkills(card,type);
    return rows.length?rows.map(s=>`<p><strong>${safeHtml(s.name||'Skill')}</strong>${s.meta?`<br><span>${safeHtml(s.meta)}</span>`:''}<br>${safeHtml(s.desc||'No description loaded.')}</p>`).join(''):'<p>No skills loaded.</p>';
  }
  function leaderDetailHtml(card){
    const name=text('.leaderName',card)||'Leader Skill';
    const desc=text('.leaderDesc',card)||'No leader skill loaded.';
    return `<p><strong>${safeHtml(name)}</strong><br>${safeHtml(desc)}</p>`;
  }
  function renderSidebarDetail(kind=activeSidebarDetailKind){
    const panel=ensureSidebarDetails();
    if(!panel)return;
    const card=document.querySelector('.unitCard.v2-selected')||activeCard||document.querySelector('.unitCard');
    activeSidebarDetailKind=kind||'leader';
    document.querySelectorAll('.v2-detail-tab-btn').forEach(btn=>btn.classList.toggle('active',btn.getAttribute('data-v2-detail-kind')===activeSidebarDetailKind));
    const html=activeSidebarDetailKind==='leader'?leaderDetailHtml(card):activeSidebarDetailKind==='active'?skillDetailHtml(card,'active'):activeSidebarDetailKind==='passive'?skillDetailHtml(card,'passive'):`<p>${safeHtml($('v2Desc')?.textContent||text('.descriptionText',card)||'No description loaded.')}</p>`;
    if(panel.innerHTML!==html)panel.innerHTML=html;
  }

  function setHero(card,rows){
    activeCard=card;
    ensureSkillActions();
    const img=card.querySelector('.unitThumb img')?.src||'';
    setHeroImage(img);
    setText('v2Kind',card.getAttribute('data-kind')||card.getAttribute('data-type')||'Catalog');
    setText('v2Name',text('.unitName',card)||'Unknown');
    setText('v2Title',text('.unitTitle',card)||'');
    const pillsHtml=pills(card).map(p=>`<span class="v2-pill">${p}</span>`).join('');
    if($('v2Pills')&&$('v2Pills').innerHTML!==pillsHtml)$('v2Pills').innerHTML=pillsHtml;
    setText('v2Hp',exactStat(card,'hp'));
    setText('v2Atk',exactStat(card,'atk'));
    setText('v2Spd',exactStat(card,'spd'));
    setText('v2Cost',exactStat(card,'cost'));
    const idx=Math.min(activeIdx(card),Math.max((rows||[]).length-1,0));
    const tabsHtml=(rows||[]).map((r,i)=>`<button type="button" class="${i===idx?'active':''}" data-v2-idx="${i}" data-awaken-index="${i}" aria-pressed="${i===idx?'true':'false'}">${i+1}</button>`).join('');
    if($('v2AwakenTabs')&&$('v2AwakenTabs').innerHTML!==tabsHtml)$('v2AwakenTabs').innerHTML=tabsHtml;
    setText('v2Desc',(rows&&rows[idx]&&(rows[idx].description||rows[idx].title||''))||text('.descriptionText',card)||'No description loaded for this state.');
    renderSidebarDetail(activeSidebarDetailKind);
  }

  async function selectCard(card){if(!card)return;document.querySelectorAll('.unitCard.v2-selected').forEach(c=>c.classList.remove('v2-selected'));card.classList.add('v2-selected');const map=await loadDescMap();let rows=[];for(const key of cardKeyList(card)){rows=map.get(key)||[];if(rows.length)break;}setHero(card,rows)}
  function syncV2TabState(idx){const tabs=$('v2AwakenTabs');if(!tabs)return;[...tabs.children].forEach((b,i)=>{b.classList.toggle('active',i===idx);b.setAttribute('aria-pressed',String(i===idx));b.dataset.v2Idx=String(i);b.dataset.awakenIndex=String(i);});}

  function setCardImageState(card,idx){
    const buttons=[...card.querySelectorAll('.stateRow .stateBtn')];
    const btn=buttons.find(b=>Number(b.getAttribute('data-idx'))===idx)||buttons[idx];
    if(!btn)return false;
    const row=btn.closest('.stateRow');
    let imgs=[];
    try{imgs=JSON.parse(decodeURIComponent(row?.getAttribute('data-imgs')||'[]'));}catch{imgs=[];}
    const img=card.querySelector('.unitThumb img');
    if(img&&imgs[idx]){if(img.src!==imgs[idx])img.src=imgs[idx];img.setAttribute('data-state',String(idx));}
    buttons.forEach(b=>b.classList.toggle('active',b===btn));
    card.setAttribute('data-duo-index',String(idx));
    return true;
  }

  async function applyV2AwakenButton(btn){
    const card=document.querySelector('.unitCard.v2-selected')||activeCard||document.querySelector('.unitCard');
    if(!btn||!card)return;
    const max=Math.max($('v2AwakenTabs')?.children.length||0,card.querySelectorAll('.stateRow .stateBtn').length||0,3);
    const idx=safeIdx(btn.dataset.v2Idx ?? btn.dataset.awakenIndex ?? btn.getAttribute('data-idx') ?? 0,max);
    setCardImageState(card,idx);
    syncV2TabState(idx);
    const img=card.querySelector('.unitThumb img')?.src||'';
    setHeroImage(img);
    setText('v2Hp',exactStat(card,'hp'));
    setText('v2Atk',exactStat(card,'atk'));
    setText('v2Spd',exactStat(card,'spd'));
    setText('v2Cost',exactStat(card,'cost'));
    const map=await loadDescMap();
    let rows=[];
    for(const key of cardKeyList(card)){rows=map.get(key)||[];if(rows.length)break;}
    setText('v2Desc',rows[idx]?.description||rows[idx]?.title||text('.descriptionText',card)||'No description loaded for this state.');
    renderSidebarDetail(activeSidebarDetailKind);
    document.dispatchEvent(new CustomEvent('v2:hero-state-change',{detail:{index:idx,card}}));
  }

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
  function readSkillDataAttr(card,type){
    try{
      const attr=type==='active'?'data-active-skills':'data-passive-skills';
      const rows=JSON.parse(decodeURIComponent(card?.getAttribute(attr)||''));
      return Array.isArray(rows)?rows.map(s=>({name:s.name||s.id||'Unnamed Skill',meta:[s.tu?`${s.tu} TU`:'',s.sp!==undefined?`${Number(s.sp)>0?'+':''}${s.sp} SP`:''].filter(Boolean).join(' • '),desc:s.description||''})):[];
    }catch{return[];}
  }
  function extractSkills(card,type){
    const fromData=readSkillDataAttr(card,type);
    if(fromData.length)return fromData;
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
    document.addEventListener('pointerdown',e=>{const btn=e.target.closest('#v2AwakenTabs button');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();v2AwakenPointerHandled=true;applyV2AwakenButton(btn);setTimeout(()=>{v2AwakenPointerHandled=false;},260);},true);
    document.addEventListener('click',e=>{const btn=e.target.closest('#v2AwakenTabs button');if(!btn)return;e.preventDefault();e.stopImmediatePropagation();if(!v2AwakenPointerHandled)applyV2AwakenButton(btn);},true);
    document.addEventListener('click',e=>{const tab=e.target.closest('.v2-detail-tab-btn');if(!tab)return;e.preventDefault();e.stopImmediatePropagation();renderSidebarDetail(tab.getAttribute('data-v2-detail-kind')||'leader');},true);
    document.addEventListener('click',e=>{const btn=e.target.closest('[data-v2-skill]'); if(btn)openSkillPrompt(btn.getAttribute('data-v2-skill'));});
    grid.addEventListener('click',e=>{const card=e.target.closest('.unitCard');if(card)setTimeout(()=>selectCard(card),70)});
    grid.addEventListener('click',e=>{if(e.target.closest('.stateBtn,.duoFormBtn')){const card=e.target.closest('.unitCard');setTimeout(()=>selectCard(card),120)}});
    new MutationObserver(()=>{const cards=document.querySelectorAll('.unitCard');$('v2Count').textContent=cards.length?`• ${cards.length} visible`:'';if(!document.querySelector('.unitCard.v2-selected')&&cards[0])selectCard(cards[0]);window.EvertaleElementReference?.normalizeAll?.();setTimeout(()=>renderSidebarDetail(activeSidebarDetailKind),80);}).observe(grid,{childList:true});
    setTimeout(()=>{const first=document.querySelector('.unitCard');if(first)selectCard(first);window.EvertaleElementReference?.normalizeAll?.();},1200);
  }
  document.addEventListener('DOMContentLoaded',wire);
})();
