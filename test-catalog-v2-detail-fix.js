/* test-catalog-v2-detail-fix.js
   Strict desktop/mobile separation.
   Cards do not show action buttons. Mobile opens the detail popup by tapping the card.
   Mobile popup awaken buttons update the popup and host card state.
*/
(function(){
  const BREAKPOINT=820;
  const isMobile=()=>window.innerWidth<=BREAKPOINT;
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const safe=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/\n/g,'<br>');
  const clean=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');

  function injectStyles(){
    if(document.getElementById('v2-detail-fix-style'))return;
    const style=document.createElement('style');
    style.id='v2-detail-fix-style';
    style.textContent=`
      @media (min-width:821px){
        body.page-catalog-v2 #catalogGrid .unitCard .skillMini,
        body.page-catalog-v2 #catalogGrid .unitCard .v2-detail-btn{display:none!important;}
        body.page-catalog-v2 #catalogGrid .unitCard .stateRow,
        body.page-catalog-v2 #catalogGrid .unitCard .duoFormBtn{display:flex!important;}
      }
      @media (max-width:820px){
        body.page-catalog-v2 #catalogGrid .unitCard .v2-detail-btn{display:inline-flex!important;}
        body.page-catalog-v2 #catalogGrid .unitCard .skillMini button[data-v2-skill]{display:none!important;}
        body.page-catalog-v2 #catalogGrid .unitCard .duoFormBtn{display:flex!important;}
        body.page-catalog-v2 #catalogGrid .unitCard .nameBlock{
          display:flex!important;
          flex-direction:column!important;
          align-items:center!important;
          justify-content:center!important;
          gap:8px!important;
          text-align:center!important;
        }
        body.page-catalog-v2 #catalogGrid .unitCard .unitName{
          order:1!important;
          width:100%!important;
          text-align:center!important;
        }
        body.page-catalog-v2 #catalogGrid .unitCard .unitTitle{
          order:2!important;
          width:100%!important;
          max-width:100%!important;
          text-align:center!important;
          white-space:normal!important;
          overflow-wrap:normal!important;
          word-break:normal!important;
          line-height:1.15!important;
        }
        body.page-catalog-v2 #catalogGrid .unitCard .stateRow{
          order:3!important;
          display:flex!important;
          flex-direction:row!important;
          flex-wrap:nowrap!important;
          justify-content:center!important;
          align-items:center!important;
          gap:8px!important;
          width:100%!important;
        }
        body.page-catalog-v2 #catalogGrid .unitCard .stateRow .stateBtn,
        body.page-catalog-v2 .v2-detail-backdrop .stateRow .stateBtn{
          flex:0 0 auto!important;
          width:34px!important;
          min-width:34px!important;
          max-width:34px!important;
          height:34px!important;
          min-height:34px!important;
          padding:0!important;
          display:inline-flex!important;
          align-items:center!important;
          justify-content:center!important;
        }
        body.page-catalog-v2 #catalogGrid .unitCard .duoFormBtn{order:4!important;}
        body.page-catalog-v2 .v2-detail-backdrop .stateRow{
          display:flex!important;
          flex-direction:row!important;
          flex-wrap:nowrap!important;
          justify-content:center!important;
          align-items:center!important;
          gap:8px!important;
          width:100%!important;
        }
      }
      body.page-catalog-v2 .v2-detail-backdrop{
        position:fixed!important;inset:0!important;z-index:3000!important;display:none!important;
        align-items:center!important;justify-content:center!important;padding:22px!important;
        background:rgba(0,0,0,.52)!important;border:0!important;margin:0!important;
        width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;overflow:hidden!important;
      }
      body.page-catalog-v2 .v2-detail-backdrop:popover-open,
      body.page-catalog-v2 .v2-detail-backdrop[data-v2-open="true"]{display:flex!important;}
      body.page-catalog-v2 .v2-detail-backdrop::backdrop{background:rgba(0,0,0,.35)!important;}
      body.page-catalog-v2 .v2-detail-card{
        width:min(92vw,560px)!important;max-height:min(88vh,780px)!important;overflow:auto!important;
        overscroll-behavior:contain!important;border-radius:26px!important;padding:14px!important;
        border:1px solid color-mix(in srgb,var(--element-primary,#f6ca5e) 48%,rgba(255,255,255,.16))!important;
        background:linear-gradient(145deg,color-mix(in srgb,var(--element-primary,#f6ca5e) 14%,rgba(18,14,36,.96)),rgba(5,5,12,.98))!important;
        box-shadow:0 24px 80px rgba(0,0,0,.62)!important;
      }
      body.page-catalog-v2 .v2-detail-card .unitThumb{width:100%!important;height:clamp(260px,46vh,420px)!important;border-radius:22px!important;overflow:hidden!important;}
      body.page-catalog-v2 .v2-detail-card .unitThumb img{width:100%!important;height:100%!important;object-fit:cover!important;object-position:center top!important;}
      body.page-catalog-v2 .v2-detail-name{text-align:center!important;font-size:clamp(22px,3vw,30px)!important;font-weight:950!important;margin:12px 0 2px!important;}
      body.page-catalog-v2 .v2-detail-title{text-align:center!important;color:var(--muted)!important;font-size:clamp(14px,1.5vw,17px)!important;margin:0 auto 12px!important;}
      body.page-catalog-v2 .v2-detail-row{display:flex!important;flex-wrap:wrap!important;gap:8px!important;justify-content:center!important;align-items:center!important;margin-top:10px!important;}
      body.page-catalog-v2 .v2-detail-stats{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:7px!important;margin-top:10px!important;padding:8px!important;border-radius:16px!important;background:rgba(255,255,255,.06)!important;}
      body.page-catalog-v2 .v2-detail-tabs-card{margin-top:12px!important;border-radius:20px!important;border:1px solid rgba(255,255,255,.12)!important;background:rgba(0,0,0,.18)!important;padding:10px!important;}
      body.page-catalog-v2 .v2-detail-tabbar{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:7px!important;align-items:stretch!important;}
      body.page-catalog-v2 .v2-popup-tab-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:34px!important;padding:6px 5px!important;border-radius:999px!important;border:1.5px solid color-mix(in srgb,var(--element-primary,#f6ca5e) 62%,#101827 38%)!important;background:rgba(255,255,255,.08)!important;color:#fff!important;font-weight:950!important;font-size:11px!important;line-height:1.05!important;text-align:center!important;}
      body.page-catalog-v2 .v2-popup-tab-btn.active,
      body.page-catalog-v2 .v2-popup-tab-btn[aria-selected="true"]{background:linear-gradient(145deg,color-mix(in srgb,var(--element-primary,#f6ca5e) 82%,#fff 18%),var(--element-primary,#f6ca5e),color-mix(in srgb,var(--element-secondary,#a855f7) 76%,#111827 24%))!important;border-color:rgba(255,255,255,.48)!important;color:#fff!important;box-shadow:0 0 0 2px rgba(255,255,255,.14),0 8px 22px color-mix(in srgb,var(--element-primary,#f6ca5e) 30%,transparent)!important;}
      body.page-catalog-v2 .v2-detail-panel{display:none!important;margin-top:10px!important;padding:12px!important;border-radius:16px!important;background:rgba(0,0,0,.20)!important;border:1px solid rgba(255,255,255,.10)!important;line-height:1.35!important;white-space:pre-wrap!important;height:clamp(130px,24vh,250px)!important;overflow:auto!important;}
      body.page-catalog-v2 .v2-detail-panel.active{display:block!important;}
      body.page-catalog-v2 .v2-detail-tab{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:31px!important;padding:7px 12px!important;border-radius:999px!important;border:1.5px solid color-mix(in srgb,var(--element-primary,#f6ca5e) 72%,#101827 28%)!important;background:rgba(255,255,255,.08)!important;color:#fff!important;font-weight:950!important;font-size:12px!important;}
      body.page-catalog-v2 .v2-detail-section[open] > .v2-detail-tab,
      body.page-catalog-v2 .v2-detail-tab.active{background:linear-gradient(145deg,color-mix(in srgb,var(--element-primary,#f6ca5e) 82%,#fff 18%),var(--element-primary,#f6ca5e),color-mix(in srgb,var(--element-secondary,#a855f7) 76%,#111827 24%))!important;border-color:rgba(255,255,255,.48)!important;color:#fff!important;box-shadow:0 0 0 2px rgba(255,255,255,.14),0 8px 22px color-mix(in srgb,var(--element-primary,#f6ca5e) 30%,transparent)!important;}
      body.page-catalog-v2 .v2-detail-section:not([open]) .v2-detail-panel{display:none!important;}
      body.page-catalog-v2 .v2-detail-section[open] .v2-detail-panel{display:block!important;}
      @media(max-width:820px){
        body.page-catalog-v2 .v2-detail-card{width:min(96vw,520px)!important;max-height:92vh!important;}
        body.page-catalog-v2 .v2-detail-card .unitThumb{height:clamp(310px,78vw,470px)!important;}
        body.page-catalog-v2 .v2-detail-panel{height:clamp(120px,22vh,220px)!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function readSkills(card,type){
    try{
      const rows=JSON.parse(decodeURIComponent(card?.getAttribute(type==='active'?'data-active-skills':'data-passive-skills')||''));
      return Array.isArray(rows)?rows:[];
    }catch{return[];}
  }
  function detailSkillHtml(rows){return rows.length?rows.map(s=>`<p><strong>${safe(s.name||s.id||'Skill')}</strong><br>${safe(s.description||s.desc||'No description loaded.')}</p>`).join(''):'No skills loaded.';}
  function detailPanel(id,html,active=false){return`<div class="v2-detail-panel${active?' active':''}" id="${id}" role="tabpanel">${html||'No details loaded.'}</div>`;}
  function detailTabs(panels){return`<div class="v2-detail-tabs-card"><div class="v2-detail-tabbar" role="tablist">${panels.map((p,i)=>`<button type="button" class="v2-popup-tab-btn${i===0?' active':''}" role="tab" aria-selected="${i===0?'true':'false'}" data-v2-popup-tab="${p.key}" aria-controls="${p.id}">${p.label}</button>`).join('')}</div><div class="v2-detail-panels">${panels.map((p,i)=>detailPanel(p.id,p.html,i===0)).join('')}</div></div>`;}
  function cardDetailId(card){return card?.querySelector('.v2-detail-btn')?.getAttribute('popovertarget')||`v2d-${clean(card?.getAttribute('data-id')||card?.getAttribute('data-source-id')||q('.unitName',card)?.textContent||'detail')}`;}
  function cardElementClass(card){return [...(card?.classList||[])].find(c=>/^el-/.test(c))||'';}
  function cardDescription(card){
    const direct=card?.getAttribute('data-description')||'';
    if(direct)return direct;
    try{const rows=JSON.parse(decodeURIComponent(q('.descriptionPanel',card)?.getAttribute('data-descriptions')||''));return rows?.[Number(card?.getAttribute('data-duo-index')||0)]||rows?.[0]||'';}catch{return'';}
  }
  function ensureDetailPopover(card){
    if(!card)return null;
    const id=cardDetailId(card);
    let pop=card.querySelector(`.v2-detail-backdrop#${CSS.escape(id)}`)||document.getElementById(id);
    if(!pop){pop=document.createElement('div');pop.id=id;pop.className='v2-detail-backdrop';pop.setAttribute('popover','');card.appendChild(pop);}
    const img=q('.unitThumb',card)?.innerHTML||'<div class="ph">?</div>';
    const name=q('.unitName',card)?.textContent?.trim()||'Selected';
    const title=q('.unitTitle',card)?.textContent?.trim()||'';
    const skillTop=[q('.stateRow',card)?.outerHTML||'',q('.duoFormBtn',card)?.outerHTML||''].join('');
    const chips=qa('.chipCol .tag',card).map(x=>x.outerHTML).join('');
    const stats=q('.statLine',card)?.innerHTML||'';
    const leader=q('.leaderBlock',card)?.innerHTML||'No leader skill text loaded.';
    const desc=safe(cardDescription(card)||'No description loaded.');
    const panels=[
      {key:'leader',label:'Leader',id:`${id}-leader`,html:leader},
      {key:'active',label:'Active',id:`${id}-active`,html:detailSkillHtml(readSkills(card,'active'))},
      {key:'passive',label:'Passive',id:`${id}-passive`,html:detailSkillHtml(readSkills(card,'passive'))},
      {key:'description',label:'Desc',id:`${id}-description`,html:desc}
    ];
    pop.innerHTML=`<div class="v2-detail-card ${cardElementClass(card)}"><div class="unitThumb">${img}</div><div class="v2-detail-name">${safe(name)}</div><div class="v2-detail-title">${safe(title)}</div><div class="v2-detail-row">${skillTop}</div><div class="v2-detail-row">${chips}</div>${stats?`<div class="v2-detail-stats">${stats}</div>`:''}${detailTabs(panels)}</div>`;
    return pop;
  }
  function openDetail(card){
    const pop=ensureDetailPopover(card);if(!pop)return false;
    pop.dataset.v2Open='true';
    try{pop.showPopover();}catch{pop.setAttribute('popover','manual');try{pop.showPopover();}catch{}}
    return true;
  }
  function closePopover(pop){try{if(typeof pop?.hidePopover==='function')pop.hidePopover();}catch{}if(pop)pop.dataset.v2Open='false';}
  function openPopovers(){return qa('.v2-detail-backdrop:popover-open,.v2-detail-backdrop[data-v2-open="true"]');}
  function closeWhenClickOff(e){
    if(!isMobile())return false;
    const open=openPopovers();
    if(!open.length)return false;
    if(e.target.closest('.v2-detail-card'))return false;
    open.forEach(closePopover);
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    return true;
  }

  function stateRows(card){
    if(window.EvertaleCatalogV2&&typeof window.EvertaleCatalogV2.readStateRows==='function'){
      try{return window.EvertaleCatalogV2.readStateRows(card).filter(Boolean);}catch{}
    }
    try{
      const rows=JSON.parse(decodeURIComponent(card?.getAttribute('data-state-rows')||q('.stateRow',card)?.dataset?.states||'[]'));
      return Array.isArray(rows)?rows.filter(Boolean):[];
    }catch{return[];}
  }

  function setHostCardState(card,idx){
    const rows=stateRows(card);
    idx=Math.max(0,Math.min(Number(idx)||0,Math.max(rows.length-1,qa('.stateRow .stateBtn',card).length-1,0)));
    if(window.EvertaleCatalogV2&&typeof window.EvertaleCatalogV2.applyState==='function'){
      window.EvertaleCatalogV2.applyState(card,idx);
    }else{
      const img=q('.unitThumb img',card);
      if(img&&rows[idx]?.image){img.setAttribute('src',rows[idx].image);img.dataset.state=String(idx);}
    }
    card.setAttribute('data-duo-index',String(idx));
    qa('.stateRow .stateBtn',card).forEach((b,i)=>{const on=i===idx;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  }

  function activatePopupTab(tab){
    const card=tab.closest('.v2-detail-card');
    if(!card)return;
    const key=tab.getAttribute('data-v2-popup-tab')||'';
    qa('.v2-popup-tab-btn',card).forEach(btn=>{
      const on=btn===tab;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-selected',String(on));
    });
    qa('.v2-detail-panel',card).forEach(panel=>panel.classList.toggle('active',panel.id.endsWith(`-${key}`)));
  }

  function attachHandlers(){
    document.addEventListener('pointerdown',closeWhenClickOff,true);
    document.addEventListener('click',e=>{closeWhenClickOff(e);},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')openPopovers().forEach(closePopover);},true);
    document.addEventListener('click',e=>{
      if(!isMobile())return;
      const popupTab=e.target.closest('.v2-detail-backdrop .v2-popup-tab-btn');
      if(popupTab){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        activatePopupTab(popupTab);
        return;
      }
      const popSectionTab=e.target.closest('.v2-detail-backdrop .v2-detail-section > .v2-detail-tab');
      if(popSectionTab){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        const section=popSectionTab.closest('.v2-detail-section');
        const pop=popSectionTab.closest('.v2-detail-backdrop');
        if(section&&pop){
          const willOpen=!section.open;
          qa('.v2-detail-section',pop).forEach(s=>{
            s.open=false;
            q('.v2-detail-tab',s)?.classList.remove('active');
          });
          section.open=willOpen;
          popSectionTab.classList.toggle('active',willOpen);
        }
        return;
      }
      const popState=e.target.closest('.v2-detail-backdrop .stateRow .stateBtn');
      if(popState){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        const pop=popState.closest('.v2-detail-backdrop');
        const host=pop?.closest('.unitCard');
        if(host){setHostCardState(host,popState.dataset.idx||0);ensureDetailPopover(host);try{pop.showPopover();}catch{}pop.dataset.v2Open='true';}
        return;
      }
      const detailBtn=e.target.closest('#catalogGrid .unitCard .v2-detail-btn');
      if(detailBtn){
        const card=detailBtn.closest('.unitCard');
        if(card){
          e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
          card.classList.add('v2-selected');
          openDetail(card);
        }
        return;
      }
      const card=e.target.closest('#catalogGrid .unitCard');
      if(card&&!e.target.closest('.stateRow .stateBtn,.duoFormBtn,button,input,select,a')){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        card.classList.add('v2-selected');
        openDetail(card);
      }
    },true);
  }
  function boot(){injectStyles();attachHandlers();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();