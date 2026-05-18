/* leader-skill-resolver.js — populate displayable leader skill names/descriptions.
   Runs after data-loader.js and before catalog/roster/optimizer page renderers.
*/
(function(){
  function norm(v){return String(v||'').trim();}
  function wordsFromCamel(v){return norm(v).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2').replace(/[_-]+/g,' ').trim();}
  function elementFromText(v){
    const s=norm(v).toLowerCase();
    if(/fire|flame/.test(s))return'Fire';
    if(/water|ice/.test(s))return'Water';
    if(/storm|air|wind|thunder|lightning|electric/.test(s))return'Storm';
    if(/earth|terra|ground/.test(s))return'Earth';
    if(/light|life|holy/.test(s))return'Light';
    if(/dark|death|shadow/.test(s))return'Dark';
    return'';
  }
  function statFromBuff(id){
    const s=norm(id);
    if(/^hpup/i.test(s)||/hp.*up/i.test(s))return'HP';
    if(/^(atk|attack)up/i.test(s)||/(atk|attack).*up/i.test(s))return'Attack';
    if(/^(spd|speed)up/i.test(s)||/(spd|speed).*up/i.test(s))return'Speed';
    if(/^costdown/i.test(s)||/cost.*down/i.test(s))return'Cost';
    if(/^spirit/i.test(s))return'Spirit';
    return wordsFromCamel(s.replace(/[A-Z]$/,''))||'Stats';
  }
  function scopeFromCondition(condition,id){
    const cond=norm(condition);
    const elem=elementFromText(cond)||elementFromText(id);
    if(elem)return`${elem} allies`;
    if(/all|ally|allies/i.test(cond))return'all allies';
    return'allies';
  }
  function tierFromBuff(id){
    const m=norm(id).match(/([A-Z])$/);
    return m?m[1]:'';
  }
  function buildDescription(id,condition){
    const stat=statFromBuff(id);
    const scope=scopeFromCondition(condition,id);
    const tier=tierFromBuff(id);
    const tierText=tier?` Tier ${tier}.`:'';
    if(/^costdown/i.test(id))return`Decreases Cost for ${scope}.${tierText}`;
    if(/^spirit/i.test(id))return`Improves Spirit support for ${scope}.${tierText}`;
    return`Increases ${stat} for ${scope}.${tierText}`;
  }
  function buildName(id,condition){
    const stat=statFromBuff(id);
    const elem=elementFromText(condition)||elementFromText(id);
    const scope=elem?`${elem} `:'';
    if(/^costdown/i.test(id))return`${scope}Cost Down`;
    if(/^spirit/i.test(id))return`${scope}Spirit Support`;
    return`${scope}${stat} Up`;
  }
  function resolveUnit(u){
    if(!u||typeof u!=='object')return u;
    const existing=u.leaderSkill&&typeof u.leaderSkill==='object'?u.leaderSkill:{};
    const raw=u.raw&&typeof u.raw==='object'?u.raw:{};
    const refs=u.refs&&typeof u.refs==='object'?u.refs:{};
    const internalId=norm(existing.internalId||existing.id||refs.leaderBuff||raw.leaderBuff||'');
    const condition=norm(existing.condition||refs.leaderBuffCondition||raw.leaderBuffCondition||'');
    if(!internalId){
      u.leaderSkill={name:'No Leader Skill',description:'This unit does not provide a leader skill.',internalId:'',condition:''};
      return u;
    }
    const name=norm(existing.name)&&existing.name!=='None'?existing.name:buildName(internalId,condition);
    const description=norm(existing.description)&&existing.description!=='None'?existing.description:buildDescription(internalId,condition);
    u.leaderSkill={...existing,name,description,internalId,condition};
    return u;
  }
  function resolveRows(rows){
    if(Array.isArray(rows))rows.forEach(resolveUnit);
    return rows;
  }
  function patch(){
    const d=window.EvertaleData;
    if(!d||d.__leaderSkillResolverPatched)return false;
    d.__leaderSkillResolverPatched=true;
    const wrapList=(name)=>{
      const orig=d[name];
      if(typeof orig!=='function')return;
      d[name]=async function(...args){
        const rows=await orig.apply(this,args);
        return resolveRows(rows);
      };
    };
    wrapList('loadCharactersMerged');
    wrapList('loadEntryCategory');
    const origAll=d.loadAllEntries;
    if(typeof origAll==='function'){
      d.loadAllEntries=async function(...args){
        const all=await origAll.apply(this,args);
        if(all&&Array.isArray(all.characters))resolveRows(all.characters);
        return all;
      };
    }
    return true;
  }
  function boot(){if(!patch())setTimeout(boot,50)}
  boot();
})();
