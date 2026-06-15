/* test-catalog-v2-desktop-sidebar-clean.js
   Desktop-only selected sidebar cleanup.
   Keeps the selected module inside the visible viewport and gives detail text a clean scroll area.
   No data, mobile, sorting, or card-rendering changes.
*/
(function(){
  function inject(){
    if(document.getElementById('v2-desktop-sidebar-clean-style')) return;
    const style=document.createElement('style');
    style.id='v2-desktop-sidebar-clean-style';
    style.textContent=`
      @media (min-width:821px){
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-sidebar{
          padding:8px!important;
          background:linear-gradient(180deg,rgba(12,18,34,.96),rgba(7,10,20,.98))!important;
          min-height:0!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-selected-card{
          padding:8px!important;
          gap:6px!important;
          border-radius:20px!important;
          background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025))!important;
          min-height:0!important;
          overflow:hidden!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art{
          border-radius:20px!important;
          border:1px solid rgba(255,255,255,.14)!important;
          min-height:170px!important;
          height:clamp(180px,28dvh,270px)!important;
          max-height:34%!important;
          flex:0 0 auto!important;
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
