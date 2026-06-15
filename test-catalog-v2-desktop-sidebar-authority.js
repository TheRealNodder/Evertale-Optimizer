/* test-catalog-v2-desktop-sidebar-authority.js
   Consolidated desktop-only sidebar/layout authority.
   Concept-inspired sheen pass: element-reactive sidebar gradient, top-left shine, cleaner tabs.
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
          border-radius:26px!important;
          border:1px solid color-mix(in srgb,var(--element-primary,#a855f7) 52%,rgba(255,255,255,.16))!important;
          background:
            radial-gradient(circle at 0% 0%,color-mix(in srgb,var(--element-primary,#a855f7) 44%,transparent) 0%,transparent 34%),
            linear-gradient(135deg,color-mix(in srgb,var(--element-primary,#a855f7) 20%,rgba(255,255,255,.07)) 0%,rgba(15,22,42,.96) 34%,rgba(6,9,19,.98) 100%)!important;
          box-shadow:
            0 0 0 1px rgba(255,255,255,.045),
            0 0 34px color-mix(in srgb,var(--element-primary,#a855f7) 34%,transparent),
            0 22px 70px rgba(0,0,0,.46)!important;
          isolation:isolate!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-sidebar::before{
          content:''!important;
          position:absolute!important;
          inset:0!important;
          border-radius:inherit!important;
          pointer-events:none!important;
          z-index:0!important;
          background:
            linear-gradient(135deg,rgba(255,255,255,.30) 0%,rgba(255,255,255,.12) 10%,transparent 24%),
            radial-gradient(circle at 8% 5%,rgba(255,255,255,.28),transparent 22%),
            linear-gradient(180deg,rgba(255,255,255,.08),transparent 42%)!important;
          mix-blend-mode:screen!important;
          opacity:.85!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-sidebar > *{
          position:relative!important;
          z-index:1!important;
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
          padding:10px!important;
          gap:7px!important;
          border-radius:22px!important;
          min-height:0!important;
          overflow:hidden!important;
          border:1px solid color-mix(in srgb,var(--element-primary,#a855f7) 45%,rgba(255,255,255,.12))!important;
          background:
            linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.025)),
            radial-gradient(circle at 12% 0%,color-mix(in srgb,var(--element-primary,#a855f7) 20%,transparent),transparent 38%)!important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.11),inset 0 -24px 48px rgba(0,0,0,.20)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art{
          position:relative!important;
          padding:0!important;
          overflow:hidden!important;
          isolation:isolate!important;
          border-radius:20px!important;
          border:1px solid color-mix(in srgb,var(--element-primary,#a855f7) 42%,rgba(255,255,255,.18))!important;
          min-height:170px!important;
          height:clamp(180px,28dvh,270px)!important;
          max-height:34%!important;
          flex:0 0 auto!important;
          background:radial-gradient(circle at 50% 18%,rgba(255,255,255,.16),rgba(0,0,0,.20) 64%,rgba(0,0,0,.42))!important;
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
          box-shadow:inset 0 2px 0 rgba(255,255,255,.20),inset 0 -24px 42px rgba(0,0,0,.30),inset 0 0 0 1px rgba(255,255,255,.10)!important;
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
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stats{
          gap:5px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-pill-row>*{
          min-height:28px!important;
          padding:5px 7px!important;
          background:rgba(255,255,255,.07)!important;
          border-color:rgba(255,255,255,.13)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stat{
          padding:5px 4px!important;
          background:rgba(255,255,255,.06)!important;
          border-color:rgba(255,255,255,.11)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stat span{
          font-size:9px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stat b{
          font-size:12px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-awaken-tabs button{
          min-height:31px!important;
          height:31px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-description{
          flex:1 1 auto!important;
          min-height:0!important;
          overflow:hidden!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tabs{
          display:grid!important;
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:4px!important;
          width:100%!important;
          min-width:0!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tab-btn{
          min-width:0!important;
          width:100%!important;
          max-width:100%!important;
          min-height:31px!important;
          height:31px!important;
          padding:5px 2px!important;
          overflow:hidden!important;
          text-overflow:clip!important;
          white-space:normal!important;
          line-height:1.02!important;
          font-size:8px!important;
          letter-spacing:0!important;
          border-radius:11px!important;
          box-sizing:border-box!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-scroll-panel{
          flex:1 1 auto!important;
          min-height:120px!important;
          overflow:auto!important;
          overscroll-behavior:contain!important;
          border-radius:16px!important;
          padding:12px!important;
          border:1px solid color-mix(in srgb,var(--element-primary,#a855f7) 32%,rgba(255,255,255,.12))!important;
          background:
            linear-gradient(180deg,rgba(12,9,28,.78),rgba(8,8,20,.92)),
            radial-gradient(circle at 10% 0%,color-mix(in srgb,var(--element-primary,#a855f7) 16%,transparent),transparent 34%)!important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.08)!important;
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
