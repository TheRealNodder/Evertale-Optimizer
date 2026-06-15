/* test-catalog-v2-desktop-sidebar-clean.js
   Desktop-only selected sidebar cleanup.
   Tightens the selected module so the portrait/details viewport reads cleaner.
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
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-selected-card{
          padding:8px!important;
          gap:7px!important;
          border-radius:20px!important;
          background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025))!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art{
          border-radius:20px!important;
          border:1px solid rgba(255,255,255,.14)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-info{
          gap:6px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-name{
          margin-top:0!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-awaken-tabs,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-pill-row,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stats,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tabs{
          gap:5px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tab-btn,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-awaken-tabs button{
          min-height:31px!important;
          height:31px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-scroll-panel{
          border-radius:16px!important;
          padding:12px!important;
          background:linear-gradient(180deg,rgba(12,9,28,.74),rgba(9,8,22,.88))!important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject,{once:true});
  else inject();
})();
