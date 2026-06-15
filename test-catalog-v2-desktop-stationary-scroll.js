/* test-catalog-v2-desktop-stationary-scroll.js
   Desktop-only scroll containment.
   Keeps sidebar/filter modules stationary and makes the catalog cards area the scroll container.
   No mobile, data, card-rendering, or detail-logic changes.
*/
(function(){
  function inject(){
    if(document.getElementById('v2-desktop-stationary-scroll-style')) return;
    const style=document.createElement('style');
    style.id='v2-desktop-stationary-scroll-style';
    style.textContent=`
      @media (min-width:821px){
        body.page-catalog-v2.v2-desktop-info-layout-active{
          overflow:hidden!important;
        }
        body.page-catalog-v2.v2-desktop-info-layout-active .page{
          height:calc(100dvh - 72px)!important;
          max-height:calc(100dvh - 72px)!important;
          overflow:hidden!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout{
          height:100%!important;
          max-height:100%!important;
          overflow:hidden!important;
          align-items:stretch!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-sidebar{
          position:relative!important;
          top:auto!important;
          height:100%!important;
          max-height:100%!important;
          overflow:hidden!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-main{
          height:100%!important;
          max-height:100%!important;
          min-height:0!important;
          overflow:hidden!important;
          display:flex!important;
          flex-direction:column!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-hero{
          position:relative!important;
          top:auto!important;
          flex:0 0 auto!important;
          z-index:2!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-grid-panel{
          flex:1 1 auto!important;
          min-height:0!important;
          overflow:auto!important;
          overscroll-behavior:contain!important;
          scrollbar-gutter:stable!important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject,{once:true});
  else inject();
})();
