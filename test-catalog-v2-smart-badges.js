/* test-catalog-v2-smart-badges.js
   Smart badge normalizer for Test Catalog V2.
   Scope:
   - Characters: state badges follow rarity/state availability.
   - Weapons: no state badges, type says Weapon, no element badge.
   - Accessories: no state badges, type says Accessories, no element badge.
   Bosses are intentionally left alone for later handling.
*/
(function(){
  const STATE_LABELS=['5★','6★','FA'];
  const clean=v=>String(v||'').trim().toLowerCase();
  function q(sel,root=document){return root.querySelector(sel);}
  function qa(sel,root=document){return Array.from(root.querySelectorAll(sel));}
  function kindOf(card){return card?.getAttribute('data-kind')||'';}
  function kindLabel(kind){return kind==='characters'?'Character':kind==='weapons'?'Weapon':kind==='accessories'?'Accessories':kind==='bosses'?'Boss':'';}
  function rarityText(card){return q('.tag.rarity',card)?.textContent?.trim()||card?.getAttribute('data-rarity')||'';}
  function rarityLimit(card){
    const rarity=clean(rarityText(card));
    if(/ssr|5/.test(rarity))return 3;
    if(/sr|4/.test(rarity))return 2;
    return 1;
  }
  function injectStyles(){
    if(document.getElementById('v2-smart-badge-style'))return;
    const style=document.createElement('style');
    style.id='v2-smart-badge-style';
    style.textContent=`
      body.page-catalog-v2 .stateRow[data-smart-state-count="0"],
      body.page-catalog-v2 #v2AwakenTabs[data-smart-state-count="0"]{display:none!important;}
      body.page-catalog-v2 .stateRow .stateBtn[hidden],
      body.page-catalog-v2 #v2AwakenTabs button[hidden],
      body.page-catalog-v2 .stateRow .stateBtn.v2-smart-hidden,
      body.page-catalog-v2 #v2AwakenTabs button.v2-smart-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important;}
      body.page-catalog-v2 .stateRow[data-smart-state-count="1"]{grid-template-columns:1fr!important;}
      body.page-catalog-v2 .stateRow[data-smart-state-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
      body.page-catalog-v2 .stateRow[data-smart-state-count="3"]{grid-template-columns:repeat(3,minmax(0,1fr))!important;}
    `;
    document.head.appendChild(style);
  }
  function imageList(card){
    const row=q('.stateRow',card);
    const img=q('.unitThumb img',card);
    try{const rows=JSON.parse(decodeURIComponent(row?.getAttribute('data-imgs')||img?.getAttribute('data-imgs')||'[]'));if(Array.isArray(rows)&&rows.length)return rows.filter(Boolean).slice(0,3);}catch{}
    return img?.src?[img.src]:[];
  }
  function ensureStateRow(card){
    let row=q('.stateRow',card);
    if(row)return row;
    const anchor=q('.metaMain',card);
    if(!anchor)return null;
    row=document.createElement('div');
    row.className='stateRow';
    anchor.appendChild(row);
    return row;
  }
  function normalizeStateBadges(card){
    const kind=kindOf(card);
    const existing=q('.stateRow',card);
    if(kind==='weapons'||kind==='accessories'){
      if(existing)existing.remove();
      return;
    }
    if(kind!=='characters')return;
    const imgs=imageList(card);
    const count=Math.max(1,Math.min(rarityLimit(card),imgs.length||1,3));
    const row=ensureStateRow(card);
    if(!row)return;
    row.setAttribute('data-smart-state-count',String(count));
    if(imgs.length)row.setAttribute('data-imgs',encodeURIComponent(JSON.stringify(imgs.slice(0,count))));
    const next=STATE_LABELS.slice(0,count).map((label,i)=>`<button type="button" class="stateBtn ${i===0?'active':''}" data-idx="${i}" aria-label="${label}"></button>`).join('');
    if(row.innerHTML!==next)row.innerHTML=next;
  }
  function normalizeCard(card){
    const kind=kindOf(card);
    if(!kind||kind==='bosses')return;
    const kindTag=q('.tag.kind',card);
    const label=kindLabel(kind);
    if(kindTag&&label&&kindTag.textContent.trim()!==label)kindTag.textContent=label;
    if(kind==='weapons'||kind==='accessories')qa('.tag.element',card).forEach(node=>node.remove());
    normalizeStateBadges(card);
  }
  function selectedCard(){return q('#catalogGrid .unitCard.v2-selected')||q('#catalogGrid .unitCard');}
  function setButtonVisible(btn,show){
    btn.hidden=!show;
    btn.classList.toggle('v2-smart-hidden',!show);
    btn.style.setProperty('display',show?'':'none','important');
    btn.style.setProperty('visibility',show?'':'hidden','important');
    btn.style.setProperty('pointer-events',show?'auto':'none','important');
  }
  function syncSidebar(){
    const card=selectedCard();
    if(!card)return;
    const kind=kindOf(card);
    if(kind==='bosses')return;
    const pills=q('#v2Pills');
    if(pills){
      const label=kindLabel(kind);
      const rarity=rarityText(card)||'Rarity';
      let html=`<span class="v2-sidebar-badge" data-sidebar-badge="kind">${label}</span>`;
      if(kind==='characters'){
        const element=q('.tag.element',card)?.textContent?.trim()||'Element';
        html+=`<span class="v2-sidebar-badge" data-sidebar-badge="element">${element}</span>`;
      }
      html+=`<span class="v2-sidebar-badge" data-sidebar-badge="rarity">${rarity}</span>`;
      if(pills.innerHTML!==html)pills.innerHTML=html;
    }
    const tabs=q('#v2AwakenTabs');
    if(!tabs)return;
    if(kind==='weapons'||kind==='accessories'){
      qa('button',tabs).forEach(btn=>setButtonVisible(btn,false));
      tabs.setAttribute('data-smart-state-count','0');
      return;
    }
    if(kind==='characters'){
      const imgs=imageList(card);
      const count=Math.max(1,Math.min(rarityLimit(card),imgs.length||1,3));
      tabs.style.removeProperty('display');
      qa('button',tabs).forEach((btn,i)=>{
        const show=i<count;
        setButtonVisible(btn,show);
        btn.setAttribute('aria-label',STATE_LABELS[i]||`State ${i+1}`);
      });
      tabs.setAttribute('data-smart-state-count',String(count));
    }
  }
  function normalizeAll(){injectStyles();qa('#catalogGrid .unitCard').forEach(normalizeCard);syncSidebar();}
  let timer=null;
  function schedule(delay=60){clearTimeout(timer);timer=setTimeout(normalizeAll,delay);}
  function scheduleSeveral(){schedule(40);setTimeout(normalizeAll,140);setTimeout(normalizeAll,320);}
  document.addEventListener('DOMContentLoaded',()=>{injectStyles();scheduleSeveral();setTimeout(normalizeAll,900);setTimeout(normalizeAll,1800);});
  document.addEventListener('click',e=>{if(e.target.closest('#catalogGrid .unitCard,.stateBtn,.duoFormBtn,#v2AwakenTabs button,#catalogType'))scheduleSeveral();},true);
  document.addEventListener('change',e=>{if(e.target.closest('#catalogType,#catalogSort'))scheduleSeveral();},true);
  document.addEventListener('v2:hero-state-change',scheduleSeveral);
  new MutationObserver(()=>schedule(90)).observe(document.documentElement,{childList:true,subtree:true});
})();
