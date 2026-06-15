/* test-catalog-v2-mobile-detail-badge-tabs.js
   Mobile-only detail badge tabs.
   Converts the mobile detail accordions into desktop-style click-through badges with one panel below.
   No desktop, data, sorting, card rendering, or boss logic changes.
*/
(function(){
  const BREAKPOINT=820;
  function isMobile(){return window.innerWidth<=BREAKPOINT;}
  function inject(){
    if(document.getElementById('v2-mobile-detail-badge-tabs-style'))return;
    const style=document.createElement('style');
    style.id='v2-mobile-detail-badge-tabs-style';
    style.textContent=`
      @media (max-width:820px){
        body.page-catalog-v2 .v2-mobile-detail-tabs{
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:8px!important;
          width:100%!important;
          margin-top:10px!important;
        }
        body.page-catalog-v2 .v2-mobile-detail-tab{
          min-width:0!important;
          min-height:36px!important;
          border-radius:999px!important;
          border:1.5px solid color-mix(in srgb,var(--element-primary,#f6ca5e) 70%,rgba(255,255,255,.14))!important;
          background:rgba(255,255,255,.07)!important;
          color:#fff!important;
          font-size:12px!important;
          font-weight:950!important;
          letter-spacing:.02em!important;
          text-align:center!important;
          cursor:pointer!important;
          padding:7px 8px!important;
        }
        body.page-catalog-v2 .v2-mobile-detail-tab.active{
          background:linear-gradient(145deg,color-mix(in srgb,var(--element-primary,#f6ca5e) 82%,#fff 18%) 0%,var(--element-primary,#f6ca5e) 44%,color-mix(in srgb,var(--element-secondary,#a855f7) 78%,#111827 22%) 100%)!important;
          border-color:rgba(255,255,255,.36)!important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.16)!important;
        }
        body.page-catalog-v2 .v2-mobile-detail-panel{
          display:block!important;
          width:100%!important;
          margin-top:10px!important;
          padding:13px!important;
          border-radius:18px!important;
          background:rgba(0,0,0,.22)!important;
          border:1px solid rgba(255,255,255,.12)!important;
          line-height:1.38!important;
          white-space:pre-wrap!important;
        }
        body.page-catalog-v2 .v2-detail-card.v2-mobile-tabbed .v2-detail-section{
          display:none!important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  function sections(card){return Array.from(card.querySelectorAll('.v2-detail-section')).filter(section=>section.querySelector('.v2-detail-tab'));}
  function labelOf(section){return section.querySelector('.v2-detail-tab')?.textContent?.trim()||'Details';}
  function panelHtml(section){return section.querySelector('.v2-detail-panel')?.innerHTML||'No details loaded.';}
  function activate(card,index){
    const secs=sections(card);
    if(!secs.length)return;
    const safeIndex=Math.max(0,Math.min(index,secs.length-1));
    const tabs=card.querySelector('.v2-mobile-detail-tabs');
    const panel=card.querySelector('.v2-mobile-detail-panel');
    if(!tabs||!panel)return;
    Array.from(tabs.children).forEach((btn,i)=>{
      btn.classList.toggle('active',i===safeIndex);
      btn.setAttribute('aria-pressed',String(i===safeIndex));
    });
    panel.innerHTML=panelHtml(secs[safeIndex]);
  }
  function upgrade(card){
    if(!isMobile()||!card||card.classList.contains('v2-mobile-tabbed'))return;
    const secs=sections(card);
    if(!secs.length)return;
    const host=secs[0].parentElement;
    if(!host)return;
    card.classList.add('v2-mobile-tabbed');
    const tabs=document.createElement('div');
    tabs.className='v2-mobile-detail-tabs';
    tabs.setAttribute('role','tablist');
    secs.forEach((section,i)=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='v2-mobile-detail-tab'+(i===0?' active':'');
      btn.dataset.v2MobileDetailIndex=String(i);
      btn.setAttribute('aria-pressed',String(i===0));
      btn.textContent=labelOf(section);
      tabs.appendChild(btn);
      section.open=false;
    });
    const panel=document.createElement('div');
    panel.className='v2-mobile-detail-panel';
    panel.innerHTML=panelHtml(secs[0]);
    host.insertBefore(tabs,secs[0]);
    host.insertBefore(panel,secs[0]);
  }
  function upgradeAll(){if(!isMobile())return;document.querySelectorAll('.v2-detail-card').forEach(upgrade);}
  document.addEventListener('click',function(event){
    const btn=event.target.closest('.v2-mobile-detail-tab');
    if(!btn)return;
    event.preventDefault();
    event.stopPropagation();
    const card=btn.closest('.v2-detail-card');
    activate(card,Number(btn.dataset.v2MobileDetailIndex||0));
  },true);
  document.addEventListener('toggle',event=>{
    if(!isMobile())return;
    const pop=event.target;
    if(pop?.classList?.contains('v2-detail-backdrop'))setTimeout(upgradeAll,0);
  },true);
  new MutationObserver(()=>setTimeout(upgradeAll,0)).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{inject();upgradeAll();},{once:true});
  else{inject();upgradeAll();}
})();
