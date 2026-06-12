/* test-catalog-v2-detail-fix.js
   Adds desktop detail popovers and reliable outside-click close behavior without changing data/order logic.
*/
(function(){
  function injectStyles(){
    if(document.getElementById('v2-detail-fix-style')) return;
    const style=document.createElement('style');
    style.id='v2-detail-fix-style';
    style.textContent=`
      body.page-catalog-v2 #catalogGrid .unitCard .nameBlock{
        position:relative!important;
      }
      body.page-catalog-v2 #catalogGrid .unitCard .v2-detail-btn{
        display:inline-grid!important;
        place-items:center!important;
        position:absolute!important;
        left:0!important;
        top:50%!important;
        transform:translateY(-50%)!important;
        width:34px!important;
        height:34px!important;
        border-radius:999px!important;
        border:1.5px solid color-mix(in srgb,var(--element-primary,#f6ca5e) 72%,#101827 28%)!important;
        background:linear-gradient(145deg,color-mix(in srgb,var(--element-primary,#f6ca5e) 82%,#fff 18%) 0%,var(--element-primary,#f6ca5e) 42%,color-mix(in srgb,var(--element-secondary,#a855f7) 78%,#111827 22%) 100%)!important;
        color:#fff!important;
        font-weight:950!important;
        line-height:1!important;
        cursor:pointer!important;
        z-index:7!important;
      }
      body.page-catalog-v2 .v2-detail-backdrop{
        position:fixed!important;
        inset:0!important;
        z-index:3000!important;
        display:none!important;
        align-items:center!important;
        justify-content:center!important;
        padding:22px!important;
        background:rgba(0,0,0,.52)!important;
        border:0!important;
        margin:0!important;
        width:100vw!important;
        height:100vh!important;
        max-width:none!important;
        max-height:none!important;
        overflow:hidden!important;
      }
      body.page-catalog-v2 .v2-detail-backdrop:popover-open{
        display:flex!important;
      }
      body.page-catalog-v2 .v2-detail-backdrop::backdrop{
        background:rgba(0,0,0,.35)!important;
      }
      body.page-catalog-v2 .v2-detail-card{
        width:min(92vw,560px)!important;
        max-height:min(88vh,780px)!important;
        overflow:auto!important;
        overscroll-behavior:contain!important;
        border-radius:26px!important;
        padding:14px!important;
        border:1px solid color-mix(in srgb,var(--element-primary,#f6ca5e) 48%,rgba(255,255,255,.16))!important;
        background:linear-gradient(145deg,color-mix(in srgb,var(--element-primary,#f6ca5e) 14%,rgba(18,14,36,.96)),rgba(5,5,12,.98))!important;
        box-shadow:0 24px 80px rgba(0,0,0,.62)!important;
      }
      body.page-catalog-v2 .v2-detail-card .unitThumb{
        width:100%!important;
        height:clamp(260px,46vh,420px)!important;
        border-radius:22px!important;
        overflow:hidden!important;
      }
      body.page-catalog-v2 .v2-detail-card .unitThumb img{
        width:100%!important;
        height:100%!important;
        object-fit:cover!important;
        object-position:center top!important;
      }
      body.page-catalog-v2 .v2-detail-name{
        text-align:center!important;
        font-size:clamp(22px,3vw,30px)!important;
        font-weight:950!important;
        margin:12px 0 2px!important;
      }
      body.page-catalog-v2 .v2-detail-title{
        text-align:center!important;
        color:var(--muted)!important;
        font-size:clamp(14px,1.5vw,17px)!important;
        margin:0 auto 12px!important;
      }
      body.page-catalog-v2 .v2-detail-row{
        display:flex!important;
        flex-wrap:wrap!important;
        gap:8px!important;
        justify-content:center!important;
        align-items:center!important;
        margin-top:10px!important;
      }
      body.page-catalog-v2 .v2-detail-stats{
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:7px!important;
        margin-top:10px!important;
        padding:8px!important;
        border-radius:16px!important;
        background:rgba(255,255,255,.06)!important;
      }
      body.page-catalog-v2 .v2-detail-tab{
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        min-height:31px!important;
        padding:7px 12px!important;
        border-radius:999px!important;
        border:1.5px solid color-mix(in srgb,var(--element-primary,#f6ca5e) 72%,#101827 28%)!important;
        background:linear-gradient(145deg,color-mix(in srgb,var(--element-primary,#f6ca5e) 82%,#fff 18%) 0%,var(--element-primary,#f6ca5e) 42%,color-mix(in srgb,var(--element-secondary,#a855f7) 78%,#111827 22%) 100%)!important;
        color:#fff!important;
        font-weight:950!important;
        font-size:12px!important;
      }
      body.page-catalog-v2 .v2-detail-section{
        margin:0!important;
        padding:0!important;
      }
      body.page-catalog-v2 .v2-detail-section[open] .v2-detail-panel{
        display:block!important;
      }
      body.page-catalog-v2 .v2-detail-panel{
        display:none!important;
        margin-top:8px!important;
        padding:12px!important;
        border-radius:18px!important;
        background:rgba(0,0,0,.18)!important;
        border:1px solid rgba(255,255,255,.10)!important;
        line-height:1.35!important;
        white-space:pre-wrap!important;
        max-height:260px!important;
        overflow:auto!important;
      }
      @media (max-width:820px){
        body.page-catalog-v2 #catalogGrid .unitCard .v2-detail-btn{
          position:static!important;
          transform:none!important;
        }
        body.page-catalog-v2 .v2-detail-card{
          width:min(96vw,520px)!important;
          max-height:92vh!important;
        }
        body.page-catalog-v2 .v2-detail-card .unitThumb{
          height:clamp(310px,78vw,470px)!important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  function closePopover(popover){
    if(!popover) return;
    try{
      if(typeof popover.hidePopover === 'function') popover.hidePopover();
      else popover.removeAttribute('popover');
    }catch{}
  }
  function attachCloseHandlers(){
    document.addEventListener('click',function(e){
      const backdrop=e.target.closest('.v2-detail-backdrop');
      if(!backdrop) return;
      if(e.target===backdrop) closePopover(backdrop);
    },true);
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape') return;
      document.querySelectorAll('.v2-detail-backdrop:popover-open').forEach(closePopover);
    },true);
  }
  function boot(){ injectStyles(); attachCloseHandlers(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
