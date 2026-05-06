(function(){
  const ENTRY_BASE = './apkfiles/entries';
  const LEGACY_DATA_FILES = {
    characters: './data/characters.json',
    tags: './data/character_tags.json',
    actives: './data/character_actives.json',
    passives: './data/character_passives.json',
  };
  const CATEGORY_LIMITS = {
    characters: 260,
    weapons: 260,
    accessories: 140,
    bosses: 260,
  };
  const CONCURRENCY = 24;

  function toArray(json, key) {
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json[key])) return json[key];
    return [];
  }

  async function fetchJson(url, optional = false) {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) {
        if (optional) return null;
        throw new Error(`Failed to fetch ${url}: ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (optional) return null;
      throw err;
    }
  }

  function dedupeById(rows) {
    const seen = new Set();
    const out = [];
    for (const row of rows || []) {
      const id = String(row?.id ?? '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
    return out;
  }

  function normalizeElementValue(value) {
    const e = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (e === 'fire' || e === 'flame') return 'fire';
    if (e === 'water' || e === 'ice') return 'water';
    if (e === 'storm' || e === 'air' || e === 'wind' || e === 'thunder' || e === 'lightning' || e === 'electric') return 'storm';
    if (e === 'earth' || e === 'terra' || e === 'ground') return 'earth';
    if (e === 'light' || e === 'life' || e === 'holy') return 'light';
    if (e === 'dark' || e === 'death' || e === 'shadow') return 'dark';
    return e || String(value || '');
  }

  function normalizeElementTag(tag) {
    const raw = String(tag || '');
    if (!raw.startsWith('elem_')) return raw;
    return 'elem_' + normalizeElementValue(raw.slice(5));
  }

  function passiveNamesFromArray(passives) {
    if (!Array.isArray(passives)) return [];
    return passives.map(p => typeof p === 'string' ? p : String(p?.name ?? '')).filter(Boolean);
  }

  function titleFromInternalId(sourceId) {
    return String(sourceId || '')
      .replace(/Boss(?=\d+$)/, '')
      .replace(/\d+$/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .trim();
  }

  function normalizeEntryForOldSite(entry, category) {
    const sourceId = String(entry?.internal?.sourceId || entry?.name || entry?.id || '').trim();
    const id = entry?.id || sourceId.toLowerCase();
    const element = normalizeElementValue(entry?.element);
    const stats = entry?.stats || {};
    const raw = entry?.raw || {};
    const resolved = entry?.resolved || {};
    const activeSkills = [];
    const passiveSkills = [];

    if (resolved.activeSkills && typeof resolved.activeSkills === 'object') {
      for (const [skillId, detail] of Object.entries(resolved.activeSkills)) {
        const loc = detail?.localization || {};
        activeSkills.push({ id: skillId, name: loc.name || skillId, description: loc.description || '' });
      }
    } else if (Array.isArray(entry?.refs?.activeSkills)) {
      for (const skillId of entry.refs.activeSkills) activeSkills.push({ id: skillId, name: skillId, description: '' });
    }

    if (resolved.passives && typeof resolved.passives === 'object') {
      for (const [skillId, detail] of Object.entries(resolved.passives)) {
        const loc = detail?.localization || {};
        passiveSkills.push({ id: skillId, name: loc.name || skillId, description: loc.description || '' });
      }
    } else if (Array.isArray(entry?.refs?.passives)) {
      for (const skillId of entry.refs.passives) passiveSkills.push({ id: skillId, name: skillId, description: '' });
    }

    return {
      id,
      sourceId,
      name: entry?.name || titleFromInternalId(sourceId),
      title: entry?.title || '',
      type: category,
      category,
      element,
      image: entry?.image || '',
      stats: {
        atk: stats.atk ?? raw.baseAttack ?? raw.attack ?? '',
        hp: stats.hp ?? raw.baseMaxHp ?? raw.hp ?? '',
        spd: stats.spd ?? raw.speed ?? '',
        cost: stats.cost ?? raw.cost ?? '',
      },
      rarity: entry?.rarity,
      stars: entry?.stars,
      evolvedStars: entry?.evolvedStars,
      weaponType: entry?.weaponType,
      activeSkills,
      passiveSkills: passiveSkills.map(p => p.name || p.id),
      passiveSkillDetails: passiveSkills,
      derivedTags: Array.isArray(entry?.derivedTags) ? entry.derivedTags.map(normalizeElementTag) : [],
      leaderSkill: entry?.leaderSkill || { internalId: entry?.refs?.leaderBuff || raw.leaderBuff || '', condition: entry?.refs?.leaderBuffCondition || raw.leaderBuffCondition || '' },
      raw,
      refs: entry?.refs || {},
      internal: entry?.internal || {},
      _entryBased: true,
    };
  }

  async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let index = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const current = index++;
        results[current] = await worker(items[current], current);
      }
    });
    await Promise.all(workers);
    return results;
  }

  function entryRowsForCategory(index, category) {
    const rows = Array.isArray(index?.entries) ? index.entries : [];
    const limit = CATEGORY_LIMITS[category];
    return limit ? rows.slice(0, limit) : rows;
  }

  async function loadEntryCategory(category, optional = false) {
    const index = await fetchJson(`${ENTRY_BASE}/${category}/index.json`, optional);
    if (!index || !Array.isArray(index.entries)) return [];

    const rowsToLoad = entryRowsForCategory(index, category);
    const loaded = await mapLimit(rowsToLoad, CONCURRENCY, async (row) => {
      const file = String(row.file || '').replace(/^\.\//, '');
      if (!file) return null;
      try {
        const entry = await fetchJson(`${ENTRY_BASE}/${category}/${file}`, false);
        return normalizeEntryForOldSite(entry, category);
      } catch (err) {
        console.warn('[EvertaleData] Skipping broken entry:', category, file, err);
        return null;
      }
    });
    return loaded.filter(Boolean);
  }

  async function loadAllEntries() {
    const [characters, weapons, accessories, bosses] = await Promise.all([
      loadEntryCategory('characters', false),
      loadEntryCategory('weapons', true),
      loadEntryCategory('accessories', true),
      loadEntryCategory('bosses', true),
    ]);
    return { characters, weapons, accessories, bosses };
  }

  async function loadCharactersMergedLegacy() {
    const [baseJson, tagJson, activeJson, passiveJson] = await Promise.all([
      fetchJson(LEGACY_DATA_FILES.characters, false),
      fetchJson(LEGACY_DATA_FILES.tags, true),
      fetchJson(LEGACY_DATA_FILES.actives, true),
      fetchJson(LEGACY_DATA_FILES.passives, true),
    ]);

    const baseRows = dedupeById(toArray(baseJson, 'characters')).map(row => ({ ...row }));
    const byId = new Map(baseRows.map(row => [String(row.id), row]));

    for (const tagRow of dedupeById(toArray(tagJson, 'character_tags'))) {
      const target = byId.get(String(tagRow.id));
      if (!target) continue;
      if (Array.isArray(tagRow.derivedTags)) target.derivedTags = [...tagRow.derivedTags].map(normalizeElementTag);
      if (tagRow.tagEvidence && typeof tagRow.tagEvidence === 'object') target.tagEvidence = { ...tagRow.tagEvidence };
    }

    for (const activeRow of dedupeById(toArray(activeJson, 'character_actives'))) {
      const target = byId.get(String(activeRow.id));
      if (!target) continue;
      if (Array.isArray(activeRow.activeSkills)) target.activeSkills = [...activeRow.activeSkills];
    }

    for (const passiveRow of dedupeById(toArray(passiveJson, 'character_passives'))) {
      const target = byId.get(String(passiveRow.id));
      if (!target) continue;
      if (!Array.isArray(passiveRow.passiveSkills)) continue;
      const passives = [...passiveRow.passiveSkills];
      target.passiveSkills = passiveNamesFromArray(passives);
      if (passives.some(p => p && typeof p === 'object')) target.passiveSkillDetails = passives;
    }

    return Array.from(byId.values());
  }

  async function loadCharactersMerged() {
    try {
      const entries = await loadEntryCategory('characters', false);
      if (entries.length) return entries;
      console.warn('[EvertaleData] Entry characters empty. Falling back to legacy data.');
    } catch (err) {
      console.warn('[EvertaleData] Entry characters failed. Falling back to legacy data.', err);
    }
    return loadCharactersMergedLegacy();
  }

  window.EvertaleData = { fetchJson, toArray, normalizeElementValue, normalizeElementTag, loadCharactersMerged, loadCharactersMergedLegacy, loadEntryCategory, loadAllEntries };
})();
