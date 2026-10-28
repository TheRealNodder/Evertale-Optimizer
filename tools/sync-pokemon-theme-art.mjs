/* Explicit, development-only asset import. Normal pages never contact PokéAPI.
   Keep exact forms/shiny choices and provenance; missing artwork is an error. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(root,'assets/themes/pokemon');
const cache=path.join(root,'node_modules/.cache/pokemon-theme-art');
const profiles={
  hooh:['ho-oh'],lugia:['lugia'],suicune:['suicune'],groudon:['groudon'],kyogre:['kyogre'],rayquaza:['rayquaza'],
  shinyprimalgroudon:['groudon-primal',true],shinyprimalkyogre:['kyogre-primal',true],shinymegarayquaza:['rayquaza-mega',true],
  dialga:['dialga'],palkia:['palkia'],giratina:['giratina-altered'],arceus:['arceus'],reshiram:['reshiram'],zekrom:['zekrom'],
  blackkyurem:['kyurem-black'],whitekyurem:['kyurem-white'],xerneas:['xerneas'],yveltal:['yveltal'],zygarde:['zygarde-50'],
  solgaleo:['solgaleo'],lunala:['lunala'],ultranecrozma:['necrozma-ultra'],zacian:['zacian-crowned'],zamazenta:['zamazenta-crowned'],
  eternatus:['eternatus'],koraidon:['koraidon'],miraidon:['miraidon'],terapagos:['terapagos-stellar']
};
await fs.mkdir(destination,{recursive:true});
await fs.mkdir(cache,{recursive:true});
const results={};
let previous={};
try{previous=JSON.parse(await fs.readFile(path.join(destination,'artwork-sources.json'),'utf8')).profiles||{};}
catch{/* Without a provenance receipt, fetch a verified source instead of trusting a loose local PNG. */}
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const queue=Object.entries(profiles);
async function get(url){
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`${response.status}: ${url}`);
  return response;
}
async function worker(){
  while(queue.length){
    const [key,[form,shiny=false]]=queue.shift();
    const apiUrl=`https://pokeapi.co/api/v2/pokemon/${form}`;
    const cached=path.join(cache,`${form}.json`);
    let pokemon;
    try{pokemon=JSON.parse(await fs.readFile(cached,'utf8'));}
    catch{pokemon=await(await get(apiUrl)).json();await fs.writeFile(cached,JSON.stringify(pokemon));}
    if(pokemon.name!==form)throw Error(`${key}: expected exact form ${form}, received ${pokemon.name}`);
    const field=shiny?'front_shiny':'front_default';
    const source=pokemon.sprites.other['official-artwork']?.[field];
    if(!source)throw Error(`${key}: no exact official-artwork ${field} for ${form}`);
    const url=new URL(source);
    if(url.protocol!=='https:'||url.hostname!=='raw.githubusercontent.com'||!url.pathname.startsWith('/PokeAPI/sprites/'))throw Error(`Unexpected artwork source: ${source}`);
    const target=path.join(destination,`${key}.png`);
    let bytes;
    try{
      const receipt=previous[key];
      const local=await fs.readFile(target);
      if(receipt?.form===form&&receipt.shiny===shiny&&receipt.source===source&&receipt.sha256===digest(local))bytes=local;
    }catch{/* A missing or modified asset must be restored from its source. */}
    if(!bytes){const response=await get(source);if(!response.headers.get('content-type')?.startsWith('image/'))throw Error('Unexpected asset content type');bytes=Buffer.from(await response.arrayBuffer());}
    if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error(`${key}: invalid PNG`);
    await fs.writeFile(target,bytes);
    results[key]={form,pokemonId:pokemon.id,shiny,source,apiUrl,file:`${key}.png`,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytes:bytes.length,sha256:digest(bytes)};
    console.log(`${key}: ${form}${shiny?' (shiny)':''} ${results[key].width}x${results[key].height}`);
  }
}
await Promise.all(Array.from({length:4},worker));
const manifest={schemaVersion:1,sourceRepository:'https://github.com/PokeAPI/sprites',rightsNotice:'Pokémon and character artwork belong to their respective rights holders. Source attribution is not a transfer of artwork rights. Unofficial fan theme; no affiliation or endorsement.',profiles:Object.fromEntries(Object.keys(profiles).map(key=>[key,results[key]]))};
await fs.writeFile(path.join(destination,'artwork-sources.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Saved ${Object.keys(results).length} exact-form assets; ${Object.values(results).reduce((n,r)=>n+r.bytes,0)} total bytes.`);
