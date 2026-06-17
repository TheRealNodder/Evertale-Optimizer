/* catalog-click-fast-authority.js
   Final lightweight click authority for live Catalog.
   Keeps performance patches intact and makes selected-card/hero state follow the card actually clicked.
*/
(function(){
  const $=id=>document.getElementById(id);
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const safe=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/\n/g,'<br>');
  const readRows=(card,type)=>{try{const rows=JSON.parse(decodeURIComponent(card?.getAttribute(type==='active'?'data-active-skills':'data-passive-skills')||''));return Array.isArray(rows)?rows:[];}catch{return[];}};
  let activeKind='leader';
  let raf=0;
  let pendingCard=null;

  function text(sel,root=document){return q(sel,root)?.textContent?.trim()||'';}
  function setText(id,value){const n=$(id);if(n&&n.textContent!==String(value??''))n.textContent=String(value??'');}
  function stat(card,k){return q(`.stat[data-stat="${k}"] .statVal`,card)?.textContent?.trim()||'—';}
  function cardId(card){return String(card?.getAttribute('data-id')||card?.getAttribute('data-source-id')||card?.getAttribute('data-family')||text('.unitName',card)||'');}
  function selectedCard(){return q('#catalogGrid .unitCard.v2-selected')||q('#catalogGrid .unitCard');}
  function activeIdx(card){return Number(q('.stateRow .stateBtn.active',card)?.getAttribute('data-idx')||q('.unitThumb img',card)?.getAttribute('data-state')||card?.getAttribute('data-duo-index')||0)||0;}

  function skillHtml(card,type){
    const rows=readRows(card,type);
    return rows.length?rows.map(s=>`<p><strong>${safe(s.name||s.id||'Skill')}</strong>${s.tu||s.sp!==undefined?`<br><span>${safe([s.tu?`${s.tu} TU`:'',s.sp!==undefined?`${Number(s.sp)>0?'+':''}${s.sp} SP`:''].filter(Boolean).join(' • '))}</span>`:''}<br>${safe(s.description||s.desc||'No description loaded.')}</p>`).join(''):'<p>No skills loaded.</p>';
  }
  function leaderHtml(card){return `<p><strong>${safe(text('.leaderName',card)||'Leader Skill')}</strong><br>${safe(text('.leaderDesc',card)||'No leader skill loaded.')}</p>`;}
  function descHtml(card){return `<p>${safe(card?.getAttribute('data-description')||text('.descriptionText',card)||$('v2Desc')?.textContent||'No description loaded.')}</p>`;}

  function ensureSidebar(){
    const description=q('.v2-description');if(!description)return null;
    let head=q('.v2-desc-head',description);if(!head){head=document.createElement('div');head.className='v2-desc-head';description.insertBefore(head,description.firstChild);}
    let tabs=q('.v2-detail-tabs',description);if(!tabs){tabs=document.createElement('div');tabs.className='v2-detail-tabs';head.appendChild(tabs);}
    if(!tabs.children.length){tabs.innerHTML=[['leader','Leader Skill'],['active','Active Skill'],['passive','Passive Skill'],['description','Description']].map(([kind,label])=>`<button type="button" class="v2-detail-tab-btn${kind===activeKind?' active':''}" data-v2-detail-kind="${kind}">${label}</button>`).join('');}
    let panel=q('.v2-detail-scroll-panel',description);if(!panel){panel=document.createElement('div');panel.className='v2-detail-scroll-panel';description.appendChild(panel);}
    return panel;
  }

  function renderSidebar(card,kind=activeKind){
    const panel=ensureSidebar();if(!panel||!card)return;
    activeKind=kind||'leader';
    qa('.v2-detail-tab-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-v2-detail-kind')===activeKind));
    const html=activeKind==='leader'?leaderHtml(card):activeKind==='active'?skillHtml(card,'active'):activeKind==='passive'?skillHtml(card,'passive'):descHtml(card);
    if(panel.innerHTML!==html)panel.innerHTML=html;
  }

  function updateHero(card){
    if(!card||!document.contains(card))return;
    const id=cardId(card);
    qa('#catalogGrid .unitCard.v2-selected').forEach(c=>{if(c!==card)c.classList.remove('v2-selected');});
    card.classList.add('v2-selected');
    card.dataset.v2FastSelected='1';
    const img=q('.unitThumb img',card);
    const src=img?.getAttribute('src')||img?.src||'';
    const host=$('v2FeatureArt');
    if(host&&src){const hero=q('img',host);if(hero){if(hero.getAttribute('src')!==src)hero.setAttribute('src',src);}else host.innerHTML=`<img src="${src}" alt="" loading="lazy" decoding="async">`;}
    setText('v2Kind',card.getAttribute('data-kind')||'Catalog');
    setText('v2Name',text('.unitName',card)||'Unknown');
    setText('v2Title',text('.unitTitle',card)||'');
    const pills=$('v2Pills');
    if(pills){const html=qa('.chipCol .tag,.slotBadges .tag',card).map(x=>`<span class="v2-pill">${safe(x.textContent.trim())}</span>`).join('');if(pills.innerHTML!==html)pills.innerHTML=html;}
    setText('v2Hp',stat(card,'hp'));setText('v2Atk',stat(card,'atk'));setText('v2Spd',stat(card,'spd'));setText('v2Cost',stat(card,'cost'));
    const tabs=$('v2AwakenTabs');
    if(tabs){
      const btns=qa('.stateRow .stateBtn',card).filter(b=>!b.hidden&&!b.classList.contains('v2-state-hidden'));
      const idx=activeIdx(card);
      const html=btns.length?btns.map((_,i)=>`<button type="button" class="${i===idx?'active':''}" data-v2-idx="${i}" data-awaken-index="${i}" aria-pressed="${i===idx?'true':'false'}">${i+1}</button>`).join(''):'';
      if(tabs.innerHTML!==html)tabs.innerHTML=html;
      tabs.dataset.v2ActiveCard=id;
    }
    setText('v2Desc',card.getAttribute('data-description')||text('.descriptionText',card)||'No description loaded.');
    renderSidebar(card,activeKind);
  }

  function queue(card){
    pendingCard=card;
    if(raf)return;
    raf=requestAnimationFrame(()=>{raf=0;const c=pendingCard;pendingCard=null;updateHero(c);});
  }

  document.addEventListener('click',event=>{
    const tab=event.target.closest('.v2-detail-tab-btn');
    if(tab){activeKind=tab.getAttribute('data-v2-detail-kind')||'leader';queue(selectedCard());return;}
    const card=event.target.closest('#catalogGrid .unitCard');
    if(card){queue(card);setTimeout(()=>updateHero(card),0);}
  },false);

  document.addEventListener('pointerup',event=>{
    const card=event.target.closest('#catalogGrid .unitCard');
    if(card)queue(card);
  },{passive:true});

  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>queue(selectedCard()),350));
})();
