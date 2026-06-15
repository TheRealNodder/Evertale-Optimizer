/* test-catalog-v2-desktop-sidebar-fill.js
   Desktop-only sidebar viewport fill.
   Removes the Selected Info header area so the selected/details viewport gets the space.
*/
(function(){
  function inject(){
    if(document.getElementById('v2-desktop-sidebar-fill-style')) return;
    const style=document.createElement('style');
    style.id='v2-desktop-sidebar-fill-style';
    style.textContent=`
      @media (min-width:821px){
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-sidebar > .v2-side-title{
          display:none!important;
          height:0!important;
          min-height:0!important;
          margin:0!important;
          padding:0!important;
          overflow:hidden!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-sidebar{
          gap:8px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-selected-card{
          flex:1 1 auto!important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject,{once:true});
  else inject();
})();
