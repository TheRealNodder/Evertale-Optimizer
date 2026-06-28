/* leader-skill-resolver.js — resolve leader skills from Monster entry leaderBuff IDs and Localizable English only. */
(function(){
  const DATA_VERSION = window.EVERTALE_LIVE_CONFIG?.dataVersion || window.EVERTALE_LIVE_CONFIG?.version || '';
  let leaderSkillMapPromise = null;

  function norm(v){ return String(v || '').trim(); }
  function keyNorm(v){ return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function versioned(url){ if(!DATA_VERSION) return url; return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(DATA_VERSION)}`; }

  async function loadLeaderSkillMap(){
    if(leaderSkillMapPromise) return leaderSkillMapPromise;
    leaderSkillMapPromise = fetch(versioned('./apkfiles/entries/localization/leader_skill_localization.json'), { cache: 'default' })
      .then(r => r.ok ? r.json() : null)
      .then(j => j && typeof j === 'object' ? j : { skills: {} })
      .catch(() => ({ skills: {} }));
    return leaderSkillMapPromise;
  }

  function localizedLookup(payload, id){
    const skills = payload?.skills || {};
    const raw = norm(id);
    if(!raw) return null;
    if(skills[raw]) return skills[raw];
    const rawKey = keyNorm(raw);
    for(const [key, value] of Object.entries(skills)){
      if(keyNorm(key) === rawKey) return value;
    }
    return null;
  }

  function elementFromLeaderId(id, condition){
    const s = `${id || ''} ${condition || ''}`;
    const checks = [
      ['Dark', ['Death', 'Dark', 'IsDeath']],
      ['Light', ['Life', 'Light', 'IsLife']],
      ['Storm', ['Air', 'Storm', 'Thunder', 'Lightning', 'Electric', 'IsAir']],
      ['Earth', ['Earth', 'Terra', 'Ground', 'IsEarth']],
      ['Water', ['Water', 'Ice', 'IsWater']],
      ['Fire', ['Fire', 'Flame', 'IsFire']]
    ];
    for(const [element, tokens] of checks){
      if(tokens.some(token => s.toLowerCase().includes(String(token).toLowerCase()))) return element;
    }
    return '';
  }

  function parseLevelPercent(id){
    const match=String(id||'').match(/(?:Up|Boost)(\d+)/i) || String(id||'').match(/(\d+)(?:Death|Life|Fire|Water|Earth|Air|Storm|Dark|Light)?$/i);
    const level=match?Number(match[1]):0;
    if(level>=6) return { attack: 15, hp: 10 };
    if(level>=5) return { attack: 12, hp: 10 };
    if(level>=4) return { attack: 10, hp: 8 };
    if(level>=3) return { attack: 8, hp: 7 };
    if(level>=2) return { attack: 6, hp: 5 };
    return { attack: 5, hp: 5 };
  }

  function conditionText(condition, element){
    const c=String(condition||'');
    if(element) return `Allied ${element} element units`;
    if(/Death/i.test(c)) return 'Allied Dark element units';
    if(/Life/i.test(c)) return 'Allied Light element units';
    if(/Fire/i.test(c)) return 'Allied Fire element units';
    if(/Water/i.test(c)) return 'Allied Water element units';
    if(/Earth/i.test(c)) return 'Allied Earth element units';
    if(/Air|Storm|Thunder|Lightning|Electric/i.test(c)) return 'Allied Storm element units';
    return 'Allied units';
  }

  function decodeLeaderBuffId(id, condition){
    id = norm(id);
    if(!id) return null;
    const element = elementFromLeaderId(id, condition);
    const scope = conditionText(condition, element);
    const pct = parseLevelPercent(id);
    const combo = /AttackAndHPUp|ATKAndHPUp|HPAndATKUp|Attack.*HP|HP.*Attack/i.test(id);
    const hp = /HPUp|HP.*Up|HPBoost/i.test(id) || combo;
    const atk = /AttackUp|ATKUp|Attack.*Up|ATK.*Up|AttackBoost|ATKBoost/i.test(id) || combo;
    if(combo) return { name: `${element ? element + ' ' : ''}ATK & HP Up`, description: `${scope} have their Attack increased by ${pct.attack}% and max HP increased by ${pct.hp}%.`, affected: element };
    if(atk) return { name: `${element ? element + ' ' : ''}Attack Up`, description: `${scope} have their Attack increased by ${pct.attack}%.`, affected: element };
    if(hp) return { name: `${element ? element + ' ' : ''}HP Up`, description: `${scope} have their max HP increased by ${pct.hp}%.`, affected: element };
    return { name: id.replace(/([a-z])([A-Z])/g,'$1 $2'), description: scope ? `Applies to ${scope}.` : '', affected: element };
  }

  function resolveUnitWithMap(unit, payload){
    if(!unit || typeof unit !== 'object') return unit;
    const existing = unit.leaderSkill && typeof unit.leaderSkill === 'object' ? unit.leaderSkill : {};
    const raw = unit.raw && typeof unit.raw === 'object' ? unit.raw : {};
    const refs = unit.refs && typeof unit.refs === 'object' ? unit.refs : {};
    const internal = unit.internal && typeof unit.internal === 'object' ? unit.internal : {};
    const internalId = norm(existing.internalId || existing.id || refs.leaderBuff || raw.leaderBuff || internal.leaderBuff || '');
    const condition = norm(existing.condition || refs.leaderBuffCondition || raw.leaderBuffCondition || internal.leaderBuffCondition || '');

    if(!internalId){
      unit.leaderSkill = { name: 'No Leader Skill', description: 'This unit does not provide a leader skill.', internalId: '', condition: '' };
      return unit;
    }

    const localized = localizedLookup(payload, internalId);
    if(localized && (localized.name || localized.description || localized.affected)){
      unit.leaderSkill = {
        ...existing,
        name: localized.name || existing.name || internalId,
        description: localized.description || localized.affected || existing.description || '',
        affected: localized.affected || existing.affected || '',
        internalId,
        condition,
        assignmentSource: 'Monster entry leaderBuff',
        localizationSource: 'Localizable_English'
      };
      return unit;
    }

    const decoded = decodeLeaderBuffId(internalId, condition);
    if(decoded){
      unit.leaderSkill = {
        ...existing,
        name: decoded.name,
        description: decoded.description,
        affected: decoded.affected,
        internalId,
        condition,
        assignmentSource: 'Monster entry leaderBuff',
        localizationSource: 'leaderBuff id decode'
      };
      return unit;
    }

    unit.leaderSkill = { ...existing, name: existing.name || internalId, description: existing.description || '', internalId, condition, assignmentSource: 'Monster entry leaderBuff', localizationSource: 'unresolved' };
    return unit;
  }

  async function resolveRows(rows){
    const payload = await loadLeaderSkillMap();
    if(Array.isArray(rows)) rows.forEach(row => resolveUnitWithMap(row, payload));
    return rows;
  }

  function patch(){
    const data = window.EvertaleData;
    if(!data || data.__leaderSkillResolverPatched) return false;
    data.__leaderSkillResolverPatched = true;
    const wrap = name => {
      const original = data[name];
      if(typeof original !== 'function') return;
      data[name] = async function(...args){
        const rows = await original.apply(this, args);
        return await resolveRows(rows);
      };
    };
    wrap('loadCharactersMerged');
    wrap('loadEntryCategory');
    const originalAll = data.loadAllEntries;
    if(typeof originalAll === 'function'){
      data.loadAllEntries = async function(...args){
        const all = await originalAll.apply(this, args);
        if(all && Array.isArray(all.characters)) await resolveRows(all.characters);
        return all;
      };
    }
    return true;
  }

  function boot(){ if(!patch()) setTimeout(boot, 50); }
  boot();
})();
