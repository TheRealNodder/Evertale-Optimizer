/* test-catalog-v2-mobile-detail-badge-tabs.js
   Final mobile-only popup/card guard.
   Desktop is untouched. No MutationObserver. No data fetch. No global layout ownership.
*/
(function(){
  const BREAKPOINT=820;
  const isMobile=()=>window.innerWidth<=BREAKPOINT;
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function inject(){
    if(document.getElementById('v2-mobile-final-popup-guard-style'))return;
    const style=document.createElement('style');
    style.id='v2-mobile-final-popup-guard-style';
    style.textContent=`
      @media (max-width:820px){
        body.page-catalog-v2 #catalogGrid .unitCard .nameBlock{
          display:flex!important;
          flex-direction:column!important;
          align-items:center!important;
          justify-content:center!important;
          text-align:center!important;
          gap:8px!important;
          width:100%!important;
        }
        body.page-catalog-v2 #catalogGrid .unitCard .nameBlock > .v2-detail-btn{
          order:0!important;
          display:inline-flex!important;
          align-items:center!important;
          justify-content:center!important;
          align-self:center!important;
          position:static!important;
          transform:none!important;
          width:auto!important;
          min-width:88px!important;
          height:34px!important;
          padding:0 14px!important;
          margin:0 auto 2px!important;
          border-radius:999px!important;
          font-size:12px!important;
          font-weight:950!important;
          line-height:1!important;
          color:#fff!important;
          background:rgba(255,255,255,.10)!important;
          border:1.5px solid rgba(255,255,255,.22)!important;
        }
        body.page-catalog-v2 #catalogGrid .unitCard .unitName{
          order:1!important;
          width:100%!important;
          text-align:center!important;
          margin:0 auto!important;
        }
        body.page-catalog-v2 #catalogGrid .unitCard .unitTitle{
          order:2!important;
          display:block!important;
          width:100%!important;
          max-width:100%!important;
          text-align:center!important;
          white-space:normal!important;
          overflow:visible!important;
          text-overflow:clip!important;
          word-break:normal!important;
          overflow-wrap:normal!important;
          line-height:1.18!important;
          margin:0 auto!important;
        }
        body.page-catalog-v2 #catalogGrid .unitCard .stateRow,
        body.page-catalog-v2 .v2-detail-backdrop .stateRow{
          order:3!important;
          display:flex!important;
          flex-direction:row!important;
          flex-wrap:nowrap!important;
          justify-content:center!important;
          align-items:center!important;
          gap:8px!important;
          width:100%!important;
          max-width:100%!important;
          margin:8px auto 0!important;
        }
        body.page-catalog-v2 #catalogGrid .unitCard .stateRow .stateBtn,
        body.page-catalog-v2 .v2-detail-backdrop .stateRow .stateBtn{
          flex:0 0 34px!important;
          width:34px!important;
          min-width:34px!important;
          max-width:34px!important;
          height:34px!important;
          min-height:34px!important;
          display:inline-flex!important;
          align-items:center!important;
          justify-content:center!important;
          padding:0!important;
          margin:0!important;
        }
        body.page-catalog-v2 #catalogGrid .unitCard .duoFormBtn{
          order:4!important;
          display:flex!important;
          align-self:center!important;
          justify-content:center!important;
          margin:8px auto 0!important;
        }
        body.page-catalog-v2 .v2-detail-backdrop .v2-detail-section[open] > .v2-detail-tab,
        body.page-catalog-v2 .v2-detail-backdrop .v2-detail-tab.active{
          background:linear-gradient(145deg,color-mix(in srgb,var(--element-primary,#f6ca5e) 82%,#fff 18%),var(--element-primary,#f6ca5e),color-mix(in srgb,var(--element-secondary,#a855f7) 76%,#111827 24%))!important;
          border-color:rgba(255,255,255,.48)!important;
          color:#fff!important;
          box-shadow:0 0 0 2px rgba(255,255,255,.14),0 8px 22px color-mix(in srgb,var(--element-primary,#f6ca5e) 30%,transparent)!important;
        }
        body.page-catalog-v2 .v2-detail-backdrop .v2-detail-section[open] .v2-detail-panel{
          display:block!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function syncPopupState(pop,idx){
    qa('.stateRow .stateBtn',pop).forEach((btn,i)=>{
      const on=i===idx;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',String(on));
    });
    const img=q('.unitThumb img',pop);
    let imgs=[];
    try{imgs=JSON.parse(decodeURIComponent(q('.stateRow',pop)?.dataset?.imgs||img?.dataset?.imgs||'[]')).filter(Boolean);}catch{}
    if(img&&imgs[idx]){img.setAttribute('src',imgs[idx]);img.dataset.state=String(idx);}
  }

  function syncHostState(host,idx){
    if(!host)return;
    const img=q('.unitThumb img',host);
    let imgs=[];
    try{imgs=JSON.parse(decodeURIComponent(q('.stateRow',host)?.dataset?.imgs||img?.dataset?.imgs||'[]')).filter(Boolean);}catch{}
    idx=Math.max(0,Math.min(Number(idx)||0,Math.max(imgs.length-1,qa('.stateRow .stateBtn',host).length-1,0)));
    if(img&&imgs[idx]){img.setAttribute('src',imgs[idx]);img.dataset.state=String(idx);}
    host.setAttribute('data-duo-index',String(idx));
    qa('.stateRow .stateBtn',host).forEach((btn,i)=>{
      const on=i===idx;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',String(on));
    });
    return idx;
  }

  function bind(){
    document.addEventListener('click',event=>{
      if(!isMobile())return;
      const detailBtn=event.target.closest('#catalogGrid .unitCard .v2-detail-btn');
      if(detailBtn){
        const card=detailBtn.closest('.unitCard');
        const target=detailBtn.getAttribute('popovertarget');
        const pop=target?document.getElementById(target):card?.querySelector('.v2-detail-backdrop');
        if(card&&pop){
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          card.classList.add('v2-selected');
          try{pop.showPopover();}catch{}
        }
        return;
      }
      const stateBtn=event.target.closest('.v2-detail-backdrop .stateRow .stateBtn');
      if(stateBtn){
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const pop=stateBtn.closest('.v2-detail-backdrop');
        const host=pop?.closest('.unitCard');
        const idx=syncHostState(host,stateBtn.dataset.idx||0);
        syncPopupState(pop,idx);
        return;
      }
      const tab=event.target.closest('.v2-detail-backdrop .v2-detail-section > .v2-detail-tab');
      if(tab){
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const section=tab.closest('.v2-detail-section');
        const pop=tab.closest('.v2-detail-backdrop');
        if(section&&pop){
          qa('.v2-detail-section',pop).forEach(s=>{
            s.open=false;
            q('.v2-detail-tab',s)?.classList.remove('active');
          });
          section.open=true;
          tab.classList.add('active');
        }
      }
    },true);
  }

  function boot(){inject();bind();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
