import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'seasonal-theme.js'),'utf8');
const elementalSource=fs.readFileSync(path.join(root,'elemental-themes.js'),'utf8');
const elementalCss=fs.readFileSync(path.join(root,'elemental-themes.css'),'utf8');
const routeSource=fs.readFileSync(path.join(root,'theme-auto-route-authority.js'),'utf8');
const sceneSource=fs.readFileSync(path.join(root,'legendary-scenes.js'),'utf8');
const effectCss=fs.readFileSync(path.join(root,'theme-effects.css'),'utf8');

function element(tagName='div'){
  const attributes=new Map();
  const children=[];
  return{
    tagName:tagName.toUpperCase(),id:'',className:'',children,firstChild:null,textContent:'',
    style:{values:new Map(),setProperty(name,value){this.values.set(name,String(value));}},
    setAttribute(name,value){attributes.set(name,String(value));},
    getAttribute(name){return attributes.get(name)??null;},
    removeAttribute(name){attributes.delete(name);},
    append(...nodes){children.push(...nodes);this.firstChild=children[0]||null;},
    appendChild(node){children.push(node);this.firstChild=children[0]||null;return node;},
    insertBefore(node,before){const index=children.indexOf(before);if(index<0)children.unshift(node);else children.splice(index,0,node);this.firstChild=children[0]||null;return node;},
    querySelectorAll(){return[];},
    matches(){return false;}
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
  querySelectorAll(){return[];},
  querySelector(selector){
    const walk=node=>node?.className===selector.slice(1)?node:(node?.children||[]).map(walk).find(Boolean);
    return selector.startsWith('.')?walk(body):null;
  },
  addEventListener(type,handler){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(handler);},
  dispatchEvent(event){for(const handler of listeners.get(event.type)||[])handler(event);return true;}
};

const context={
  window:null,document,location:{href:'https://example.test/optimizer.html',search:''},
  localStorage:{
    getItem:key=>storage.has(key)?storage.get(key):null,
    setItem:(key,value)=>storage.set(key,String(value))
  },
  URL,URLSearchParams,Intl,Date,Math,Number,String,Object,Array,Set,Map,RegExp,JSON,
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}},
  setInterval:()=>0,clearInterval:()=>{},console
};
const reducedMotion={matches:false,addEventListener(type,handler){this.onchange=handler;}};
context.matchMedia=()=>reducedMotion;
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'seasonal-theme.js'});
vm.runInContext(sceneSource,context,{filename:'legendary-scenes.js'});

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
check(JSON.stringify([...scenes.keys].sort())===JSON.stringify(legendary.map(theme=>theme.key).sort()),'Legendary illustration registry differs from theme authority');
for(const theme of legendary){
  const svg=scenes.markup(theme.key);
  check(svg.includes(`data-legendary-scene="${theme.key}"`)&&svg.includes('legendaryScene__crest')&&svg.includes('legendaryScene__environment'),`Incomplete subject scene: ${theme.key}`);
  check(!/https?:\/\/(?!www\.w3\.org)|<script|<foreignObject|<image|Math\.random|requestAnimationFrame/.test(svg),`Scene contains a remote dependency or executable content: ${theme.key}`);
  check(svg.length<14000,`Scene exceeds geometry budget: ${theme.key}`);
  api.setPreference(theme.key);
  check(document.getElementById('siteThemeFx').getAttribute('data-scene-key')===theme.key,`Scene did not follow theme selection: ${theme.key}`);
}
check(scenes.markup('unknown')==='','Unknown theme fabricated a scene');
check(scenes.describe('kyogre')[1]==='sea'&&scenes.describe('groudon')[1]==='volcano'&&scenes.describe('rayquaza')[1]==='stratosphere','Hoenn weather identities collapsed into generic motion');
check(scenes.describe('koraidon')[1]!==scenes.describe('miraidon')[1],'Ancient sunlight and Electric Terrain share an environment');
check(/legendaryScene \*\{animation-play-state:paused/.test(effectCss),'Hidden document does not pause SVG descendant animations');
check(!/repeating-(?:linear|radial|conic)-gradient/.test(effectCss.slice(effectCss.indexOf('/* Subject-authored'),effectCss.indexOf('/* Console material'))),'Legendary scenes still use tiled gradient stripes');
check(/legendary-scenes\.js\?v=1/.test(routeSource),'Scene loader is missing');
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
check(/elemental-themes\.js\?v=1/.test(routeSource),'Theme route authority does not load the elemental compositor');
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

if(failures.length){
  console.error(`Theme runtime validation failed (${failures.length}):`);
  failures.forEach(failure=>console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Theme runtime validation passed: ${themes.length} profiles, ${legendary.length} legendary effects, ${handheld.length} console finishes.`);
