/* catalog-mobile-hide-main-detail-button.js
   Mobile-only guard. The popup still opens by tapping the card.
   This only removes the old Details/Description button from the main card surface.
*/
(function(){
  const STYLE_ID='catalog-mobile-hide-main-detail-button-style';
  function install(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      @media (max-width:820px){
        body.page-catalog-v2 #catalogGrid .unitCard .v2-detail-btn,
        body.page-catalog-v2 #catalogGrid .unitCard .nameBlock > .v2-detail-btn{
          display:none!important;
          visibility:hidden!important;
          pointer-events:none!important;
          width:0!important;
          min-width:0!important;
          max-width:0!important;
          height:0!important;
          min-height:0!important;
          max-height:0!important;
          padding:0!important;
          margin:0!important;
          border:0!important;
          overflow:hidden!important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
