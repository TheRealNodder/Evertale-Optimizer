/* Original, code-native theme illustrations. Not extracted game artwork.
   Each profile owns a recognizable crest, environment, and motion vocabulary.
   No network requests, canvas loop, random placement, or application data. */
(function(g,d){
  'use strict';
  const VERSION=1;
  const path=(shape,cls='',extra='')=>`<path d="${shape}" class="${cls}" ${extra}/>`;
  const circle=(x,y,r,cls='')=>`<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;
  const group=(content,cls='',extra='')=>`<g class="${cls}" ${extra}>${content}</g>`;
  const mirror=content=>content+group(content,'','transform="scale(-1 1)"');
  const wing=path('M0 18 Q-48-48-150-93 L-126-40-158-47-115-8-142-6-81 29-105 40-36 47Z');
  const feather=path('M0 62 Q-62 2-147-99 Q-95-96-61-55 L-32-81-14-18 0-49Z');
  const diamond=path('M0-92 65 0 0 92-65 0Z');
  const crystal=mirror(path('M0 108-34 18-102-90-44-53-66-158-9-100 0-179Z'));
  const tail=path('M0-80 C-128-140-168 12-46 32 C79 51 96 132-31 166','legendaryScene__body');
  const eyes=path('M-32-12-12-7 M12-7 32-12','legendaryScene__detail');
  const crests={
    hooh:mirror(feather)+path('M-25 22 0-23 25 22 0 111Z')+group(mirror(path('M-16 80-39 149-18 137 0 185 5 81')),'legendaryScene__detail'),
    lugia:mirror(wing)+path('M-22-7-16-67 0-90 16-67 22-7 36 62 0 114-36 62Z')+group(mirror(path('M-20 8-43 18-29 34-43 49-18 57')),'legendaryScene__mark'),
    suicune:mirror(path('M-10 40 C-148-64-165 104-80 139 C-32 161-62 33-153 55','legendaryScene__ribbon'))+path('M0-130 53-63 0-9-53-63Z M-33-13 0 13 33-13 47 65 0 119-47 65Z')+path('M0-103 27-64 0-35-27-64Z','legendaryScene__detail'),
    groudon:mirror(path('M-15-134-64-114-51-75-103-79-78-37-133-28-105 14-145 39-99 67-116 105-61 115-43 151-12 132Z'))+path('M-42 70V-5 Q-42-57 0-57 Q42-57 42-5V70 M-64 72H-20 M20 72H64','legendaryScene__mark'),
    kyogre:mirror(path('M-19-94 Q-61-85-78-31 L-163-17-131 21-172 38-127 59-160 77-77 70 Q-55 133 0 142 L0-94Z'))+group(mirror(path('M-132 15-83 20-63 56-35 37-28-22 M-113 55-84 48')),'legendaryScene__mark')+path('M-24-66 0-77 24-66 M-23 105H23','legendaryScene__detail'),
    rayquaza:tail+path('M-50-96-88-153-31-137 0-162 25-128 85-141 53-90 15-66Z')+group(path('M-52-91-24-88-8-69 M35-109 14-98 M-34 9-18-12 8 11-10 31 M14 83 36 106 15 125-5 102'),'legendaryScene__mark'),
    dialga:mirror(path('M0-141-29-88-52-113-48-47-102-65-66-11-86 24-35 31-48 104 0 143Z'))+group(diamond,'legendaryScene__mark','transform="scale(.44 .65)"')+path('M-81 38-128 86-70 76 M81 38 128 86 70 76','legendaryScene__detail'),
    palkia:mirror(path('M0-124-35-99-41-45-105-59-139-9-114 37-47 26-35 93 0 137Z'))+circle(-104,-8,26,'legendaryScene__pearl')+circle(104,-8,26,'legendaryScene__pearl')+path('M-22-58 0-87 22-58 0-26Z','legendaryScene__mark'),
    giratina:mirror(path('M-9-99-48-149-64-77-142-114-103-33-173-45-121 29-161 72-80 70-38 133-7 91Z'))+path('M-20-75 0-104 20-75 29 93 0 153-29 93Z')+path('M-28-28H28 M-32 13H32 M-28 54H28','legendaryScene__mark'),
    arceus:mirror(path('M-12-126-34-73-20-39-44 34-22 122 0 139V-126Z'))+path('M-133 0-100-24-42-34 0-70 42-34 100-24 133 0 100 24 42 34 0 70-42 34-100 24Z','legendaryScene__ring')+circle(0,0,107,'legendaryScene__orbit'),
    reshiram:mirror(wing)+path('M0-135-23-95-18-45-43 25-15 77 0 100 15 77 43 25 18-45 23-95Z')+circle(0,109,48,'legendaryScene__ring')+circle(0,109,21,'legendaryScene__mark'),
    zekrom:mirror(path('M-15-31-64-119-159-143-116-57-148-26-63 18-52 67-13 74Z'))+path('M-21-78 0-130 26-73 23 60 0 103-24 60Z')+circle(0,112,50,'legendaryScene__ring')+path('M9 70-18 109 9 104-4 148 27 98 4 104Z','legendaryScene__detail'),
    blackkyurem:crystal+path('M-90-35-42-59-24-18 4-76 48-31 82-16 42 37 3 53-44 30Z')+path('M-65-1-17 12 0 47 25 16 61 7','legendaryScene__mark'),
    whitekyurem:crystal+path('M-112 22-53-36-18-28 0-99 33-39 109 9 64 32 21 29 0 76-30 27Z')+path('M-49-12 0 4 52-1','legendaryScene__detail'),
    xerneas:mirror(path('M-13 73-18-10-54-40-77-110-62-86-40-91-45-153-26-106-9-132 0-57','legendaryScene__antler'))+path('M-27 19 0-13 27 19 17 67 0 95-17 67Z')+group(mirror(path('M-51-46-111-67-129-115 M-79-61-94-135','legendaryScene__antler')),'legendaryScene__spectrum'),
    yveltal:mirror(path('M-15-32-85-99-174-145-155-84-127-75-135-51-97-36-106-14-60 12-24 67Z'))+path('M-20-63 0-93 20-63 22 56 57 130 13 111 0 148-13 111-57 130-22 56Z')+path('M-13-39 0-28 13-39 M0-22V63','legendaryScene__detail'),
    zygarde:mirror(path('M0-138-67-101-86-34-63 34-88 112-18 81 0 141Z'))+Array.from({length:5},(_,i)=>group(path('M0-14 12-7V7L0 14-12 7V-7Z'),'legendaryScene__cell',`transform="translate(${(i%2)*32-16} ${i*35-70})"`)).join(''),
    solgaleo:mirror(path('M0-164-25-108-79-136-64-75-132-78-94-26-158 0-94 26-132 78-64 75-79 136-25 108 0 164Z'))+path('M-55-36 0-73 55-36 42 35 0 76-42 35Z','legendaryScene__detail')+eyes,
    lunala:mirror(path('M-15-29 Q-88-124-170-148 Q-141-61-166 36 L-103 4-111 88-60 55-38 124 0 61Z'))+path('M-23-50 0-93 23-50 16 32 0 61-16 32Z')+path('M-139-116 Q0-21 139-116 Q82-17 0-8 Q-82-17-139-116Z','legendaryScene__ring'),
    ultranecrozma:mirror(path('M0-175-22-86-123-141-79-42-172-23-61 24-108 120-22 77 0 175Z'))+group(diamond,'legendaryScene__detail','transform="scale(.48 .70)"'),
    zacian:mirror(path('M-17-63-71-129-63-58-106-18-60 15-81 82-28 61 0 112V-63Z'))+path('M-131 46 102-83 147-91 126-50-109 81Z','legendaryScene__blade')+eyes,
    zamazenta:mirror(path('M0-149-39-113-100-103-142-48-123 41-64 101 0 155Z'))+path('M0-112 91-52 73 32 0 112-73 32-91-52Z','legendaryScene__ring')+path('M-24-37 0-63 24-37 17 35 0 54-17 35Z','legendaryScene__detail'),
    eternatus:mirror(path('M0-145-20-52-102-113-56-31-169-32-72 9-126 101-37 52 0 160Z','legendaryScene__bone'))+path('M-34-39 0-76 34-39 12 17 0 45-12 17Z','legendaryScene__detail'),
    koraidon:mirror(feather)+path('M-20-47 0-88 24-47 44 38 0 117-44 38Z')+circle(0,43,46,'legendaryScene__ring')+path('M-10-50 0-39 10-50 M-28 42 0 68 28 42','legendaryScene__detail'),
    miraidon:tail+path('M-59-84-71-145-24-110 0-133 27-107 83-120 49-69 7-57Z')+circle(-2,68,48,'legendaryScene__ring')+path('M-48-95-21-89-9-73 M30-95 13-86','legendaryScene__detail'),
    terapagos:mirror(path('M0-138-70-102-126-30-101 57-42 93 0 155Z'))+path('M0-108 85-31 52 65-52 65-85-31Z','legendaryScene__ring')+path('M0-108V65 M-85-31 52 65 M85-31-52 65 M-85-31H85','legendaryScene__detail')
  };
  const definitions={
    hooh:['hooh','sunrise','feathers'],lugia:['lugia','sea','wind'],suicune:['suicune','aurora','water'],
    groudon:['groudon','volcano','embers'],kyogre:['kyogre','sea','rain'],rayquaza:['rayquaza','stratosphere','wind'],
    shinyprimalgroudon:['groudon','volcano','embers'],shinyprimalkyogre:['kyogre','sea','rain'],shinymegarayquaza:['rayquaza','stratosphere','wind'],
    dialga:['dialga','temple','time'],palkia:['palkia','rift','space'],giratina:['giratina','distortion','reverse'],arceus:['arceus','creation','stars'],
    reshiram:['reshiram','sunrise','embers'],zekrom:['zekrom','storm','electric'],blackkyurem:['blackkyurem','glacier','electric'],whitekyurem:['whitekyurem','glacier','embers'],
    xerneas:['xerneas','forest','life'],yveltal:['yveltal','eclipse','drain'],zygarde:['zygarde','cells','cells'],
    solgaleo:['solgaleo','sunrise','solar'],lunala:['lunala','eclipse','stars'],ultranecrozma:['ultranecrozma','prism','light'],
    zacian:['zacian','mist','blade'],zamazenta:['zamazenta','mist','shield'],eternatus:['eternatus','distortion','core'],
    koraidon:['koraidon','sunrise','dust'],miraidon:['miraidon','terrain','electric'],terapagos:['terapagos','prism','stars']
  };
  function environment(kind){
    switch(kind){
      case 'sea':return group(path('M-120 645 Q200 510 510 650T1120 640T1750 625V1100H-120Z')+path('M-120 750 Q190 608 560 760T1180 735T1750 740V1100H-120Z'),'legendaryScene__water')+group(path('M-100 636 Q200 515 510 650T1120 640T1750 625 M-100 750 Q190 608 560 760T1180 735T1750 740'),'legendaryScene__foam');
      case 'volcano':return path('M0 1000V765L110 701 201 750 340 631 503 760 640 680 769 780 980 650 1108 710 1270 609 1442 737 1600 648V1000Z','legendaryScene__land')+path('M0 891 215 837 287 881 441 766 533 818 608 801 690 912 814 894 919 773 1025 812 1100 751 1164 825 1302 789 1380 670 1490 760 1600 745 M444 767 428 666 352 610 M1100 751 1067 906 1130 1000','legendaryScene__fissure');
      case 'stratosphere':case 'mist':case 'storm':return group(path('M-200 430 Q270 208 650 290T1800 201 M-150 488 Q311 269 690 359T1780 270 M-120 932 Q390 711 830 786T1740 640'),'legendaryScene__cloud');
      case 'aurora':return group(path('M-100 81Q320 405 650 172T1720 160 M-70 200Q300 480 670 250T1680 250'),'legendaryScene__aurora')+environment('sea');
      case 'glacier':return path('M0 1000V749L96 520 190 752 335 489 440 788 659 634 860 804 1042 621 1220 808 1356 516 1489 721 1600 590V1000Z','legendaryScene__ice')+path('M96 520 126 787 335 489 362 914 M1042 621 1151 949 1356 516 1399 910','legendaryScene__facet');
      case 'forest':return mirror(group(path('M0 1000Q179 621 144 0 M80 620 0 387 M142 430 278 246 M132 220 60 95'),'legendaryScene__root'))+group(path('M1600 1000Q1430 581 1488 0 M1452 568 1570 347 M1472 311 1341 170'),'legendaryScene__root');
      case 'cells':return group(Array.from({length:26},(_,i)=>{const x=80+(i%7)*250,y=80+Math.floor(i/7)*280;return path(`M${x} ${y-38}l33 19v38l-33 19-33-19v-38Z`,'legendaryScene__cell',`style="--i:${i%7}"`);}).join(''));
      case 'temple':return group(path('M30 1000V300H130V1000 M1490 1000V190H1570V1000 M0 280H170 M1460 170H1600'),'legendaryScene__temple')+group(circle(1250,270,218)+circle(1250,270,247),'legendaryScene__clock');
      case 'rift':return path('M1122-90Q1370 190 1168 420T1380 1100','legendaryScene__rift')+path('M1093-90Q1341 190 1139 420T1351 1100','legendaryScene__riftEdge');
      case 'distortion':return group(path('M-30 74 370 159 285 289-52 209Z M1256 688 1620 605 1650 751 1331 829Z M20 850 356 732 289 914-14 1013Z'),'legendaryScene__broken');
      case 'terrain':return group(path('M0 930 600 710H1600 M500 1000 850 710 M1100 1000 1090 710 M1600 1000 1320 710 M0 817H1600 M0 885H1600'),'legendaryScene__terrain');
      case 'prism':return group(path('M0 1000 350 545 540 1000 M350 545 312 1000 M1160 1000 1390 480 1600 1000 M1390 480 1450 1000'),'legendaryScene__facet')+group(path('M1250 185 590 1000 730 1000Z M1250 185 20 710 30 805Z M1250 185 1520 1000 1600 1000Z'),'legendaryScene__ray');
      case 'creation':return group(circle(1250,270,223)+circle(1250,270,263)+path('M900 270H1600 M1250-70V610'),'legendaryScene__creation');
      case 'eclipse':return circle(1250,240,230,'legendaryScene__moon')+circle(1303,183,212,'legendaryScene__eclipse');
      default:return circle(1250,310,265,'legendaryScene__sun')+path('M0 820Q500 700 850 830T1600 800V1000H0Z','legendaryScene__land');
    }
  }
  function particles(motion){
    if(motion==='rain')return Array.from({length:26},(_,i)=>{const x=(i*173+57)%1800;return path(`M${x} 0l-12 37`,'legendaryScene__rain',`style="--i:${i%9}"`);}).join('');
    if(motion==='wind')return group(path('M-100 142Q400 49 760 164T1740 84 M-150 552Q400 360 820 499T1740 429'),'legendaryScene__wind');
    if(motion==='electric')return path('M1408 150 1370 220 1411 210 1352 305 M107 580 141 639 108 627 173 718','legendaryScene__electric');
    if(motion==='time')return group(path('M1250 23V47 M1497 270H1473 M1250 517V493 M1003 270H1027')+path('M1250 70V270L1381 350'),'legendaryScene__time');
    if(motion==='blade')return path('M950 465 1550 98 1300 295Z','legendaryScene__slash');
    if(motion==='shield')return group(circle(1250,270,200)+circle(1250,270,232),'legendaryScene__shield');
    return Array.from({length:18},(_,i)=>circle((i*269+89)%1600,(i*173+55)%1000,motion==='feathers'?4:1.5+(i%3),`legendaryScene__mote legendaryScene__mote--${motion}`).replace('/>',` style="--i:${i%7}"/>`)).join('');
  }
  function markup(key){
    const profile=definitions[key];
    if(!profile)return '';
    const [crest,habitat,motion]=profile;
    return `<svg class="legendaryScene legendaryScene--${motion}" data-legendary-scene="${key}" data-habitat="${habitat}" viewBox="0 0 1600 1000" preserveAspectRatio="xMaxYMin slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs><radialGradient id="legendaryGlow"><stop stop-color="var(--legendary-energy)" stop-opacity=".27"/><stop offset="1" stop-color="var(--legendary-energy)" stop-opacity="0"/></radialGradient><linearGradient id="legendarySpectrum"><stop stop-color="#f06384"/><stop offset=".25" stop-color="#f5c857"/><stop offset=".5" stop-color="#79dbb0"/><stop offset=".75" stop-color="#68b9ed"/><stop offset="1" stop-color="#b68af1"/></linearGradient></defs><ellipse cx="1250" cy="310" rx="570" ry="510" fill="url(#legendaryGlow)"/>${group(environment(habitat),'legendaryScene__environment')}${group(crests[crest],'legendaryScene__crest',`transform="translate(1250 280) scale(1.12)"`)}${group(particles(motion),'legendaryScene__particles')}</svg>`;
  }
  function sync(){
    const key=d.documentElement.getAttribute('data-theme-key');
    const field=d.querySelector('.siteThemeFx__field');
    const layer=d.getElementById('siteThemeFx');
    if(!field||!layer)return;
    if(!definitions[key]){
      if(layer.getAttribute('data-scene-key'))field.innerHTML='';
      layer.removeAttribute('data-scene-key');
      return;
    }
    if(layer.getAttribute('data-scene-key')===key)return;
    field.innerHTML=markup(key);
    const cfg=g.EvertaleTheme?.getActiveTheme?.();
    if(cfg){
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-195 -195 390 390"><style>g{fill:${cfg.legendaryBody};stroke:${cfg.legendaryEnergy};stroke-width:3;stroke-linejoin:round}.legendaryScene__mark,.legendaryScene__detail,.legendaryScene__antler,.legendaryScene__ribbon,.legendaryScene__bone{fill:none;stroke:${cfg.legendaryDetail};stroke-width:5}.legendaryScene__ring,.legendaryScene__pearl,.legendaryScene__orbit{fill:none;stroke:${cfg.legendaryEnergy};stroke-width:5}.legendaryScene__body{fill:none;stroke-width:27}.legendaryScene__cell{fill:${cfg.legendaryEnergy}}</style><g>${crests[definitions[key][0]]}</g></svg>`;
      d.documentElement.style.setProperty('--legendary-crest-image',`url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
      const watermark=svg.replace('<g>','<g opacity=".10">');
      d.documentElement.style.setProperty('--legendary-crest-watermark',`url("data:image/svg+xml,${encodeURIComponent(watermark)}")`);
    }
    layer.setAttribute('data-scene-key',key);
  }
  g.EvertaleLegendaryScenes={version:VERSION,keys:Object.freeze(Object.keys(definitions)),describe:key=>definitions[key]?.slice()||null,markup,sync};
  d.addEventListener('evertale:theme-applied',sync,true);
  d.readyState==='loading'?d.addEventListener('DOMContentLoaded',sync,{once:true}):sync();
})(window,document);
