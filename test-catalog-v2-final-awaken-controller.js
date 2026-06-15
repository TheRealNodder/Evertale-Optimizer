/* test-catalog-v2-final-awaken-controller.js
   Final desktop sidebar awaken controller.
   Captures sidebar awaken clicks before older bridge handlers so the selected state does not flash back to 5★.
   No mobile, data, sorting, card rendering, or badge-count changes.
*/
(function(){
  const BREAKPOINT=821;
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function isDesktop(){return window.innerWidth>=BREAKPOINT;}
  function selectedCard(){return q('#catalogGrid .unitCard.v2-selected')||q('#catalogGrid .unitCard');}
  function idxFrom(btn){const n=Number(btn?.dataset?.v2Idx??btn?.dataset?.awakenIndex??btn?.getAttribute('data-idx')??0);return Number.isFinite(n)?Math.max(0,Math.min(2,Math.floor(n))):0;}
  function imgsFor(card){try{return JSON.parse(decodeURIComponent(q('.stateRow',card)?.getAttribute('data-imgs')||q('.unitThumb img',card)?.getAttribute('data-imgs')||'[]')).filter(Boolean);}catch{return[];}}
  function setActive(idx,card){
    if(!card)return;
    qa('#v2AwakenTabs button').forEach((btn,i)=>{
      const on=i===idx;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',String(on));
      btn.dataset.v2Idx=String(i);
      btn.dataset.awakenIndex=String(i);
    });
    qa('.stateRow .stateBtn',card).forEach(btn=>btn.classList.toggle('active',Number(btn.getAttribute('data-idx')||0)===idx));
    card.setAttribute('data-duo-index',String(idx));
    const img=q('.unitThumb img',card);
    const imgs=imgsFor(card);
    if(img&&imgs[idx]&&img.src!==imgs[idx])img.src=imgs[idx];
    if(img)img.setAttribute('data-state',String(idx));
    const hero=q('#v2FeatureArt img');
    if(hero&&img?.src&&hero.src!==img.src)hero.src=img.src;
    document.dispatchEvent(new CustomEvent('v2:hero-state-change',{detail:{index:idx,card}}));
  }
  function handle(event){
    if(!isDesktop())return;
    const btn=event.target.closest('#v2AwakenTabs button');
    if(!btn)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const card=selectedCard();
    const idx=idxFrom(btn);
    setActive(idx,card);
    requestAnimationFrame(()=>setActive(idx,card));
  }
  document.addEventListener('pointerdown',handle,true);
  document.addEventListener('click',handle,true);
})();
