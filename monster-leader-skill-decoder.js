/* monster-leader-skill-decoder.js — final pass for Monster.json leaderBuff ids. */
(function(){
  function n(v){return String(v||'').trim();}
  function elem(id, cond){
    const s = `${id||''} ${cond||''}`;
    if(/Air|Storm|Thunder|Lightning|IsAir/i.test(s)) return 'Storm';
    if(/Earth|Terra|Ground|IsEarth/i.test(s)) return 'Earth';
    if(/Water|Ice|IsWater/i.test(s)) return 'Water';
    if(/Fire|Flame|IsFire/i.test(s)) return 'Fire';
    if(/Life|Light|IsLife/i.test(s)) return 'Light';
    if(/Death|Dark|IsDeath/i.test(s)) return 'Dark';
    return '';
  }
  function decode(id, cond){
    id = n(id); if(!id) return null;
    const e = elem(id, cond);
    const scope = e ? `Allied ${e} element units` : 'Allied units';
    const combo = /AttackAndHPUp|ATKAndHPUp|HPAndATKUp/i.test(id);
    const hp = /^HPUp|HP.*Up/i.test(id) || combo;
    const atk = /^AttackUp|^ATKUp|Attack.*Up|ATK.*Up/i.test(id) || combo;
    if(combo) return { name:`${e?e+' ':''}ATK & HP Up`, description:`${scope} have their Attack increased by 10% and max HP increased by 7%.`, affected:e };
    if(atk) return { name:`${e?e+' ':''}Attack Up`, description:`${scope} have their Attack increased by 15%.`, affected:e };
    if(hp) return { name:`${e?e+' ':''}HP Up`, description:`${scope} have their max HP increased by 10%.`, affected:e };
    return null;
  }
  function applyRow(u){
    if(!u || typeof u !== 'object') return u;
    const raw = u.raw && typeof u.raw === 'object' ? u.raw : {};
    const refs = u.refs && typeof u.refs === 'object' ? u.refs : {};
    const ls = u.leaderSkill && typeof u.leaderSkill === 'object' ? u.leaderSkill : {};
    const id = n(ls.internalId || ls.id || refs.leaderBuff || raw.leaderBuff || '');
    const cond = n(ls.condition || refs.leaderBuffCondition || raw.leaderBuffCondition || '');
    const decoded = decode(id, cond);
    if(decoded){
      u.leaderSkill = { ...ls, ...decoded, internalId:id, condition:cond, assignmentSource:'Monster.json', localizationSource:'Monster leaderBuff id' };
    }
    return u;
  }
  function patch(){
    const d = window.EvertaleData;
    if(!d || d.__monsterLeaderDecoderPatched) return false;
    d.__monsterLeaderDecoderPatched = true;
    const wrap = name => {
      const orig = d[name];
      if(typeof orig !== 'function') return;
      d[name] = async function(...args){
        const rows = await orig.apply(this,args);
        if(Array.isArray(rows)) rows.forEach(applyRow);
        return rows;
      };
    };
    wrap('loadCharactersMerged');
    wrap('loadEntryCategory');
    const origAll = d.loadAllEntries;
    if(typeof origAll === 'function'){
      d.loadAllEntries = async function(...args){
        const all = await origAll.apply(this,args);
        if(all && Array.isArray(all.characters)) all.characters.forEach(applyRow);
        return all;
      };
    }
    return true;
  }
  function boot(){ if(!patch()) setTimeout(boot,50); }
  boot();
})();
