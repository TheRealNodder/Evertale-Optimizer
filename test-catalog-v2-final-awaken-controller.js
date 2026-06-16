/* test-catalog-v2-final-awaken-controller.js
   Final desktop/sidebar/card awaken controller.
   Captures awaken clicks before older bridge handlers so the selected state does not flash back to 5★.
   No mobile, data, sorting, card rendering, or badge-count changes.
*/
(function(){
  const BREAKPOINT=821;
  const lockedByCard=new Map();
  let lastCardKey='';
  let lastIndex=0;
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function isDesktop(){return window.innerWidth>=BREAKPOINT;}
  function selectedCard(){return q('#catalogGrid .unitCard.v2-selected')||q('#catalogGrid .unitCard');}
  function cardKey(card){return String(card?.getAttribute('data-id')||card?.getAttribute('data-source-id')||card?.getAttribute('data-family')||q('.unitName',card)?.textContent||'').trim();}
  function idxFrom(btn){const n=Number(btn?.dataset?.v2Idx??btn?.dataset?.awakenIndex??btn?.getAttribute('data-idx')??0);return Number.isFinite(n)?Math.max(0,Math.min(2,Math.floor(n))):0;}
  function imgsFor(card){try{return JSON.parse(decodeURIComponent(q('.stateRow',card)?.getAttribute('data-imgs')||q('.unitThumb img',card)?.getAttribute('data-imgs')||'[]')).filter(Boolean);}catch{return[];}}
  function lock(card,idx){
    if(!card)return;
    const key=cardKey(card);
    if(key)lockedByCard.set(key,idx);
    lastCardKey=key;
    lastIndex=idx;
    card.setAttribute('data-v2-locked-state-index',String(idx));
  }
  function lockedIndex(card, fallback=0){
    const key=cardKey(card);
    const attr=Number(card?.getAttribute('data-v2-locked-state-index'));
    if(Number.isFinite(attr))return Math.max(0,Math.min(2,Math.floor(attr)));
    if(key&&lockedByCard.has(key))return lockedByCard.get(key);
    if(key&&key===lastCardKey)return lastIndex;
    return fallback;
  }
  function setActive(idx,card){
    if(!card)return;
    lock(card,idx);
    qa('#v2AwakenTabs button').forEach((btn,i)=>{
      const on=i===idx;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',String(on));
      btn.dataset.v2Idx=String(i);
      btn.dataset.awakenIndex=String(i);
    });
    qa('.stateRow .stateBtn',card).forEach(btn=>{
      const on=Number(btn.getAttribute('data-idx')||0)===idx;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',String(on));
    });
    card.setAttribute('data-duo-index',String(idx));
    const img=q('.unitThumb img',card);
    const imgs=imgsFor(card);
    if(img&&imgs[idx]){
      if(img.src!==imgs[idx])img.src=imgs[idx];
      img.setAttribute('src',imgs[idx]);
    }
    if(img)img.setAttribute('data-state',String(idx));
    const hero=q('#v2FeatureArt img');
    if(hero&&img?.src&&hero.src!==img.src){
      hero.src=img.src;
      hero.setAttribute('src',img.getAttribute('src')||img.src);
    }
    document.dispatchEvent(new CustomEvent('v2:hero-state-change',{detail:{index:idx,card}}));
  }
  function reapply(card,idx){
    [0,40,120,260,520,900].forEach(delay=>setTimeout(()=>setActive(idx,card),delay));
    requestAnimationFrame(()=>setActive(idx,card));
  }
  function handle(event){
    if(!isDesktop())return;
    const sidebarBtn=event.target.closest('#v2AwakenTabs button');
    const cardBtn=event.target.closest('#catalogGrid .unitCard .stateRow .stateBtn');
    if(!sidebarBtn&&!cardBtn)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const card=cardBtn?.closest('.unitCard')||selectedCard();
    if(card){
      qa('#catalogGrid .unitCard.v2-selected').forEach(c=>{if(c!==card)c.classList.remove('v2-selected');});
      card.classList.add('v2-selected');
    }
    const idx=idxFrom(sidebarBtn||cardBtn);
    setActive(idx,card);
    reapply(card,idx);
  }
  function syncAfterSelection(){
    if(!isDesktop())return;
    const card=selectedCard();
    if(!card)return;
    const active=Number(q('.stateRow .stateBtn.active',card)?.getAttribute('data-idx')??q('.unitThumb img',card)?.getAttribute('data-state')??card.getAttribute('data-duo-index')??0);
    const idx=lockedIndex(card,Number.isFinite(active)?active:0);
    setActive(idx,card);
  }
  document.addEventListener('pointerdown',handle,true);
  document.addEventListener('click',handle,true);
  document.addEventListener('v2:hero-state-change',event=>{
    if(!isDesktop())return;
    const card=event?.detail?.card||selectedCard();
    const idx=Number(event?.detail?.index);
    if(card&&Number.isFinite(idx))lock(card,idx);
    setTimeout(()=>syncAfterSelection(),80);
  });
  new MutationObserver(()=>setTimeout(syncAfterSelection,80)).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(syncAfterSelection,300);setTimeout(syncAfterSelection,1000);});
})();