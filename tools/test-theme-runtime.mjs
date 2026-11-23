import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'seasonal-theme.js'),'utf8');
const elementalSource=fs.readFileSync(path.join(root,'elemental-themes.js'),'utf8');
const elementalCss=fs.readFileSync(path.join(root,'elemental-themes.css'),'utf8');
const routeSource=fs.readFileSync(path.join(root,'theme-auto-route-authority.js'),'utf8');
const sceneSource=fs.readFileSync(path.join(root,'legendary-scenes.js'),'utf8');
const presenceSource=fs.readFileSync(path.join(root,'pokemon-theme-presence.js'),'utf8');
const effectCss=fs.readFileSync(path.join(root,'theme-effects.css'),'utf8');
const signatureCss=fs.readFileSync(path.join(root,'theme-motion.css'),'utf8');

function element(tagName='div'){
  const attributes=new Map();
  const children=[];
  return{
    tagName:tagName.toUpperCase(),id:'',className:'',children,firstChild:null,textContent:'',
    style:{values:new Map(),setProperty(name,value){this.values.set(name,String(value));}},
    setAttribute(name,value){attributes.set(name,String(value));},
    getAttribute(name){return attributes.get(name)??null;},
    removeAttribute(name){attributes.delete(name);},
    append(...nodes){for(const node of nodes)this.appendChild(node);},
    appendChild(node){node.remove?.();node.parentNode=this;children.push(node);this.firstChild=children[0]||null;return node;},
    insertBefore(node,before){node.remove?.();node.parentNode=this;const index=children.indexOf(before);if(index<0)children.unshift(node);else children.splice(index,0,node);this.firstChild=children[0]||null;return node;},
    remove(){if(this.parentNode){const siblings=this.parentNode.children,index=siblings.indexOf(this);if(index>=0)siblings.splice(index,1);this.parentNode=null;}},
    replaceChildren(...nodes){for(const child of [...children])child.remove?.();children.length=0;this.append(...nodes);},
    events:new Map(),
    addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,[]);this.events.get(type).push(fn);},
    dispatchEvent(event){for(const fn of this.events.get(event.type)||[])fn(event);},
    contains(node){return children.includes(node)||children.some(child=>child.contains?.(node));},
    querySelectorAll(selector){const found=[];const walk=node=>{for(const child of node.children||[]){if(child.matches?.(selector))found.push(child);walk(child);}};walk(this);return found;},
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
    matches(selector){return selector.split(',').some(part=>part.startsWith('.')&&String(this.className).split(' ').includes(part.slice(1)));}
  };
}

const listeners=new Map();
const storage=new Map();
const html=element('html');
const body=element('body');
const head=element('head');
const document={
  readyState:'complete',hidden:false,documentElement:html,body,head,
  createElement:tag=>element(tag),
  getElementById(id){
    const walk=node=>{
      if(node?.id===id)return node;
      for(const child of node?.children||[]){const found=walk(child);if(found)return found;}
      return null;
    };
    return walk(head)||walk(body);
  },
  querySelectorAll(selector){return body.querySelectorAll(selector);},
  querySelector(selector){
    const walk=node=>node?.className===selector.slice(1)?node:(node?.children||[]).map(walk).find(Boolean);
    return selector.startsWith('.')?walk(body):null;
  },
  addEventListener(type,handler){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(handler);},
  dispatchEvent(event){for(const handler of listeners.get(event.type)||[])handler(event);return true;}
};

let frameMutations,searchMutations;
const windowListeners=new Map(),pendingFrames=new Map();let nextFrame=0;
const context={
  window:null,document,location:{href:'https://example.test/optimizer.html',search:''},
  localStorage:{
    getItem:key=>storage.has(key)?storage.get(key):null,
    setItem:(key,value)=>storage.set(key,String(value))
  },
  URL,URLSearchParams,Intl,Date,Math,Number,String,Object,Array,Set,Map,RegExp,JSON,
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}},
  setInterval:()=>0,clearInterval:()=>{},console,
  addEventListener(type,handler){if(!windowListeners.has(type))windowListeners.set(type,[]);windowListeners.get(type).push(handler);},
  requestAnimationFrame(callback){const id=++nextFrame;pendingFrames.set(id,callback);return id;},
  cancelAnimationFrame:id=>pendingFrames.delete(id),
  setTimeout:()=>0,clearTimeout:()=>{},innerWidth:1280,innerHeight:900,
  MutationObserver:class{constructor(callback){this.callback=callback;}observe(target,options){if(options?.attributeFilter?.includes('data-optimizer-searching'))searchMutations=this.callback;else frameMutations=this.callback;}}
};
const reducedMotion={matches:false,addEventListener(type,handler){this.onchange=handler;}};
const mobileMotion={matches:false,addEventListener(type,handler){this.onchange=handler;}};
context.matchMedia=query=>query.includes('prefers-reduced-motion')?reducedMotion:query==='(max-width:480px)'?mobileMotion:{matches:false,addEventListener(){}};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'seasonal-theme.js'});
vm.runInContext(sceneSource,context,{filename:'legendary-scenes.js'});
const testCard=element('article');testCard.className='unitCard';body.appendChild(testCard);
vm.runInContext(presenceSource,context,{filename:'pokemon-theme-presence.js'});

const api=context.EvertaleTheme;
if(!api)throw new Error('Theme API was not created');
const themes=api.listThemes();
const legendary=themes.filter(theme=>theme.material==='legendary');
const handheld=themes.filter(theme=>theme.material==='handheld');
const elemental=themes.filter(theme=>theme.material==='elemental');
const expectedElemental=['cinderfall','undertow','frostbite','thunderwake','worldroot','dawnspire','voidcrown'];
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};

check(new Set(themes.map(theme=>theme.key)).size===themes.length,'Theme keys are not unique');
function contrast(a,b){
  const lum=hex=>hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
  const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
for(const theme of themes){
  check(contrast(theme.ink,theme.bg)>=4.5&&contrast(theme.ink,theme.surface)>=4.5,`Theme text contrast is below 4.5:1: ${theme.key}`);
  check(contrast(theme.onAccent,theme.accent)>=4.5,`Selected control contrast is below 4.5:1: ${theme.key}`);
}
check(legendary.length===29,`Expected 29 legendary profiles, found ${legendary.length}`);
check(handheld.length===7,`Expected 7 handheld profiles, found ${handheld.length}`);
check(elemental.length===7,`Expected 7 elemental profiles, found ${elemental.length}`);
check(JSON.stringify(elemental.map(theme=>theme.key))===JSON.stringify(expectedElemental),'Elemental profiles are missing or out of canonical display order');
check(JSON.stringify(api.elementalKeys)===JSON.stringify(expectedElemental),'Theme API elemental key registry is incomplete');
check(elemental.every(theme=>theme.group==='Evertale · Elements'),'An elemental profile is outside the Evertale element group');
check(elemental.every(theme=>theme.element&&theme.effect&&theme.aura),'An elemental profile is missing element/effect/aura metadata');
check(api.groupOrder[1]==='Evertale · Elements','Evertale element group is not prioritized after Calendar');
check(legendary.every(theme=>theme.effect&&theme.aura),'A legendary profile is missing effect/aura metadata');
const scenes=context.EvertaleLegendaryScenes;
const presence=context.EvertalePokemonPresence;
const artwork=JSON.parse(fs.readFileSync(path.join(root,'assets/themes/pokemon/artwork-sources.json'),'utf8'));
check(JSON.stringify([...presence.keys].sort())===JSON.stringify(legendary.map(theme=>theme.key).sort()),'Pokémon artwork/frame registry differs from themes');
check(presence.art('unknown')==='','Unknown Pokémon key invents an artwork path');
check(JSON.stringify([...scenes.keys].sort())===JSON.stringify(legendary.map(theme=>theme.key).sort()),'Legendary illustration registry differs from theme authority');
for(const theme of legendary){
  const svg=scenes.markup(theme.key);
  check(svg.includes(`data-legendary-scene="${theme.key}"`)&&svg.includes('legendaryScene__crest')&&svg.includes('legendaryScene__environment'),`Incomplete subject scene: ${theme.key}`);
  check(!/https?:\/\/(?!www\.w3\.org)|<script|<foreignObject|<image|Math\.random|requestAnimationFrame/.test(svg),`Scene contains a remote dependency or executable content: ${theme.key}`);
  check(svg.length<14000,`Scene exceeds geometry budget: ${theme.key}`);
  api.setPreference(theme.key);
  check(document.getElementById('siteThemeFx').getAttribute('data-scene-key')===theme.key,`Scene did not follow theme selection: ${theme.key}`);
  check(html.getAttribute('data-pokemon-presence')===theme.key,`Character identity did not follow theme selection: ${theme.key}`);
  check(document.getElementById('pokemonEncounter').getAttribute('data-pokemon')===theme.key,`Encounter banner retained the wrong character: ${theme.key}`);
  const receipt=artwork.profiles[theme.key];
  check(Boolean(receipt),`Missing artwork provenance: ${theme.key}`);
  if(receipt){
    const file=path.join(root,'assets/themes/pokemon',receipt.file);
    check(fs.existsSync(file),`Missing character artwork: ${theme.key}`);
    if(fs.existsSync(file)){const bytes=fs.readFileSync(file);check(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a',`Invalid character PNG: ${theme.key}`);check(crypto.createHash('sha256').update(bytes).digest('hex')===receipt.sha256,`Artwork checksum mismatch: ${theme.key}`);check(receipt.width>=400&&receipt.height>=400,`Artwork too small: ${theme.key}`);}
    check(receipt.shiny===theme.key.startsWith('shiny'),`Shiny character art does not match theme: ${theme.key}`);
  }
  check(presence.describe(theme.key).slice(0,3).every(c=>/^#[0-9a-f]{6}$/i.test(c)),`Invalid three-color frame palette: ${theme.key}`);
}
presence.scan();presence.scan();
check(testCard.children.filter(node=>node.className==='legendaryFrame').length===1,'Repeated scanning duplicated a card frame');
testCard.children.length=0;
frameMutations([{target:testCard,addedNodes:[]}]);
check(testCard.children.filter(node=>node.className==='legendaryFrame').length===1,'Re-rendering a card permanently removed its frame');
const storyCard=element('div');storyCard.className='slotCard storySlotCard';body.appendChild(storyCard);presence.scan();
check(storyCard.children.some(node=>node.className==='legendaryFrame'),'Story slots are not covered by Pokémon frames');
const scrollPane=element('section');scrollPane.className='v2-grid-panel';body.appendChild(scrollPane);presence.scan();
check(scrollPane.getAttribute('data-pokemon-outline')!==null&&scrollPane.children[0]?.hidden,'Scroll-pane frames would scroll across their content');
check(body.children.filter(node=>node.id==='pokemonEncounter').length===1,'Theme changes duplicated the character banner');
check(artwork.profiles.shinyprimalgroudon.form==='groudon-primal'&&artwork.profiles.shinyprimalkyogre.form==='kyogre-primal'&&artwork.profiles.shinymegarayquaza.form==='rayquaza-mega','Shiny themes use an incorrect base form');
check(artwork.profiles.zacian.form==='zacian-crowned'&&artwork.profiles.zamazenta.form==='zamazenta-crowned','Sword/shield themes lack their crowned forms');
check(presence.describe('groudon')[0]==='#ff5136'&&presence.describe('kyogre')[1]==='#ed415d','Groudon/Kyogre frame signatures were lost');
check(presence.describe('shinyprimalkyogre')[0]==='#ffdf63','Shiny Primal Kyogre lost its black/gold form identity');
check(/IntersectionObserver/.test(presenceSource)&&/data-frame-visible/.test(effectCss),'Frame motion lacks viewport gating');
check(!/fetch\(|requestAnimationFrame|setInterval/.test(presenceSource),'Character presentation introduces an unbounded render loop or network API dependency');
check(/pokemon-frame-breathe/.test(effectCss)&&/mask-composite:exclude/.test(effectCss),'Colored frame treatment is missing');
check(/pokemon-panel-outline/.test(effectCss)&&/\[data-pokemon-outline\]\{animation:none!important/.test(effectCss),'Scrollable panel outlines lack motion or reduced-motion support');
check(scenes.markup('unknown')==='','Unknown theme fabricated a scene');
check(scenes.describe('kyogre')[1]==='sea'&&scenes.describe('groudon')[1]==='volcano'&&scenes.describe('rayquaza')[1]==='stratosphere','Hoenn weather identities collapsed into generic motion');
check(scenes.describe('koraidon')[1]!==scenes.describe('miraidon')[1],'Ancient sunlight and Electric Terrain share an environment');
check(/legendaryScene \*\{animation-play-state:paused/.test(effectCss),'Hidden document does not pause SVG descendant animations');
check(!/repeating-(?:linear|radial|conic)-gradient/.test(effectCss.slice(effectCss.indexOf('/* Subject-authored'),effectCss.indexOf('/* Console material'))),'Legendary scenes still use tiled gradient stripes');
check(/legendary-scenes\.js\?v=1/.test(routeSource),'Scene loader is missing');
check(/pokemon-theme-presence\.js\?v=1/.test(routeSource),'Recognizable Pokémon art/frame loader is missing');
check(handheld.every(theme=>theme.effect&&theme.finish&&theme.hardware&&theme.aura),'A handheld profile is missing hardware metadata');
const expectedHardware={
  crimsonblack:'ds-lite',cobaltblack:'ds-lite',metallicrose:'dsi-xl',bronzexl:'dsi-xl',
  blackwhitedsi:'dsi',galaxystyle:'new-3ds-xl',superfamicom:'new-3ds-ll'
};
check(handheld.every(theme=>theme.hardware===expectedHardware[theme.key]),'A handheld profile exposes a treatment name instead of its hardware model');
check(themes.every(theme=>api.groupOrder.includes(theme.group)),'A theme group is missing from groupOrder');
check(body.children.filter(child=>child.id==='siteThemeFx').length===1,'Dedicated theme effect layer was not created exactly once');
check(body.children.find(child=>child.id==='siteThemeFx')?.children?.length===2,'Theme effect layer does not contain exactly two compositor layers');
check(!document.getElementById('evertale-material-theme-style'),'Theme runtime still injected a second material CSS authority');
check(!/\balternate\b/i.test(elementalCss),'Elemental CSS contains a rubberbanding alternate animation');
check(/elementalArtOrbit/.test(elementalCss)&&/elementalSpin/.test(elementalCss),'Elemental CSS is missing its closed-loop motion authorities');
check(/elementalRise/.test(elementalCss)&&/elementalRain/.test(elementalCss)&&/elementalSnow/.test(elementalCss),'Elemental CSS is missing an off-screen particle loop');
check(/requestAnimationFrame/.test(elementalSource),'Elemental depth response is not frame-scheduled');
check(/elemental-themes\.js\?v=3/.test(routeSource),'Theme route authority does not load the elemental compositor');
for(const key of expectedElemental){
  const asset=path.join(root,'assets','themes','elemental',`${key}.png`);
  check(fs.existsSync(asset),`Missing elemental background: ${key}.png`);
  if(fs.existsSync(asset))check(fs.statSync(asset).size>500000,`Elemental background is unexpectedly small: ${key}.png`);
}

api.applyTheme();
check(body.children.filter(child=>child.id==='siteThemeFx').length===1,'Repeated apply duplicated the effect layer');
api.setPreference('cinderfall');
check(html.getAttribute('data-theme-material')==='elemental','Elemental theme material did not apply');
check(html.getAttribute('data-theme-effect')==='element-fire','Elemental theme effect metadata did not apply');
api.setPreference('zygarde');
check(html.getAttribute('data-theme-key')==='zygarde','Manual theme preference did not apply');
check(html.getAttribute('data-theme-effect')==='cell-grid','Legendary effect attribute did not apply');
api.setPreference('galaxystyle');
check(!html.getAttribute('data-pokemon-presence')&&document.getElementById('pokemonEncounter').hidden,'Leaving Pokémon themes retained the encounter banner');
check(!document.getElementById('siteThemeFx').getAttribute('data-scene-key'),'Leaving a legendary theme retained stale scene metadata');
check(document.querySelector('.siteThemeFx__field').innerHTML==='','Leaving a legendary theme retained its illustration');
check(html.getAttribute('data-theme-material')==='handheld','Handheld material attribute did not apply');
check(html.getAttribute('data-theme-finish')==='galaxy','Handheld finish attribute did not apply');

document.hidden=true;
document.dispatchEvent(new context.CustomEvent('visibilitychange'));
check(html.getAttribute('data-theme-motion')==='paused','Hidden document did not pause theme motion');
document.hidden=false;
reducedMotion.matches=true;
reducedMotion.onchange();
check(html.getAttribute('data-theme-motion')==='paused','OS reduced-motion preference did not pause theme motion');
reducedMotion.matches=false;
reducedMotion.onchange();
check(html.getAttribute('data-theme-motion')==='running','Changing OS reduced-motion preference did not restore normal motion');

// The shared pause state must preserve theme selection and routing authority.
api.setPreference('auto');
const autoKey=api.getActiveTheme().key;
api.setMotionPreference('off');
check(api.getPreference()==='auto'&&api.getActiveTheme().key===autoKey,'Motion preference changed Auto theme resolution');
check(html.getAttribute('data-theme-still')==='true'&&html.getAttribute('data-theme-motion')==='paused','User pause did not select a composed still');
api.setPreference('kyogre');
check(html.getAttribute('data-theme-motion')==='paused','Theme switching discarded user pause');
api.setMotionPreference('on');reducedMotion.matches=true;reducedMotion.onchange();
check(html.getAttribute('data-theme-motion')==='paused','User enabled motion overrode the OS preference');
reducedMotion.matches=false;reducedMotion.onchange();
body.setAttribute('data-optimizer-searching','true');searchMutations();
check(html.getAttribute('data-theme-motion')==='paused'&&html.getAttribute('data-theme-still')==='false','Search did not freeze the current frame');
document.hidden=true;document.dispatchEvent(new context.CustomEvent('visibilitychange'));
body.removeAttribute('data-optimizer-searching');searchMutations();
check(html.getAttribute('data-theme-motion')==='paused','Ending a search resumed a hidden document');
document.hidden=false;document.dispatchEvent(new context.CustomEvent('visibilitychange'));
check(html.getAttribute('data-theme-motion')==='running','Visible, idle page did not resume');

vm.runInContext(fs.readFileSync(path.join(root,'theme-motion-profiles.js'),'utf8'),context);
document.baseURI='https://example.test/app/tools/theme-preview.html';
document.currentScript={src:'https://example.test/app/theme-motion.js?v=1'};
vm.runInContext(fs.readFileSync(path.join(root,'theme-motion.js'),'utf8'),context);
const motion=context.EvertaleThemeMotion;
check(JSON.stringify([...motion.keys].sort())===JSON.stringify(themes.filter(t=>t.material!=='elemental').map(t=>t.key).sort()),'Motion scenes do not cover the exact72 non-Elemental themes');
check(JSON.stringify(Object.keys(motion.signatures).sort())===JSON.stringify([...motion.keys,'thunderwake'].sort()),'Signature effects do not cover the exact72 scenes and one storm accent');
const primitiveNames=new Set(['fall','rise','gust','glint','swell','ripple','orbit','heat','arc','trace','hex','clock','rift','invert','prism','burst']);
for(const [key,parts] of Object.entries(motion.signatures)){
  let desktop=5,phone=4; // Existing three layers and two art surfaces; two layers on phones.
  for(const part of parts){
    check(primitiveNames.has(part.type),`Unknown signature primitive: ${key}`);
    check(Number.isInteger(part.count)&&Number.isInteger(part.phone)&&part.phone>0&&part.phone<=part.count,`Invalid signature density: ${key}`);
    check(part.duration>=6&&part.duration<=30,`Invalid standalone signature duration: ${key}`);
    const weight=part.type==='hex'?2:part.type==='arc'?3:1;
    desktop+=part.count*weight;phone+=part.phone*weight;
  }
  check(desktop<=40&&phone<=16,`Whole-scene signature budget exceeded: ${key} (${desktop}/${phone})`);
}
const signatureHost=document.getElementById('themeMotionParticles');
const signatureSnapshot=()=>signatureHost.children.map(x=>[x.getAttribute('data-primitive'),x.getAttribute('data-shape'),[...x.style.values]]);
api.setPreference('zygarde');const firstCells=JSON.stringify(signatureSnapshot());
check(signatureHost.children.filter(x=>x.getAttribute('data-primitive')==='hex').every(x=>x.innerHTML.includes('themeMotionCellA')&&x.innerHTML.includes('themeMotionCellB')),'Zygarde does not have separately opening cell edges');
api.setPreference('miraidon');
for(const item of signatureHost.children.filter(x=>x.getAttribute('data-primitive')==='trace')){
  check(item.innerHTML.includes('viewBox="0 0 160 90"'),'Circuit geometry does not share the packet coordinate space');
  check(item.children.some(x=>x.className==='themeMotionPacket'),'A circuit track has no travelling packet');
  for(let i=1;i<6;i++){
    const value=(axis,index)=>item.style.values.get(`--p${index}${axis}`);
    check(value('x',i)===value('x',i-1)||value('y',i)===value('y',i-1),'Miraidon packet cuts a diagonal across a corner');
  }
  const suffix=item.getAttribute('data-route')==='0'?'':item.getAttribute('data-route');
  const track=signatureCss.split('\n').find(line=>line.startsWith(`@keyframes theme-sig-packet${suffix}{`));
  const offsets=[...track.matchAll(/([\d.]+)%\{transform:translate\(var\(--p([1-5])x\)/g)].slice(0,5).map(match=>Number(match[1]));
  let prior=10,rate=null;
  for(let i=1;i<6;i++){
    const coordinate=(axis,index)=>parseFloat(item.style.values.get(`--p${index}${axis}`));
    const distance=Math.hypot(coordinate('x',i)-coordinate('x',i-1),coordinate('y',i)-coordinate('y',i-1));
    const segmentRate=(offsets[i-1]-prior)/distance;
    check(Number.isFinite(segmentRate)&&(rate===null||Math.abs(segmentRate-rate)<.0001),'Circuit timings do not follow segment lengths');
    rate=segmentRate;prior=offsets[i-1];
  }
}
api.setPreference('zygarde');check(JSON.stringify(signatureSnapshot())===firstCells,'Signature positions/phases are not deterministic after remount');
const sceneNode=document.getElementById('themeMotionScene');
api.setPreference('terapagos');
const firstArt=sceneNode.children.find(x=>x.className==='themeMotionArt');
check(firstArt?.getAttribute('src').startsWith('https://example.test/app/assets/'),'Illustration URL followed the preview directory instead of the shared script');
mobileMotion.matches=true;mobileMotion.onchange();
check(firstArt?.getAttribute('src').includes('-mobile.webp'),'Mobile viewport did not select the mobile illustration');
mobileMotion.matches=false;mobileMotion.onchange();
const pauseButton=document.querySelectorAll('.themeMotionToggle')[0];
reducedMotion.matches=true;reducedMotion.onchange();
check(pauseButton.getAttribute('aria-pressed')==='false'&&pauseButton.getAttribute('aria-disabled')==='true'&&pauseButton.textContent.includes('system setting'),'Motion control misrepresents the system-reduced state');
pauseButton.dispatchEvent({type:'click'});
check(api.getMotionPreference()==='on','System-disabled motion control changed the saved preference');
reducedMotion.matches=false;reducedMotion.onchange();
check(pauseButton.getAttribute('aria-pressed')==='true'&&pauseButton.getAttribute('aria-disabled')==='false','System preference restoration left the toggle disabled');
const oldArt=firstArt;
api.setPreference('groudon');api.setPreference('kyogre');
const currentArt=sceneNode.children.find(x=>x.className==='themeMotionArt');
oldArt.dispatchEvent({type:'load'});
check(!html.getAttribute('data-theme-illustrated'),'A stale image callback exposed a different image generation');
currentArt.dispatchEvent({type:'load'});oldArt.dispatchEvent({type:'error'});
check(html.getAttribute('data-theme-illustrated')==='kyogre','A stale error callback hid the current illustration');
for(let round=0;round<3;round++)for(const theme of themes){
  api.setPreference(theme.key);
  check(document.getElementById('themeMotionScene')===sceneNode,`Switching recreated the scene container: ${theme.key}`);
  if(theme.material==='elemental')check(sceneNode.hidden&&sceneNode.children.length===0,'Elemental switch retained stale procedural scene nodes');
  else check(!sceneNode.hidden&&sceneNode.children.length===context.EvertaleMotionProfiles[theme.key].layers.length+Number(!!context.EvertaleMotionProfiles[theme.key].art),`Stale or duplicate motion layers: ${theme.key}`);
  check(document.getElementById('themeMotionParticles')===signatureHost,`Signature switching recreated its host: ${theme.key}`);
  if(theme.material==='elemental'&&theme.key!=='thunderwake')check(signatureHost.hidden&&signatureHost.children.length===0,`An Elemental theme retained another theme's signature: ${theme.key}`);
  else check(signatureHost.children.length===motion.signatures[theme.key].reduce((sum,part)=>sum+part.count,0),`Signature objects leaked or disappeared: ${theme.key}`);
  for(const item of signatureHost.children.filter(x=>['fall','rise'].includes(x.getAttribute('data-primitive')))){
    const x=parseFloat(item.style.values.get('--x')),drift=parseFloat(item.style.values.get('--dx'));
    check((x<=.4&&drift<0)||(x>=98.8&&drift>0),`Foreground field can travel into central text: ${theme.key}`);
  }
}
check(body.children.filter(x=>x.id==='siteThemeFx').length===1,'Repeated79-theme cycles duplicated the background host');

// Pending pointer work is cancelled on pause and cannot restart while paused.
api.setPreference('cinderfall');
vm.runInContext(elementalSource,context,{filename:'elemental-themes.js'});
const pointer=event=>{for(const fn of windowListeners.get('pointermove')||[])fn(event);};
pointer({clientX:1000,clientY:700});
check(pendingFrames.size===1,'Elemental pointer response did not schedule one bounded frame');
api.setMotionPreference('off');
check(pendingFrames.size===0,'Pausing left an elemental pointer frame pending');
pointer({clientX:100,clientY:100});
check(pendingFrames.size===0,'Paused pointer movement scheduled work');
api.setMotionPreference('on');pointer({clientX:1000,clientY:700});api.setPreference('winter');
check(pendingFrames.size===0,'Leaving Elemental themes left pointer work pending');
const saveStorage=context.localStorage.setItem;
context.localStorage.setItem=()=>{throw new Error('Storage unavailable');};api.setMotionPreference('off');
check(api.getMotionPreference()==='off'&&html.getAttribute('data-theme-motion')==='paused','A storage failure broke the in-session pause control');
context.localStorage.setItem=saveStorage;api.setMotionPreference('on');

if(failures.length){
  console.error(`Theme runtime validation failed (${failures.length}):`);
  failures.forEach(failure=>console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Theme runtime validation passed: ${themes.length} profiles, ${legendary.length} legendary effects, ${handheld.length} console finishes.`);
