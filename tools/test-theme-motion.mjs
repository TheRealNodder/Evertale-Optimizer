import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {compileProfiles,artifacts} from './build-theme-motion.mjs';
import {inspectSceneArtwork} from './scene-artwork.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=JSON.parse(fs.readFileSync(path.join(root,'assets/themes/motion-profiles.json'),'utf8'));
const seed=input.find(x=>x.layers.length);
const copy=()=>structuredClone(seed);
test('all79 identities have primary references and bounded, distinct composed scenes',()=>{
  const built=compileProfiles(input);
  assert.equal(input.length,79);assert.equal(Object.keys(built.runtime).length,72);
  assert.equal(built.budget.filter(x=>x.layers===0).length,7);
  assert.ok(built.budget.every(x=>x.shapes<=40&&x.moving<=8&&x.mobile<=3));
});
test('scene compiler rejects executable markup, references and unsafe attributes',()=>{
  for(const svg of ['<script>bad()</script>','<image href="https://example.test/a.png"/>','<path d="M0 0" onload="bad()"/>','<path d="M0 0" fill="url(https://example.test/)"/>','<g><circle r="2"/>','<path d="M0 0"/><foreignObject/>']){
    const row=copy();row.layers[0].svg=svg;assert.throws(()=>compileProfiles([row]));
  }
});
test('scene compiler rejects broken CSS and visible loop resets',()=>{
  for(const bad of ['translate(2banana)','rotate(2px)','translate3d(0,0,4%)','scale(2);color:red','url(remote)','translateX(4px) junk']){
    const row=copy();row.layers[0].frames[1].transform=bad;assert.throws(()=>compileProfiles([row]));
  }
  const reset=copy();reset.layers[0].frames.at(-1).transform='translateX(500px)';reset.layers[0].frames.at(-1).opacity=1;
  assert.throws(()=>compileProfiles([reset]),/discontinuity/);
  const invisible=copy();invisible.layers[0].still.opacity=0;assert.throws(()=>compileProfiles([invisible]),/invisible still/);
});
test('scene compiler enforces the geometry and mobile limits',()=>{
  const many=copy();many.layers[0].svg='<circle r="2"/>'.repeat(41);assert.throws(()=>compileProfiles([many]),/budget/);
  const mobile=copy();mobile.layers.push({...structuredClone(mobile.layers[0]),id:'extra'});mobile.layers.forEach(x=>x.mobile=true);
  assert.throws(()=>compileProfiles([mobile]),/budget/);
});
test('checked-in motion artifacts are exactly reproducible',()=>{
  for(const [file,text] of artifacts(input))assert.equal(fs.readFileSync(path.join(root,file),'utf8'),text,file);
});
test('new motion never adds a render loop or changes layout flow',()=>{
  const source=fs.readFileSync(path.join(root,'theme-motion.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'theme-motion.css'),'utf8');
  assert.doesNotMatch(source,/requestAnimationFrame|setInterval|setTimeout|fetch\(/);
  assert.match(css,/\.themeMotionScene\{position:absolute;inset:0/);
  assert.match(css,/background-color:var\(--site-theme-bg\)!important/);
  assert.match(css,/data-theme-still="true"/);
});

test('all72 illustrated environments have bounded, metadata-free desktop and mobile files',()=>{
  const receipts=JSON.parse(fs.readFileSync(path.join(root,'assets/themes/scene-artwork.json'),'utf8'));
  assert.equal(receipts.length,72);
  assert.equal(new Set(receipts.map(x=>x.key)).size,72);
  let total=0;
  for(const receipt of receipts){
    const profile=input.find(x=>x.key===receipt.key);assert.ok(profile);
    for(const [record,mobile] of [[receipt,false],[receipt.mobile,true]]){
      const bytes=fs.readFileSync(path.join(root,record.file));
      assert.equal(bytes.length,record.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256);
      const info=inspectSceneArtwork(bytes);assert.deepEqual(info.metadata,[],record.file);
      assert.equal(info.width,record.width);assert.equal(info.height,record.height);
      assert.ok(bytes.length<=(mobile?60:150)*1024,record.file);
      assert.equal(profile[mobile?'artMobileVersion':'artVersion'],record.sha256.slice(0,12));
      total+=bytes.length;
    }
  }
  assert.ok(total<=15*1024*1024,'Illustration download set exceeds 15 MiB');
});

test('malformed image chunks cannot bypass metadata inspection',()=>{
  const webp=fs.readFileSync(path.join(root,JSON.parse(fs.readFileSync(path.join(root,'assets/themes/scene-artwork.json'),'utf8'))[0].file));
  const chunk=Buffer.alloc(12);chunk.write('XMP ');chunk.writeUInt32LE(4,4);chunk.write('test',8);
  const altered=Buffer.concat([webp,chunk]);altered.writeUInt32LE(altered.length-8,4);
  assert.deepEqual(inspectSceneArtwork(altered).metadata,['XMP']);
  assert.throws(()=>inspectSceneArtwork(webp.subarray(0,webp.length-2)));
});
