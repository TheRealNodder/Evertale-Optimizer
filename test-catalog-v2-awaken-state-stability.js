/* test-catalog-v2-awaken-state-stability.js
   Finalized check guard for awaken-state selection.
   Prevents desktop/sidebar helpers from briefly repainting the selected state back to 5★.
   No mobile, data, sorting, card rendering, or badge-count changes.
*/
(function(){
  let lockedIndex=0;
  let lockedCard=null;
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function selectedCard(){return lockedCard&&document.contains(lockedCard)?lockedCard:q('#catalogGrid .unitCard.v2-selected')||q('#catalogGrid .unitCard');}
  function readIndex(card=selectedCard()){
    const v=card?.querySelector('.stateRow .stateBtn.active')?.getAttribute('data-idx')
      ||card?.querySelector('.unitThumb img')?.getAttribute('data-state')
      ||card?.getAttribute('data-duo-index')
      ||String(lockedIndex||0);
    const n=Number(v);
    return Number.isFinite(n)?Math.max(0,Math.min(2,Math.floor(n))):0;
  }
  function writeIndex(idx,card=selectedCard()){
    lockedIndex=Math.max(0,Math.min(2,Number(idx)||0));
    if(card)lockedCard=card;
    qa('#v2AwakenTabs button').forEach((btn,i)=>{
      const on=i===lockedIndex;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',String(on));
      btn.dataset.v2Idx=String(i);
      btn.dataset.awakenIndex=String(i);
    });
    if(card){
      qa('.stateRow .stateBtn',card).forEach(btn=>{
        const i=Number(btn.getAttribute('data-idx')||0);
        btn.classList.toggle('active',i===lockedIndex);
      });
      card.setAttribute('data-duo-index',String(lockedIndex));
      const img=q('.unitThumb img',card);
      if(img)img.setAttribute('data-state',String(lockedIndex));
    }
  }
  function enforce(){writeIndex(lockedIndex,selectedCard());}
  function enforceSoon(){queueMicrotask(enforce);requestAnimationFrame(enforce);setTimeout(enforce,40);}
  document.addEventListener('pointerdown',event=>{
    const btn=event.target.closest('#v2AwakenTabs button,.stateRow .stateBtn');
    if(!btn)return;
    const card=btn.closest('.unitCard')||selectedCard();
    const idx=Number(btn.dataset.v2Idx??btn.dataset.awakenIndex??btn.getAttribute('data-idx')??0);
    writeIndex(idx,card);
    enforceSoon();
  },true);
  document.addEventListener('click',event=>{
    const btn=event.target.closest('#v2AwakenTabs button,.stateRow .stateBtn');
    if(btn){
      const card=btn.closest('.unitCard')||selectedCard();
      const idx=Number(btn.dataset.v2Idx??btn.dataset.awakenIndex??btn.getAttribute('data-idx')??lockedIndex);
      writeIndex(idx,card);
      enforceSoon();
      return;
    }
    const card=event.target.closest('#catalogGrid .unitCard');
    if(card&&!event.target.closest('.duoFormBtn')){
      lockedCard=card;
      lockedIndex=readIndex(card);
      enforceSoon();
    }
  },true);
  document.addEventListener('v2:hero-state-change',event=>{
    const idx=Number(event.detail?.index??lockedIndex);
    writeIndex(idx,event.detail?.card||selectedCard());
    enforceSoon();
  });
  new MutationObserver(()=>{
    const card=selectedCard();
    if(card)lockedIndex=readIndex(card);
    enforceSoon();
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-pressed','data-state','data-duo-index']});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{lockedIndex=readIndex();enforceSoon();},{once:true});
  else{lockedIndex=readIndex();enforceSoon();}
})();
