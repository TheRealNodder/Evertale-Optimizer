(function(){
  const STYLE_ID='catalog-grid-mobile-image-fill-authority-style';
  const CSS=`
    @media(max-width:820px){
      body.page-catalog-v2 #catalogGrid .unitCard .unitThumb{
        width:100%!important;
        height:clamp(300px,76vw,430px)!important;
        min-height:300px!important;
        max-height:none!important;
        overflow:hidden!important;
        display:block!important;
        position:relative!important;
        border-radius:20px!important;
      }
      body.page-catalog-v2 #catalogGrid .unitCard .unitThumb > img{
        width:100%!important;
        height:100%!important;
        min-width:100%!important;
        min-height:100%!important;
        max-width:none!important;
        max-height:none!important;
        object-fit:cover!important;
        object-position:center top!important;
        display:block!important;
        transform:scale(1.10)!important;
        transform-origin:center top!important;
      }
    }
    @media(max-width:430px){
      body.page-catalog-v2 #catalogGrid .unitCard .unitThumb{
        height:clamp(286px,82vw,390px)!important;
        min-height:286px!important;
        max-height:none!important;
      }
    }
  `;

  function apply(){
    let style=document.getElementById(STYLE_ID);
    if(!style){
      style=document.createElement('style');
      style.id=STYLE_ID;
      style.textContent=CSS;
    }
    document.head.appendChild(style);
    window.__EVERTALE_CATALOG_GRID_MOBILE_IMAGE_FILL_AUTHORITY=true;
  }

  apply();
  document.addEventListener('DOMContentLoaded',apply,{once:true});
  window.addEventListener('load',apply,{once:true});
})();
