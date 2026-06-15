/* test-catalog-v2-desktop-portrait-window.js
   Desktop-only portrait window fit.
   Enlarges the selected portrait inside the existing embossed window/mask.
   No layout/data/card changes.
*/
(function(){
  function inject(){
    if(document.getElementById('v2-desktop-portrait-window-style')) return;
    const style=document.createElement('style');
    style.id='v2-desktop-portrait-window-style';
    style.textContent=`
      @media (min-width:821px){
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art{
          position:relative!important;
          padding:0!important;
          overflow:hidden!important;
          isolation:isolate!important;
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
      }
    `;
    document.head.appendChild(style);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject,{once:true});
  else inject();
})();
