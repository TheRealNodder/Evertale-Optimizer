/* test-catalog-v2-awaken-state-stability.js
   Finalized check guard for awaken-state selection.
   Prevents desktop/sidebar helpers from briefly repainting the selected state back to 5★.
   No mobile, data, sorting, card rendering, or badge-count changes.
*/
(function(){
  let lockedIndex=0;
  let lockedCard=null;
  let scheduled=false;
  let writing=false;
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function selectedCard(){return lockedCard&&document.contains(lockedCard)?lockedCard:q('#catalogGrid .unitCard.v2-selected')||q('#catalogGrid .unitCard');}
  function clamp(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(2,Math.floor(n))):0;}
  function readIndex(card=selectedCard()){
    const v=card?.querySelector('.stateRow .stateBtn.active')?.getAttribute('data-idx')
      ||card?.querySelector('.unitThumb img')?.getAttribute('data-state')
      ||card?.getAttribute('data-duo-index')
      ||String(lockedIndex||0);
    return clamp(v);
  }
  function setAttr(node,name,value){if(node&&node.getAttribute(name)!==String(value))node.setAttribute(name,String(value));}
  function setClass(node,name,on){if(node&&node.classList.contains(name)!==!!on)node.classList.toggle(name,!!on);}
  function writeIndex(idx,card=selectedCard()){
    writing=true;
    lockedIndex=clamp(idx);
    if(card)lockedCard=card;
    qa('#v2AwakenTabs button').forEach((btn,i)=>{
      const on=i===lockedIndex;
      setClass(btn,'active',on);
      setAttr(btn,'aria-pressed',on);
      if(btn.dataset.v2Idx!==String(i))btn.dataset.v2Idx=String(i);
      if(btn.dataset.awakenIndex!==String(i))btn.dataset.awakenIndex=String(i);
    });
    if(card){
      qa('.stateRow .stateBtn',card).forEach(btn=>{
        const i=Number(btn.getAttribute('data-idx')||0);
        setClass(btn,'active',i===lockedIndex);
      });
      setAttr(card,'data-duo-index',lockedIndex);
      const img=q('.unitThumb img',card);
      setAttr(img,'data-state',lockedIndex);
    }
    writing=false;
  }
  function enforce(){scheduled=false;writeIndex(lockedIndex,selectedCard());}
  function enforceSoon(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(enforce);
  }
  document.addEventListener('pointerdown',event=>{
    const btn=event.target.closest('#v2AwakenTabs button,.stateRow .stateBtn');
    if(!btn)return;
    const card=btn.closest('.unitCard')||selectedCard();
    const idx=btn.dataset.v2Idx??btn.dataset.awakenIndex??btn.getAttribute('data-idx')??0;
    writeIndex(idx,card);
    enforceSoon();
  },true);
  document.addEventListener('click',event=>{
    const btn=event.target.closest('#v2AwakenTabs button,.stateRow .stateBtn');
    if(btn){
      const card=btn.closest('.unitCard')||selectedCard();
      const idx=btn.dataset.v2Idx??btn.dataset.awakenIndex??btn.getAttribute('data-idx')??lockedIndex;
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
    writeIndex(event.detail?.index??lockedIndex,event.detail?.card||selectedCard());
    enforceSoon();
  });
  const grid=q('#catalogGrid');
  if(grid){
    new MutationObserver(()=>{
      if(writing)return;
      const card=selectedCard();
      if(card)lockedIndex=readIndex(card);
      enforceSoon();
    }).observe(grid,{childList:true,subtree:false});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{lockedIndex=readIndex();enforceSoon();},{once:true});
  else{lockedIndex=readIndex();enforceSoon();}
})();
