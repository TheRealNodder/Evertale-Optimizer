/* leader-skill-resolver.js — populate displayable leader skill names/descriptions.
   Authority order:
   1) apkfiles/entries/localization/leader_skill_localization.json from Localizable_English
   2) legacy leader skills merged into that file by character display name
   3) existing entry leaderSkill fields
   4) deterministic fallback text only when localization is missing
*/
(function(){
  const TIER_PERCENT = { A:2, B:4, C:7, D:10, E:15, F:20 };
  const DATA_VERSION = window.EVERTALE_LIVE_CONFIG?.dataVersion || window.EVERTALE_LIVE_CONFIG?.version || '';
  let leaderSkillMapPromise = null;

  function norm(v){return String(v||'').trim();}
  function keyNorm(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');}
  function wordsFromCamel(v){return norm(v).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2').replace(/[_-]+/g,' ').trim();}
  function versioned(url){ if(!DATA_VERSION)return url; return `${url}${url.includes('?')?'&':'?'}v=${encodeURIComponent(DATA_VERSION)}`; }
  async function loadLeaderSkillMap(){
    if(leaderSkillMapPromise) return leaderSkillMapPromise;
    leaderSkillMapPromise = fetch(versioned('./apkfiles/entries/localization/leader_skill_localization.json'), { cache:'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => j && typeof j === 'object' ? j : { skills:{} })
      .catch(() => ({ skills:{} }));
    return leaderSkillMapPromise;
  }
  function localizedLookup(payload, id){
    const skills = payload?.skills || {};
    const raw = norm(id);
    if(!raw || !skills) return null;
    if(skills[raw]) return skills[raw];
    const n = keyNorm(raw);
    for(const [k,v] of Object.entries(skills)) if(keyNorm(k) === n) return v;
    return null;
  }
  function legacyLookup(payload, u){
    const legacy = payload?.legacyByCharacter || {};
    const aliases = payload?.legacyCharacterAliases || {};
    const names = [
      u?.name, u?.displayName, u?.title, u?.subtitle,
      u?.localization?.name,
      [u?.localization?.name, u?.localization?.title || u?.localization?.secondName].filter(Boolean).join(' '),
      [u?.name, u?.title || u?.subtitle].filter(Boolean).join(' '),
      u?.family, u?.sourceId, u?.internal?.sourceId
    ].filter(Boolean);
    for(const value of names){
      if(legacy[value]) return legacy[value];
      const alias = aliases[keyNorm(value)];
      if(alias && legacy[alias]) return legacy[alias];
      const n = keyNorm(value);
      for(const [character,row] of Object.entries(legacy)){
        const ck = keyNorm(character);
        if(n && ck && (n === ck || n.includes(ck) || ck.includes(n))) return row;
      }
    }
    return null;
  }
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
  function tierFromBuff(id){ const m=norm(id).match(/([A-Z])$/); return m?m[1]:''; }
  function percentFromBuff(id, raw, refs, existing){
    const direct = existing?.percent ?? existing?.value ?? refs?.leaderBuffPercent ?? raw?.leaderBuffPercent ?? raw?.leaderBuffValue;
    const n = Number(direct);
    if(Number.isFinite(n) && n > 0) return n <= 1 ? Math.round(n * 100) : n;
    return TIER_PERCENT[tierFromBuff(id)] || null;
  }
  function statFromBuff(id){
    const s=norm(id);
    if(/^hpup/i.test(s)||/hp.*up/i.test(s))return{label:'HP', target:'max HP'};
    if(/^(atk|attack)up/i.test(s)||/(atk|attack).*up/i.test(s))return{label:'Attack', target:'Attack'};
    if(/^(spd|speed)up/i.test(s)||/(spd|speed).*up/i.test(s))return{label:'Speed', target:'Speed'};
    if(/^costdown/i.test(s)||/cost.*down/i.test(s))return{label:'Cost', target:'Cost'};
    if(/^spirit/i.test(s))return{label:'Spirit', target:'Spirit'};
    const label=wordsFromCamel(s.replace(/[A-Z]$/,''))||'Stats';
    return{label,target:label};
  }
  function scopeFromCondition(condition,id){
    const cond=norm(condition);
    const elem=elementFromText(cond)||elementFromText(id);
    if(elem)return`${elem} element units`;
    if(/all|ally|allies/i.test(cond))return'all allied units';
    return'allied units';
  }
  function buildDescription(id,condition,raw,refs,existing){
    const stat=statFromBuff(id);
    const scope=scopeFromCondition(condition,id);
    const pct=percentFromBuff(id,raw,refs,existing);
    const pctText=pct?` by ${pct}%`:'';
    if(/^costdown/i.test(id))return`Reduces ${scope} ${stat.target}${pctText}.`;
    if(/^spirit/i.test(id))return`Improves Spirit support for ${scope}${pctText}.`;
    return`Raises ${scope} ${stat.target}${pctText}.`;
  }
  function buildName(id,condition){
    const stat=statFromBuff(id);
    const elem=elementFromText(condition)||elementFromText(id);
    const scope=elem?`${elem} `:'';
    if(/^costdown/i.test(id))return`${scope}Cost Down`;
    if(/^spirit/i.test(id))return`${scope}Spirit Support`;
    return`${scope}${stat.label} Up`;
  }
  function isWeakGeneratedDescription(value){
    const s=norm(value);
    if(!s || s==='None') return true;
    if(/\bTier [A-Z]\b/.test(s)) return true;
    if(/^Increases\s+(HP|Attack|Speed|Stats)\s+for\s+/i.test(s)) return true;
    if(/^Raises\s+.*\s+(max HP|Attack|Speed|Stats)\s+by\s+\d+%\.?$/i.test(s)) return true;
    if(/^Decreases\s+Cost\s+for\s+/i.test(s)) return true;
    return false;
  }
  function resolveUnitWithMap(u, payload){
    if(!u||typeof u!=='object')return u;
    const existing=u.leaderSkill&&typeof u.leaderSkill==='object'?u.leaderSkill:{};
    const raw=u.raw&&typeof u.raw==='object'?u.raw:{};
    const refs=u.refs&&typeof u.refs==='object'?u.refs:{};
    const internalId=norm(existing.internalId||existing.id||refs.leaderBuff||raw.leaderBuff||'');
    const condition=norm(existing.condition||refs.leaderBuffCondition||raw.leaderBuffCondition||'');
    const legacy=legacyLookup(payload, u);
    if(legacy && (legacy.name || legacy.description)){
      u.leaderSkill={
        ...existing,
        name: legacy.name || existing.name || buildName(internalId,condition),
        description: legacy.description || existing.description || buildDescription(internalId,condition,raw,refs,existing),
        affected: legacy.element || existing.affected || '',
        internalId,
        condition,
        localizationSource:'legacy/leader_skills.json',
        legacyCharacter: legacy.character || ''
      };
      return u;
    }
    if(!internalId){
      u.leaderSkill={name:'No Leader Skill',description:'This unit does not provide a leader skill.',internalId:'',condition:''};
      return u;
    }
    const loc=localizedLookup(payload, internalId);
    if(loc && (loc.name || loc.description || loc.affected)){
      u.leaderSkill={
        ...existing,
        name: loc.name || existing.name || buildName(internalId,condition),
        description: loc.description || loc.affected || existing.description || buildDescription(internalId,condition,raw,refs,existing),
        affected: loc.affected || existing.affected || '',
        internalId,
        condition,
        localizationSource:'Localizable_English'
      };
      return u;
    }
    const name=norm(existing.name)&&existing.name!=='None'?existing.name:buildName(internalId,condition);
    const description=!isWeakGeneratedDescription(existing.description)?existing.description:buildDescription(internalId,condition,raw,refs,existing);
    u.leaderSkill={...existing,name,description,internalId,condition,percent:percentFromBuff(internalId,raw,refs,existing),localizationSource:'fallback'};
    return u;
  }
  async function resolveRows(rows){
    const payload = await loadLeaderSkillMap();
    if(Array.isArray(rows)) rows.forEach(u => resolveUnitWithMap(u, payload));
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
        return await resolveRows(rows);
      };
    };
    wrapList('loadCharactersMerged');
    wrapList('loadEntryCategory');
    const origAll=d.loadAllEntries;
    if(typeof origAll==='function'){
      d.loadAllEntries=async function(...args){
        const all=await origAll.apply(this,args);
        if(all&&Array.isArray(all.characters)) await resolveRows(all.characters);
        return all;
      };
    }
    return true;
  }
  function boot(){if(!patch())setTimeout(boot,50)}
  boot();
})();
