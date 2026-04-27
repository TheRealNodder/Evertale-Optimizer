(function(){
  const DATA_FILES = {
    characters: './data/characters.json',
    tags: './data/character_tags.json',
    actives: './data/character_actives.json',
    passives: './data/character_passives.json',
  };

  function toArray(json, key) {
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json[key])) return json[key];
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

  async function loadCharactersMerged() {
    const [baseJson, tagJson, activeJson, passiveJson] = await Promise.all([
      fetchJson(DATA_FILES.characters, false),
      fetchJson(DATA_FILES.tags, true),
      fetchJson(DATA_FILES.actives, true),
      fetchJson(DATA_FILES.passives, true),
    ]);

    const baseRows = dedupeById(toArray(baseJson, 'characters')).map(row => ({ ...row, element: normalizeElementValue(row?.element) }));
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
      if (passives.some(p => p && typeof p === 'object')) {
        target.passiveSkillDetails = passives;
      }
    }

    return Array.from(byId.values());
  }

  window.EvertaleData = {
    fetchJson,
    toArray,
    loadCharactersMerged,
  };
})();
