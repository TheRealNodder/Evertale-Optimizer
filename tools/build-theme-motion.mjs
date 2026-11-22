import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const elements=new Set(['cinderfall','undertow','frostbite','thunderwake','worldroot','dawnspire','voidcrown']);
const tags=new Set(['g','path','circle','ellipse','rect','line','polygon']);
const attributes=new Set(['d','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','width','height','points','fill','stroke','fill-opacity','stroke-opacity','opacity','stroke-width','stroke-linecap','stroke-linejoin','fill-rule','transform']);
const fail=(key,message)=>{throw new Error(`${key}: ${message}`);};
function transform(value,key){
  if(value==='none')return;
  if(typeof value!=='string'||!value||value.length>200)fail(key,'invalid transform');
  const rest=value.replace(/([a-zA-Z0-9]+)\(([^()]*)\)/g,(_,name,args)=>{
    const values=args.trim().split(/\s*,\s*|\s+/);
    const type=name.startsWith('translate')?'length':name.startsWith('scale')?'scale':'angle';
    const allowed=type==='length'?/^(?:0|[-+]?(?:\d*\.)?\d+(?:px|%))$/:type==='scale'?/^[-+]?(?:\d*\.)?\d+$/:/^(?:0|[-+]?(?:\d*\.)?\d+(?:deg|turn))$/;
    const limits={translate:[1,2],translate3d:[3,3],translateX:[1,1],translateY:[1,1],scale:[1,2],scale3d:[3,3],scaleX:[1,1],scaleY:[1,1],rotate:[1,1],skew:[1,2],skewX:[1,1],skewY:[1,1]}[name];
    if(!limits||values.length<limits[0]||values.length>limits[1]||values.some(x=>!allowed.test(x))||(name==='translate3d'&&values[2].endsWith('%')))fail(key,'unsupported transform arguments');
    return'';
  }).trim();
  if(rest)fail(key,'unsafe transform');
}
function svgMarkup(markup,key){
  if(typeof markup!=='string'||markup.length>16000||/[&!?]|<!--/.test(markup))fail(key,'invalid SVG markup');
  let count=0;const stack=[];
  const remaining=markup.replace(/<\/?([a-z]+)\b([^<>]*)>/g,(whole,tag,attrs)=>{
    if(!tags.has(tag))fail(key,`unsupported SVG tag ${tag}`);
    if(whole.startsWith('</')){if(attrs.trim()||stack.pop()!==tag)fail(key,'unbalanced SVG');return'';}
    count++;
    const rest=attrs.replace(/\s+([a-z][a-z0-9-]*)="([^"]*)"/g,(_,name,value)=>{
      if(!attributes.has(name))fail(key,`unsupported SVG attribute ${name}`);
      if(['fill','stroke'].includes(name)){
        if(!/^(?:none|currentColor|#[0-9a-fA-F]{3,8}|var\(--site-theme-(?:accent|secondary|ink|surface)\))$/.test(value))fail(key,'unsafe SVG color');
      }else if(name==='d'){
        if(!/^[mMlLhHvVcCsSqQtTaAzZ0-9+.,eE\s-]+$/.test(value))fail(key,'invalid path');
      }else if(name==='transform'){
        if(!/^(?:(?:translate|rotate|scale|skewX|skewY|matrix)\([-+\d.,\s]+\)\s*)+$/.test(value))fail(key,'invalid SVG transform');
      }else if(['stroke-linecap','stroke-linejoin','fill-rule'].includes(name)){
        if(!/^(?:round|square|butt|bevel|miter|nonzero|evenodd)$/.test(value))fail(key,'invalid SVG enum');
      }else if(!/^[-+\d.eE,\s]+$/.test(value))fail(key,'invalid SVG number');
      return'';
    }).replace(/\/$/,'').trim();
    if(rest)fail(key,'unparsed SVG attribute');
    if(!/\/\s*>$/.test(whole))stack.push(tag);
    return'';
  });
  if(remaining.trim()||stack.length||!count)fail(key,'incomplete SVG geometry');
  return count;
}
export function compileProfiles(input){
  if(!Array.isArray(input))fail('profiles','expected array');
  const keys=new Set(),geometry=new Set(),signatures=new Set();
  const runtime={},css=['/* Built by tools/build-theme-motion.mjs. Edit the source profiles. */'];
  const docs=['# Theme visual references and motion','',
    'The references establish identity and physical or cultural visual anchors. Geometry, timing and motion are original artistic interpretations, not canonical game animations or scientific simulations. Existing artwork credits remain in place. No reference images are imported.','',
    'Motion uses CSS transforms and opacity. System reduced motion and the Animations control show composed stills; hidden tabs and optimizer searches freeze movement. The seven Elemental backgrounds retain their artwork, palette and composition.',''];
  const budget=[];
  for(const profile of input){
    const {key,layers,sources,anchors,signature}=profile;
    if(!/^[a-z][a-z0-9]+$/.test(key)||keys.has(key))fail(key,'invalid or duplicate key');keys.add(key);
    if(!Array.isArray(anchors)||anchors.length<2||anchors.some(x=>typeof x!=='string'||!x))fail(key,'missing identity anchors');
    if(typeof signature!=='string'||!signature)fail(key,'missing signature');
    if(!Array.isArray(sources)||!sources.length||sources.length>3)fail(key,'missing primary references');
    for(const source of sources){const u=new URL(source.url);if(u.protocol!=='https:'||u.username||u.password||!source.title)fail(key,'invalid source URL');}
    if(!Array.isArray(layers)||(!elements.has(key)&&(layers.length<3||layers.length>5))||(elements.has(key)&&layers.length))fail(key,'invalid layer budget');
    let shapes=0,mobile=0,moving=0;const ids=new Set();
    for(const layer of layers){
      const label=`${key}/${layer.id}`;
      if(!/^[a-z][a-z0-9-]*$/.test(layer.id)||ids.has(layer.id))fail(label,'invalid layer ID');ids.add(layer.id);
      shapes+=svgMarkup(layer.svg,label);
      if(typeof layer.mobile!=='boolean')fail(label,'missing mobile flag');mobile+=Number(layer.mobile);
      if(!Number.isFinite(layer.duration)||layer.duration<6||layer.duration>24)fail(label,'duration must be 6–24 seconds');
      if(!/^(?:linear|ease|ease-in|ease-out|ease-in-out|steps\([1-9]\d?,\s*(?:start|end)\)|cubic-bezier\([-+.\d,\s]+\))$/.test(layer.ease))fail(label,'invalid easing');
      if(!Array.isArray(layer.frames)||layer.frames.length<3||layer.frames.length>8||layer.frames[0].at!==0||layer.frames.at(-1).at!==100)fail(label,'incomplete keyframes');
      let last=-1;
      for(const frame of [...layer.frames,layer.still]){
        if(!frame||!Number.isFinite(frame.opacity)||frame.opacity<0||frame.opacity>1)fail(label,'invalid opacity');transform(frame.transform,label);
      }
      for(const frame of layer.frames){if(!Number.isFinite(frame.at)||frame.at<=last||frame.at>100)fail(label,'invalid frame ordering');last=frame.at;}
      const first=layer.frames[0],end=layer.frames.at(-1);
      if((first.transform!==end.transform||first.opacity!==end.opacity)&&!(first.opacity===0&&end.opacity===0))fail(label,'visible reset discontinuity');
      if(layer.still.opacity===0)fail(label,'invisible still');
      const animated=layer.frames.some(frame=>frame.transform!==first.transform||frame.opacity!==first.opacity);
      moving+=Number(animated);
      const name=`scene-${key}-${layer.id}`;
      css.push(`.themeMotionScene[data-scene-key="${key}"] [data-layer="${layer.id}"]{--motion-still-transform:${layer.still.transform};--motion-still-opacity:${layer.still.opacity};${animated?`animation:${name} ${layer.duration}s ${layer.ease} ${-(layer.duration*.17).toFixed(2)}s infinite;`:`transform:${layer.still.transform};opacity:${layer.still.opacity};`}}`);
      if(animated)css.push(`@keyframes ${name}{${layer.frames.map(frame=>`${frame.at}%{transform:${frame.transform};opacity:${frame.opacity}}`).join('')}}`);
    }
    if(shapes>40||mobile>3||(!elements.has(key)&&(!mobile||!moving)))fail(key,'scene exceeds geometry/mobile budget or lacks motion');
    if(layers.length){
      const shapePrint=JSON.stringify(layers.map(x=>x.svg)).replace(/var\(--site-theme-[a-z-]+\)|#[0-9a-fA-F]+/g,'color');
      const motionPrint=JSON.stringify(layers.map(x=>x.frames));
      if(geometry.has(shapePrint)||signatures.has(motionPrint))fail(key,'duplicate geometry or motion sequence');
      geometry.add(shapePrint);signatures.add(motionPrint);
      runtime[key]={layers:layers.map(({id,svg,mobile})=>({id,svg,mobile}))};
      if(profile.art){
        if(profile.art!==`assets/themes/scenes/${key}.webp`||profile.artMobile!==`assets/themes/scenes/${key}-mobile.webp`||!/^\w{12}$/.test(profile.artVersion)||!/^\w{12}$/.test(profile.artMobileVersion))fail(key,'invalid local illustration path or revision');
        runtime[key].art=`${profile.art}?v=${profile.artVersion}`;
        runtime[key].artMobile=`${profile.artMobile}?v=${profile.artMobileVersion}`;
        css.push(`html[data-theme-key="${key}"]{--theme-scene-image:url("./${runtime[key].art}")}`);
        css.push(`@media(max-width:480px){html[data-theme-key="${key}"]{--theme-scene-image:url("./${runtime[key].artMobile}")}}`);
      }
    }
    budget.push({key,shapes,layers:layers.length,moving,mobile});
    docs.push(`## ${key}`,'',...anchors.map(anchor=>`- ${anchor}`),'',`**Motion:** ${signature}`,'',`**Still:** ${profile.stillDescription||'A composed, visible arrangement of the identity geometry.'}`,'',...sources.map(source=>`- [${source.title}](${source.url})`),'');
    if(profile.art)docs.push(`**Original environment illustration:** [${key}](../${profile.art})`,'');
    if(profile.qualification)docs.push(`**Reference qualification:** ${profile.qualification}`,'');
    if(elements.has(key))docs.push(`**Motion-only refinement:** ${profile.motionTweaks||signature}`,'');
  }
  return {runtime,css:css.join('\n')+'\n',docs:docs.join('\n')+'\n',budget};
}
export function artifacts(input){
  const built=compileProfiles(input);
  return new Map([
    ['theme-motion-profiles.js',`/* Built from assets/themes/motion-profiles.json. */\nwindow.EvertaleMotionProfiles=${JSON.stringify(built.runtime)};\n`],
    ['theme-motion-frames.css',built.css],
    ['docs/THEME_MOTION.md',built.docs],
    ['assets/themes/motion-budget.json',JSON.stringify(built.budget,null,2)+'\n']
  ]);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const input=JSON.parse(fs.readFileSync(path.join(root,'assets/themes/motion-profiles.json'),'utf8'));
  if(input.length!==79)fail('profiles','expected all 79 themes');
  for(const [file,text] of artifacts(input)){
    const target=path.join(root,file);
    if(process.argv.includes('--check')){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==text)fail(file,'generated output is stale');}
    else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);}
  }
  console.log('Theme motion build verified: 79 profiles, 72 scenes, 7 preserved Elemental backgrounds.');
}
