import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SELF='tools/test-public-artifacts.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const USER_PROFILE=/[A-Za-z]:[\\/]+Users[\\/]+/i;
const TOOL_WORDS=/(?<![A-Za-z0-9])(?:anthropic|chatgpt|codegpt|copilot|openai|claude|aelita|gemini|codex|gpt)(?![A-Za-z0-9])/i;
const ownSource=readFileSync(new URL(import.meta.url),'utf8');
const patternLine=ownSource.split(/\r?\n/).find(line=>line.startsWith('const TOOL_WORDS='));

function decodeText(bytes){
  if(bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder('utf-16le',{fatal:true}).decode(bytes.subarray(2));
  if(bytes[0]===0xfe&&bytes[1]===0xff)return new TextDecoder('utf-16be',{fatal:true}).decode(bytes.subarray(2));
  if(bytes.includes(0))return null;
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return null;}
}
function findLeaks(text,source='fixture.txt'){
  const leaks=[];
  text.split(/\r?\n/).forEach((line,index)=>{
    if(USER_PROFILE.test(line))leaks.push({source,line:index+1,kind:'machine path'});
    if(!(source===SELF&&line===patternLine)&&TOOL_WORDS.test(line))leaks.push({source,line:index+1,kind:'tool reference'});
  });
  if(source.endsWith('.json')){
    let parsed;try{parsed=JSON.parse(text);}catch{return leaks;}
    const visit=value=>{
      if(typeof value==='string'){
        if(USER_PROFILE.test(value))leaks.push({source,kind:'decoded machine path'});
        if(TOOL_WORDS.test(value))leaks.push({source,kind:'decoded tool reference'});
      }else if(Array.isArray(value))value.forEach(visit);
      else if(value&&typeof value==='object')Object.entries(value).forEach(([key,child])=>{visit(key);visit(child);});
    };visit(parsed);
  }
  return leaks;
}

test('profile paths are detected in slash, escaped and single-line data forms',()=>{
  const prefix='Q'+':/'+'Users/'+'example/';
  for(const value of [prefix+'file.json',(prefix+'file.json').replaceAll('/','\\'),(prefix+'file.json').replaceAll('/','\\\\')])assert.ok(findLeaks(value).length);
  const encoded=JSON.stringify({[prefix+'key']:0,path:prefix+'file.json'}).replaceAll('Users','\\u0055sers');
  assert.ok(findLeaks(encoded,'fixture.json').some(row=>row.kind==='decoded machine path'));
});
test('tool references are word-bounded and game text remains intact',()=>{
  const banned=String.fromCharCode(67,111,100,101,120);
  assert.ok(findLeaks('Generated with '+banned).length);
  assert.ok(findLeaks(banned.toLowerCase()+'/example').length);
  assert.ok(findLeaks(banned.toLowerCase()+'_rules.md').length);
  assert.ok(findLeaks('Co-Authored-By: '+banned+' <example@example.invalid>').length);
  assert.equal(findLeaks('Game AI targeting; SmallMiss; AllMordred; '+banned+'suffix').length,0);
});
test('only the exact guard pattern declaration is exempt',()=>{
  assert.equal(ownSource.split(/\r?\n/).filter(line=>line===patternLine).length,1);
  assert.equal(findLeaks(patternLine,SELF).length,0);
  assert.ok(findLeaks(patternLine,'other.js').length);
  const banned=String.fromCharCode(67,108,97,117,100,101);
  assert.equal(findLeaks(patternLine+'\n'+banned,SELF).length,1);
});
test('UTF8 and UTF16 text are scanned while binary data is recognized',()=>{
  const text='Q'+':/'+'Users/'+'example/file.json';
  assert.ok(findLeaks(decodeText(Buffer.from(text))).length);
  assert.ok(findLeaks(decodeText(Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(text,'utf16le')]))).length);
  assert.equal(decodeText(Buffer.from([0,255,137,80,78,71])),null);
});
test('all tracked text files, including staged additions, satisfy publication hygiene',()=>{
  const names=execFileSync('git',['ls-files','--cached','-z'],{cwd:ROOT,encoding:'utf8'}).split('\0').filter(Boolean);
  assert.ok(names.includes(SELF));
  const leaks=[];
  for(const name of names){const text=decodeText(readFileSync(path.join(ROOT,name)));if(text!==null)leaks.push(...findLeaks(text,name));}
  assert.deepEqual(leaks,[],JSON.stringify(leaks.slice(0,25)));
});
