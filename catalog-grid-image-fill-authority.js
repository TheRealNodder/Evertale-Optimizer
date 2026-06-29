/* catalog-grid-image-fill-authority.js
   Visual-only authority for Catalog grid image boxes.
   Does not mutate data, image paths, state rows, loader output, or sidebar behavior.
*/
(function(){
  const STYLE_ID='catalog-grid-image-fill-authority-style';

  function inject(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      body.page-catalog-v2 #catalogGrid .unitCard .unitThumb{
        width:100%!important;
        height:clamp(300px,28vw,430px)!important;
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
        transform:scale(var(--catalog-grid-image-zoom,1.12))!important;
        transform-origin:center top!important;
      }
      body.page-catalog-v2 #catalogGrid .unitCard[data-kind="weapons"] .unitThumb > img,
      body.page-catalog-v2 #catalogGrid .unitCard[data-kind="accessories"] .unitThumb > img{
        --catalog-grid-image-zoom:1.04;
      }
      body.page-catalog-v2 #catalogGrid .unitCard[data-kind="bosses"] .unitThumb > img{
        --catalog-grid-image-zoom:1.08;
      }
      @media(max-width:820px){
        body.page-catalog-v2 #catalogGrid .unitCard .unitThumb{
          height:clamp(300px,76vw,430px)!important;
          min-height:300px!important;
        }
        body.page-catalog-v2 #catalogGrid .unitCard .unitThumb > img{
          --catalog-grid-image-zoom:1.10;
        }
      }
      @media(max-width:430px){
        body.page-catalog-v2 #catalogGrid .unitCard .unitThumb{
          height:clamp(286px,82vw,390px)!important;
          min-height:286px!important;
        }
      }
    `;
    document.head.appendChild(style);
    window.__EVERTALE_CATALOG_GRID_IMAGE_FILL_AUTHORITY=true;
  }

  inject();
  document.addEventListener('DOMContentLoaded',inject,{once:true});
})();
