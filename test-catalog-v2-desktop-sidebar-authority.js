/* test-catalog-v2-desktop-sidebar-authority.js
   Consolidated desktop-only sidebar/layout authority.
   Replaces separate portrait-window, sidebar-fill, stationary-scroll, and sidebar-clean patch layers.
   No mobile, data, sorting, card-rendering, or detail-population changes.
*/
(function(){
  function inject(){
    if(document.getElementById('v2-desktop-sidebar-authority-style')) return;
    const style=document.createElement('style');
    style.id='v2-desktop-sidebar-authority-style';
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
          min-height:0!important;
          overflow:hidden!important;
          gap:8px!important;
          padding:8px!important;
          background:linear-gradient(180deg,rgba(12,18,34,.96),rgba(7,10,20,.98))!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-sidebar > .v2-side-title{
          display:none!important;
          height:0!important;
          min-height:0!important;
          margin:0!important;
          padding:0!important;
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
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-selected-card{
          flex:1 1 auto!important;
          padding:8px!important;
          gap:6px!important;
          border-radius:20px!important;
          background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025))!important;
          min-height:0!important;
          overflow:hidden!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art{
          position:relative!important;
          padding:0!important;
          overflow:hidden!important;
          isolation:isolate!important;
          border-radius:20px!important;
          border:1px solid rgba(255,255,255,.14)!important;
          min-height:170px!important;
          height:clamp(180px,28dvh,270px)!important;
          max-height:34%!important;
          flex:0 0 auto!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art img,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art picture,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art canvas{
          width:100%!important;
          height:100%!important;
          max-width:none!important;
          max-height:none!important;
          object-fit:cover!important;
          object-position:center top!important;
          display:block!important;
          transform:scale(1.08)!important;
          transform-origin:center top!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art::after{
          content:''!important;
          position:absolute!important;
          inset:0!important;
          pointer-events:none!important;
          z-index:2!important;
          border-radius:inherit!important;
          box-shadow:inset 0 2px 0 rgba(255,255,255,.18),inset 0 -24px 42px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.10)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-info{
          gap:5px!important;
          flex:0 0 auto!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-name{
          margin-top:0!important;
          font-size:clamp(18px,1.65vw,24px)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-title{
          font-size:12px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-awaken-tabs,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-pill-row,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stats,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tabs{
          gap:5px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-pill-row>*{
          min-height:28px!important;
          padding:5px 7px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stat{
          padding:5px 4px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stat span{
          font-size:9px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stat b{
          font-size:12px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tab-btn,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-awaken-tabs button{
          min-height:29px!important;
          height:29px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-description{
          flex:1 1 auto!important;
          min-height:0!important;
          overflow:hidden!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-scroll-panel{
          flex:1 1 auto!important;
          min-height:120px!important;
          overflow:auto!important;
          overscroll-behavior:contain!important;
          border-radius:16px!important;
          padding:12px!important;
          background:linear-gradient(180deg,rgba(12,9,28,.74),rgba(9,8,22,.88))!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-scroll-panel p{
          margin:0 0 10px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject,{once:true});
  else inject();
})();
