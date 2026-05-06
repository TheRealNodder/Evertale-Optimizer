(function(){
  const ENTRY_BASE = './apkfiles/entries';
  const LEGACY_DATA_FILES = {
    characters: './data/characters.json',
    tags: './data/character_tags.json',
    actives: './data/character_actives.json',
    passives: './data/character_passives.json'
  };

  const CONCURRENCY = 32;
  let characterOrderCache = null;

  function toArray(json, key) {
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json[key])) return json[key];
    if (json && Array.isArray(json.items)) return json.items;
    return [];
  }

  async function fetchJson(url, optional = false) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
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

  function stripFormSuffix(sourceId) {
    return String(sourceId || '').replace(/\d+$/, '');
  }

  function titleFromInternalId(sourceId) {
    return stripFormSuffix(sourceId)
      .replace(/Boss(?=\d+$)/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .trim();
  }

  function characterImageUrl(name) {
    return `https://ik.imagekit.io/r8fsa98s9/characters/${name}.png`;
  }

  function bossImageName(sourceId) {
    return String(sourceId || '').replace(/Boss(?=\d+$)/, '') + '.png';
  }

  function inferRarity(raw, entry) {
    const stars = Number(raw?.stars ?? entry?.stars ?? 0);
    const evolvedStars = Number(raw?.evolvedStars ?? entry?.evolvedStars ?? 0);
    const maxStars = Math.max(stars, evolvedStars);
    if (maxStars >= 5) return 'SSR';
    if (maxStars >= 3) return 'SR';
    if (maxStars >= 2) return 'R';
    return 'N';
  }

  function getFamily(entry, sourceId) {
    return entry?.internal?.family || entry?.raw?.family || stripFormSuffix(sourceId);
  }

  function buildImageVariants(entry, category, sourceId) {
    const variants = [];
    const add = (state, url, stars) => {
      if (url && !variants.some(v => v.url === url)) variants.push({ state, url, stars });
    };

    if (category === 'characters') {
      const raw = entry?.raw || {};
      const family = getFamily(entry, sourceId);
      const rarity = inferRarity(raw, entry);

      if (rarity === 'SSR') {
        add('base', characterImageUrl(`${family}01`), 5);
        add('evolved', characterImageUrl(`${family}02`), 6);
        add('final', characterImageUrl(`${family}03`), 6);
        if (raw.superEvolve1) add('evolvedRaw', characterImageUrl(raw.superEvolve1), 6);
        if (raw.cosmoName) add('finalRaw', characterImageUrl(raw.cosmoName), 6);
      } else if (rarity === 'SR') {
        add('base', characterImageUrl(`${family}01`), 3);
        add('evolved', characterImageUrl(`${family}02`), 4);
        if (raw.superEvolve1) add('evolvedRaw', characterImageUrl(raw.superEvolve1), 4);
      } else {
        add('base', characterImageUrl(`${family}01`), 1);
      }
      return variants;
    }

    if (entry?.image) add('default', entry.image, null);
    if (category === 'bosses') add('hd', `https://ik.imagekit.io/r8fsa98s9/characters/${bossImageName(sourceId)}`, null);
    return variants;
  }

  async function getCharacterOrderMap() {
    if (characterOrderCache) return characterOrderCache;

    const json = await fetchJson(`${ENTRY_BASE}/maps/character_order_map.json`, true);
    const orderRows = Array.isArray(json?.order) ? json.order : [];
    const order = new Map();
    const names = new Map();

    orderRows.forEach((row, idx) => {
      if (!row || !row.key) return;
      const key = String(row.key);
      order.set(key, idx);
      names.set(key, row.displayName || key);
    });

    characterOrderCache = { order, names };
    return characterOrderCache;
  }

  function familyOrderIndex(family, sourceId, order) {
    const fam = String(family || '').trim();
    const srcFamily = stripFormSuffix(sourceId);
    if (order.has(fam)) return order.get(fam);
    if (order.has(srcFamily)) return order.get(srcFamily);
    return 999999;
  }

  async function sortCharactersByMap(rows) {
    const { order, names } = await getCharacterOrderMap();
    if (!order.size) return rows;

    return [...rows]
      .sort((a, b) => {
        const ai = familyOrderIndex(a.family, a.sourceId, order);
        const bi = familyOrderIndex(b.family, b.sourceId, order);
        if (ai !== bi) return ai - bi;
        return String(a.sourceId || '').localeCompare(String(b.sourceId || ''));
      })
      .map(row => {
        const fam = row.family || stripFormSuffix(row.sourceId);
        const displayName = names.get(fam) || names.get(stripFormSuffix(row.sourceId));
        return displayName ? { ...row, name: displayName, displayName } : row;
      });
  }

  function deriveTags(entry, category) {
    const tags = new Set();
    const element = normalizeElementValue(entry?.element || entry?.raw?.element);
    const weapon = String(entry?.weaponType || entry?.raw?.weaponPref || '').toLowerCase();
    const attackType = String(entry?.raw?.attackType || '').toLowerCase();

    if (element) tags.add(`elem_${element}`);
    if (weapon) tags.add(`weapon_${weapon}`);
    if (attackType) tags.add(`attack_${attackType}`);
    if (category) tags.add(`category_${category}`);

    const refs = entry?.refs || {};
    const raw = entry?.raw || {};
    const allSkillIds = [...(refs.activeSkills || []), ...(refs.passives || [])].map(String);

    for (const id of allSkillIds) {
      const s = id.toLowerCase();
      if (s.includes('burn')) tags.add('burn');
      if (s.includes('poison')) tags.add('poison');
      if (s.includes('sleep')) tags.add('sleep');
      if (s.includes('stun')) tags.add('stun');
      if (s.includes('blood')) tags.add('blood_mechanic');
      if (s.includes('token') || s.includes('minion')) tags.add('token_generation');
      if (s.includes('buff')) tags.add('buff');
      if (s.includes('heal')) tags.add('heal');
      if (s.includes('guard')) tags.add('guard');
    }

    if (Array.isArray(raw.summonableMonsters) && raw.summonableMonsters.length) {
      tags.add('summoner');
      tags.add('token_generation');
    }
    if (refs.leaderBuff || raw.leaderBuff) tags.add('leader_skill');
    if (refs.leaderBuffCondition || raw.leaderBuffCondition) tags.add(`leader_condition_${String(refs.leaderBuffCondition || raw.leaderBuffCondition).toLowerCase()}`);
    if (Array.isArray(entry?.derivedTags)) for (const t of entry.derivedTags) tags.add(normalizeElementTag(t));

    return Array.from(tags).filter(Boolean);
  }

  function normalizeEntryForOldSite(entry, category) {
    const sourceId = String(entry?.internal?.sourceId || entry?.name || entry?.id || '').trim();
    const raw = entry?.raw || {};
    const family = getFamily(entry, sourceId);
    const id = entry?.id || sourceId.toLowerCase();
    const element = normalizeElementValue(entry?.element || raw.element);
    const stats = entry?.stats || {};
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

    const variants = buildImageVariants(entry, category, sourceId);
    const out = {
      id,
      sourceId,
      family,
      name: entry?.name || titleFromInternalId(sourceId),
      title: entry?.title || '',
      type: category,
      category,
      element,
      image: variants[0]?.url || entry?.image || '',
      stats: {
        atk: stats.atk ?? raw.baseAttack ?? raw.attack ?? '',
        hp: stats.hp ?? raw.baseMaxHp ?? raw.hp ?? '',
        spd: stats.spd ?? raw.speed ?? '',
        cost: stats.cost ?? raw.cost ?? ''
      },
      rarity: entry?.rarity || inferRarity(raw, entry),
      stars: entry?.stars ?? raw.stars,
      evolvedStars: entry?.evolvedStars ?? raw.evolvedStars,
      weaponType: entry?.weaponType,
      activeSkills,
      passiveSkills: passiveSkills.map(p => p.name || p.id),
      passiveSkillDetails: passiveSkills,
      leaderSkill: entry?.leaderSkill || {
        internalId: entry?.refs?.leaderBuff || raw.leaderBuff || '',
        condition: entry?.refs?.leaderBuffCondition || raw.leaderBuffCondition || ''
      },
      raw,
      refs: entry?.refs || {},
      internal: entry?.internal || {},
      _entryBased: true
    };

    out.imageVariants = variants;
    out.imagesLarge = variants.map(v => v.url);
    out.derivedTags = deriveTags({ ...entry, derivedTags: entry?.derivedTags }, category);
    out.tags = out.derivedTags;
    return out;
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
    // Characters must not be sliced before ordering. The desired order starts with newest families,
    // while the raw index starts with old low-rarity units.
    if (category === 'characters') return rows;
    return rows.slice(0, 260);
  }

  async function loadEntryCategory(category, optional = false) {
    const index = await fetchJson(`${ENTRY_BASE}/${category}/index.json`, optional);
    if (!index || !Array.isArray(index.entries)) return [];

    const loaded = await mapLimit(entryRowsForCategory(index, category), CONCURRENCY, async (row) => {
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

    const out = loaded.filter(Boolean);
    return category === 'characters' ? sortCharactersByMap(out) : out;
  }

  async function loadAllEntries() {
    const [characters, weapons, accessories, bosses] = await Promise.all([
      loadEntryCategory('characters', false),
      loadEntryCategory('weapons', true),
      loadEntryCategory('accessories', true),
      loadEntryCategory('bosses', true)
    ]);
    return { characters, weapons, accessories, bosses };
  }

  async function loadCharactersMergedLegacy() {
    const [baseJson, tagJson, activeJson, passiveJson] = await Promise.all([
      fetchJson(LEGACY_DATA_FILES.characters, false),
      fetchJson(LEGACY_DATA_FILES.tags, true),
      fetchJson(LEGACY_DATA_FILES.actives, true),
      fetchJson(LEGACY_DATA_FILES.passives, true)
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

  window.EvertaleData = {
    fetchJson,
    toArray,
    normalizeElementValue,
    normalizeElementTag,
    loadCharactersMerged,
    loadCharactersMergedLegacy,
    loadEntryCategory,
    loadAllEntries
  };
})();
