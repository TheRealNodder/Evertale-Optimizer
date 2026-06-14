/* test-catalog-v2-mobile-standalone.js
   Mobile-only standalone catalog pass.
   Hides the selected preview/description hero on mobile without changing desktop layout.
   Revert path: remove this script tag from test-catalog-v2.html or delete this file.
*/
(function(){
  function inject(){
    if(document.getElementById('v2-mobile-standalone-style')) return;
    const style=document.createElement('style');
    style.id='v2-mobile-standalone-style';
    style.textContent=`
      @media (max-width:820px){
        body.page-catalog-v2 .v2-main > .v2-hero{
          display:none!important;
        }
      }
      @media (min-width:821px){
        body.page-catalog-v2 .v2-main > .v2-hero{
          display:block!important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject);
  else inject();
})();
