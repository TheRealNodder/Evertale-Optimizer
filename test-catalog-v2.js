/* Live Catalog lightweight hero bridge.
   Removed per-click bundle fetching, delayed reselect timers, and MutationObserver rescans.
*/
(function(){
  const $=id=>document.getElementById(id);
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const safe=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/\n/g,'<br>');
  let activeSidebarDetailKind='leader';
  function text(sel,root=document){return q(sel,root)?.textContent?.trim()||'';}
  function setText(id,value){const node=$(id);if(node&&node.textContent!==String(value??''))node.textContent=String(value??'');}
  function readRows(card,type){try{const rows=JSON.parse(decodeURIComponent(card?.getAttribute(type==='active'?'data-active-skills':'data-passive-skills')||''));return Array.isArray(rows)?rows:[];}catch{return[];}}
  function skillHtml(card,type){const rows=readRows(card,type);return rows.length?rows.map(s=>`<p><strong>${safe(s.name||s.id||'Skill')}</strong>${s.tu||s.sp!==undefined?`<br><span>${safe([s.tu?`${s.tu} TU`:'',s.sp!==undefined?`${Number(s.sp)>0?'+':''}${s.sp} SP`:''].filter(Boolean).join(' • '))}</span>`:''}<br>${safe(s.description||s.desc||'No description loaded.')}</p>`).join(''):'<p>No skills loaded.</p>';}
  function leaderHtml(card){return `<p><strong>${safe(text('.leaderName',card)||'Leader Skill')}</strong><br>${safe(text('.leaderDesc',card)||'No leader skill loaded.')}</p>`;}
  function descHtml(card){return `<p>${safe(card?.getAttribute('data-description')||text('.descriptionText',card)||$('v2Desc')?.textContent||'No description loaded.')}</p>`;}
  function ensureSidebarDetails(){
    const description=q('.v2-description');if(!description)return null;
    let head=q('.v2-desc-head',description);if(!head){head=document.createElement('div');head.className='v2-desc-head';description.insertBefore(head,description.firstChild);}
    let tabs=q('.v2-detail-tabs',description);if(!tabs){tabs=document.createElement('div');tabs.className='v2-detail-tabs';head.appendChild(tabs);}
    if(!tabs.children.length){
      tabs.innerHTML=[['leader','Leader Skill'],['active','Active Skill'],['passive','Passive Skill'],['description','Description']].map(([kind,label])=>`<button type="button" class="v2-detail-tab-btn${kind===activeSidebarDetailKind?' active':''}" data-v2-detail-kind="${kind}">${label}</button>`).join('');
    }
    let panel=q('.v2-detail-scroll-panel',description);if(!panel){panel=document.createElement('div');panel.className='v2-detail-scroll-panel';description.appendChild(panel);}
    return panel;
  }
  function renderSidebar(card,kind=activeSidebarDetailKind){
    const panel=ensureSidebarDetails();if(!panel||!card)return;
    activeSidebarDetailKind=kind||'leader';
    qa('.v2-detail-tab-btn').forEach(btn=>btn.classList.toggle('active',btn.getAttribute('data-v2-detail-kind')===activeSidebarDetailKind));
    const html=activeSidebarDetailKind==='leader'?leaderHtml(card):activeSidebarDetailKind==='active'?skillHtml(card,'active'):activeSidebarDetailKind==='passive'?skillHtml(card,'passive'):descHtml(card);
    if(panel.innerHTML!==html)panel.innerHTML=html;
  }
  function activeIdx(card){return Number(q('.stateRow .stateBtn.active',card)?.getAttribute('data-idx')||q('.unitThumb img',card)?.getAttribute('data-state')||card?.getAttribute('data-duo-index')||0)||0;}
  function setHero(card){
    if(!card)return;
    const src=q('.unitThumb img',card)?.getAttribute('src')||q('.unitThumb img',card)?.src||'';
    const host=$('v2FeatureArt');
    if(host&&src){const img=q('img',host);if(img){if(img.getAttribute('src')!==src)img.setAttribute('src',src);}else host.innerHTML=`<img src="${src}" alt="" loading="lazy" decoding="async">`;}
    setText('v2Kind',card.getAttribute('data-kind')||card.getAttribute('data-type')||'Catalog');
    setText('v2Name',text('.unitName',card)||'Unknown');
    setText('v2Title',text('.unitTitle',card)||'');
    const pills=$('v2Pills');
    if(pills){const html=qa('.chipCol .tag,.slotBadges .tag',card).map(x=>`<span class="v2-pill">${safe(x.textContent.trim())}</span>`).join('');if(pills.innerHTML!==html)pills.innerHTML=html;}
    ['hp','atk','spd','cost'].forEach(k=>setText('v2'+k[0].toUpperCase()+k.slice(1),q(`.stat[data-stat="${k}"] .statVal`,card)?.textContent?.trim()||'—'));
    const tabs=$('v2AwakenTabs');
    const btns=qa('.stateRow .stateBtn',card).filter(b=>!b.hidden);
    if(tabs){const idx=activeIdx(card);const html=btns.length?btns.map((_,i)=>`<button type="button" class="${i===idx?'active':''}" data-v2-idx="${i}" data-awaken-index="${i}" aria-pressed="${i===idx?'true':'false'}">${i+1}</button>`).join(''):'';if(tabs.innerHTML!==html)tabs.innerHTML=html;}
    setText('v2Desc',card.getAttribute('data-description')||'No description loaded.');
    renderSidebar(card,activeSidebarDetailKind);
  }
  function selectedCard(){return q('#catalogGrid .unitCard.v2-selected')||q('#catalogGrid .unitCard');}
  function selectCard(card){if(!card)return;qa('#catalogGrid .unitCard.v2-selected').forEach(c=>{if(c!==card)c.classList.remove('v2-selected');});card.classList.add('v2-selected');setHero(card);}
  function setCardState(card,idx){
    const row=q('.stateRow',card),img=q('.unitThumb img',card);let imgs=[];try{imgs=JSON.parse(decodeURIComponent(row?.getAttribute('data-imgs')||img?.getAttribute('data-imgs')||'[]'));}catch{}
    idx=Math.max(0,Math.min(Number(idx)||0,Math.max(imgs.length-1,0)));
    if(img&&imgs[idx]){img.setAttribute('src',imgs[idx]);img.setAttribute('data-state',String(idx));}
    qa('.stateRow .stateBtn',card).forEach((b,i)=>b.classList.toggle('active',i===idx));
    card.setAttribute('data-duo-index',String(idx));
    setHero(card);
  }
  function wire(){
    const grid=$('catalogGrid');if(!grid)return;
    document.addEventListener('click',e=>{const tab=e.target.closest('.v2-detail-tab-btn');if(!tab)return;e.preventDefault();e.stopImmediatePropagation();renderSidebar(selectedCard(),tab.getAttribute('data-v2-detail-kind')||'leader');},true);
    document.addEventListener('click',e=>{const tab=e.target.closest('#v2AwakenTabs button');if(!tab)return;const card=selectedCard();if(!card)return;e.preventDefault();e.stopImmediatePropagation();setCardState(card,tab.dataset.v2Idx??tab.dataset.awakenIndex??0);},true);
    grid.addEventListener('click',e=>{const card=e.target.closest('.unitCard');if(!card)return;if(!e.target.closest('.stateBtn,.duoFormBtn,[data-v2-skill],button,input,select,a'))selectCard(card);});
    setTimeout(()=>{const first=selectedCard();if(first)setHero(first);},300);
  }
  document.addEventListener('DOMContentLoaded',wire);
})();
