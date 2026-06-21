/* runtime-stat-engine.js
   Central runtime-style stat estimator.

   Why this exists:
   The decompiled runtime confirmed Evertale uses MonsterInstance / WeaponInstance /
   EquipmentInstance state objects, cached stats, training state, and limit-break helpers.
   This file mirrors that architecture for the website without mutating apkfiles/entries.

   It is intentionally conservative:
   - explicit RefStat200 profile overrides win when present
   - otherwise APK seed stats are treated as the RefStat200 library anchors
   - rank BP is exposed as battalion context, not folded into per-unit power
*/
(function(global){
  "use strict";

  const DEFAULTS = {
    fellowshipHp: 4900,
    fellowshipAtk: 750,
    playerLevel: 300,
    fellowshipEnabled: true
  };

  const AWAKENING = [1.00, 1.22, 1.44, 1.66, 1.88];

  const LB_TIERS = [
    { tier: 0, min: 1,   max: 80,  mul: 1.00 },
    { tier: 1, min: 81,  max: 100, mul: 1.00 },
    { tier: 2, min: 101, max: 120, mul: 1.08 },
    { tier: 3, min: 121, max: 140, mul: 1.16 },
    { tier: 4, min: 141, max: 160, mul: 1.24 },
    { tier: 5, min: 161, max: 180, mul: 1.32 },
    { tier: 6, min: 181, max: 200, mul: 1.40 }
  ];

  let seedIndex = null;
  let seedBySource = new Map();
  let familyBest = new Map();

  function n(v, fallback = 0) {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, n(v, min)));
  }

  function roundInt(v) {
    return Math.round(n(v));
  }

  function norm(v) {
    return String(v ?? "").trim();
  }

  function formSuffix(id) {
    const m = norm(id).match(/(\d+)$/);
    return m ? Number(m[1]) : 0;
  }

  function familyOf(id) {
    return norm(id).replace(/\d+$/, "");
  }

  function stateLabel(row, index) {
    const state = norm(row && row.state);
    const stars = n(row && row.stars);
    if (state === "final") return "FA";
    if (stars >= 6) return index >= 2 ? "FA" : "6Star";
    if (stars >= 5) return "5Star";
    if (state) return state.replace(/(^|[-_])\w/g, s => s.replace(/[-_]/, "").toUpperCase());
    return `State ${index + 1}`;
  }

  function seedFromStats(row, unit) {
    const stats = row && row.stats ? row.stats : {};
    return {
      sourceId: row && (row.dataSourceId || row.sourceId || row.imageSourceId) || unit?.sourceId || unit?.id || "",
      family: unit?.family || unit?.id || "",
      baseAttack: stats.atk ?? row?.atk ?? unit?.atk ?? unit?.stats?.atk,
      baseMaxHp: stats.hp ?? row?.hp ?? unit?.hp ?? unit?.stats?.hp,
      speed: stats.spd ?? row?.spd ?? unit?.spd ?? unit?.stats?.spd,
      cost: stats.cost ?? row?.cost ?? unit?.cost ?? unit?.stats?.cost,
      rarity: row?.rarity || unit?.rarity
    };
  }

  function seedForSource(sourceId) {
    const id = norm(sourceId);
    return (id && seedBySource.get(id)) || null;
  }

  function listUnitStates(unit) {
    const rows = [];
    const seen = new Set();

    function add(row, source) {
      if (!row || typeof row !== "object") return;
      const key = norm(row.dataSourceId || row.sourceId || row.imageSourceId || row.state || source);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const index = rows.length;
      const fallback = seedFromStats(row, unit);
      const seed =
        seedForSource(row.dataSourceId) ||
        seedForSource(row.sourceId) ||
        seedForSource(row.imageSourceId) ||
        fallback;
      rows.push({
        index,
        state: row.state || "",
        label: stateLabel(row, index),
        sourceId: row.sourceId || row.imageSourceId || row.dataSourceId || seed?.sourceId || "",
        dataSourceId: row.dataSourceId || row.sourceId || seed?.sourceId || "",
        imageSourceId: row.imageSourceId || row.sourceId || "",
        stars: row.stars,
        rarity: row.rarity || unit?.rarity || seed?.rarity || "",
        seed
      });
    }

    for (const row of (Array.isArray(unit?.forms) ? unit.forms : [])) add(row, "forms");
    for (const row of (Array.isArray(unit?.statsByForm) ? unit.statsByForm : [])) add(row, "statsByForm");
    for (const row of (Array.isArray(unit?.imageVariants) ? unit.imageVariants : [])) add(row, "imageVariants");
    return rows.filter(row => row.seed && (row.seed.baseMaxHp || row.seed.baseAttack));
  }

  function selectedStateInfo(unit, profile = {}) {
    const states = listUnitStates(unit);
    const sourceWanted = norm(profile.formSourceId || profile.sourceId || profile.dataSourceId);
    if (sourceWanted) {
      const exact = states.find(row => [row.sourceId, row.dataSourceId, row.imageSourceId, row.seed?.sourceId].map(norm).includes(sourceWanted));
      if (exact) return { states, selected: exact };
    }

    const rawIndex = Number(profile.stateIndex);
    if (Number.isFinite(rawIndex) && rawIndex >= 0 && states[rawIndex]) {
      return { states, selected: states[rawIndex] };
    }

    return { states, selected: states[states.length - 1] || null };
  }

  function installSeedIndex(index) {
    seedIndex = index || null;
    seedBySource = new Map();
    familyBest = new Map();

    for (const row of (index && index.characters) || []) {
      if (row.sourceId) seedBySource.set(String(row.sourceId), row);
    }

    for (const fam of (index && index.families) || []) {
      if (fam.family) familyBest.set(String(fam.family), fam);
    }
  }

  async function loadSeedIndex(url = "./apkfiles/derived/character-seed-index.json") {
    const res = await fetch(url, { cache: "default" });
    if (!res.ok) throw new Error("Unable to load character seed index: " + res.status);
    const json = await res.json();
    installSeedIndex(json);
    return json;
  }

  function findSeed(unit, profile = {}) {
    if (!unit) return null;

    const stateInfo = selectedStateInfo(unit, profile);
    if (stateInfo.selected && stateInfo.selected.seed) return stateInfo.selected.seed;

    const candidates = [
      unit.sourceId,
      unit.internal && unit.internal.sourceId,
      unit.raw && unit.raw.name,
      unit.forms && unit.forms.length ? unit.forms[unit.forms.length - 1].dataSourceId : null,
      unit.forms && unit.forms.length ? unit.forms[unit.forms.length - 1].sourceId : null,
      unit.statsByForm && unit.statsByForm.length ? unit.statsByForm[unit.statsByForm.length - 1].dataSourceId : null,
      unit.statsByForm && unit.statsByForm.length ? unit.statsByForm[unit.statsByForm.length - 1].sourceId : null
    ].filter(Boolean).map(String);

    // Prefer exact source IDs.
    for (const id of candidates) {
      const found = seedBySource.get(id);
      if (found) return found;
    }

    // Family fallback.
    const fam = unit.family || unit.id || familyOf(candidates[0] || "");
    const best = familyBest.get(String(fam));
    if (best && best.bestSeed) {
      return {
        sourceId: best.bestSourceId,
        family: best.family,
        baseAttack: best.bestSeed.baseAttack,
        baseMaxHp: best.bestSeed.baseMaxHp,
        speed: best.bestSeed.speed,
        cost: best.bestSeed.cost,
        rarity: best.rarity
      };
    }

    // Unit raw fallback.
    const raw = unit.raw || {};
    return {
      sourceId: candidates[0] || unit.id || "",
      family: unit.family || raw.family || "",
      baseAttack: raw.baseAttack ?? unit.atk ?? unit.stats?.atk,
      baseMaxHp: raw.baseMaxHp ?? unit.hp ?? unit.stats?.hp,
      speed: raw.speed ?? unit.spd ?? unit.stats?.spd,
      cost: raw.cost ?? unit.cost ?? unit.stats?.cost,
      rarity: unit.rarity
    };
  }

  function limitBreakTier(level) {
    const lvl = clamp(level, 1, 200);
    return LB_TIERS.find(t => lvl >= t.min && lvl <= t.max) || LB_TIERS[0];
  }

  function limitBreakMultiplier(level) {
    return limitBreakTier(level).mul;
  }

  function boostFlat(boostLevel) {
    const b = clamp(boostLevel, 0, 300);
    if (b <= 90) return { hp: b * 14, atk: b * 3 };
    return {
      hp: 1260 + ((b - 90) * 311),
      atk: 270 + ((b - 90) * 73)
    };
  }

  function rankBp(playerLevel) {
    const r = clamp(playerLevel, 0, 300);
    return (2000000 / 27000000) * Math.pow(r, 3);
  }

  function smartAscended(profile) {
    const level = n(profile && profile.level);
    const awakening = n(profile && profile.awakening);
    if (profile && profile.ascended === true) return true;
    return level > 100 && awakening >= 4;
  }

  function profileRefStat(profile, names) {
    for (const name of names) {
      const value = profile && profile[name];
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  function refStat200FromSeed(seed, statName, profile) {
    if (statName === "hp") {
      return profileRefStat(profile, ["refHP", "refHp", "refStatHP", "anchorHp"]) ?? n(seed && seed.baseMaxHp);
    }
    return profileRefStat(profile, ["refATK", "refAtk", "refStatATK", "anchorAtk"]) ?? n(seed && seed.baseAttack);
  }

  function gearStats(profile, account) {
    return {
      wepHP: n(profile?.gear?.wepHP, n(account?.gear?.wepHP)),
      wepATK: n(profile?.gear?.wepATK, n(account?.gear?.wepATK)),
      accHP: n(profile?.gear?.accHP, n(account?.gear?.accHP)),
      accATK: n(profile?.gear?.accATK, n(account?.gear?.accATK)),
      accSPD: n(profile?.gear?.accSPD, n(account?.gear?.accSPD))
    };
  }

  function calculateFromSeed(unit, seed, profile = {}, account = {}, stateInfo = null) {
    const acc = { ...DEFAULTS, ...(account || {}) };
    const level = clamp(profile.level ?? 1, 1, 200);
    const lb = limitBreakMultiplier(level);
    const awkIndex = Math.round(clamp(profile.awakening ?? 0, 0, 4));
    const awk = AWAKENING[awkIndex] || 1;
    const pot = 1 + (clamp(profile.potential ?? 0, 0, 100) / 100);
    const boost = boostFlat(profile.boost ?? 0);
    const mastery = clamp(profile.mastery ?? 0, 0, 40);
    const fellowshipHp = acc.fellowshipEnabled ? n(acc.fellowshipHp) : 0;
    const fellowshipAtk = acc.fellowshipEnabled ? n(acc.fellowshipAtk) : 0;
    const ascended = smartAscended({ ...profile, level, awakening: awkIndex });

    const refHp = refStat200FromSeed(seed, "hp", profile);
    const refAtk = refStat200FromSeed(seed, "atk", profile);

    const levelScalar = ((level + 10) / 294) * lb;
    const rawHp = refHp * levelScalar;
    const rawAtk = refAtk * levelScalar;

    const baseStackHp = rawHp + boost.hp + fellowshipHp;
    const baseStackAtk = rawAtk + boost.atk + fellowshipAtk;

    // Mastery track: potential yes, awakening no.
    const masteryTrackHp = baseStackHp * pot;
    const masteryTrackAtk = baseStackAtk * pot;
    const anchorPower = (masteryTrackHp * 12) + (masteryTrackAtk * 60);
    const masteryPower = anchorPower * 0.0025 * mastery;

    // Card track: awakening + potential, rounded before BP conversion.
    const ascHp = ascended ? refHp * 0.05 : 0;
    const ascAtk = ascended ? refAtk * 0.05 : 0;
    const hp = Math.round(baseStackHp * awk * pot) + ascHp;
    const atk = Math.round(baseStackAtk * awk * pot) + ascAtk;

    const spd = n(seed && seed.speed, n(unit && (unit.spd ?? unit.stats?.spd)));
    const cost = n(seed && seed.cost, n(unit && (unit.cost ?? unit.stats?.cost), 1));
    const gear = gearStats(profile, acc);
    const equipmentHp = gear.wepHP + gear.accHP;
    const equipmentAtk = gear.wepATK + gear.accATK;
    const blueHp = hp + equipmentHp;
    const blueAtk = atk + equipmentAtk;

    const characterPower = (hp * 12) + (atk * 60);
    const equipmentPower =
      (gear.wepHP * 6) +
      (gear.wepATK * 30) +
      (gear.accHP * 6) +
      (gear.accATK * 30) +
      (gear.accSPD * 180);
    const playerRankPower = rankBp(acc.playerLevel);
    const flatBonusPower = n(profile.bonus ?? 0);
    const power = roundInt(characterPower + masteryPower + equipmentPower + flatBonusPower);
    const battalionPower = roundInt(power + playerRankPower);
    const explicitRef = !!(profileRefStat(profile, ["refHP", "refHp", "refStatHP", "anchorHp"]) && profileRefStat(profile, ["refATK", "refAtk", "refStatATK", "anchorAtk"]));
    const hasSeedRef = !!(seed && (seed.baseMaxHp || seed.baseAttack));

    return {
      seed,
      stateIndex: stateInfo ? stateInfo.index : undefined,
      stateLabel: stateInfo ? stateInfo.label : "",
      stateSourceId: stateInfo ? (stateInfo.dataSourceId || stateInfo.sourceId) : (seed && seed.sourceId),
      level,
      limitBreakTier: limitBreakTier(level).tier,
      limitBreakMultiplier: lb,
      awakening: awkIndex,
      awakeningMultiplier: awk,
      potential: clamp(profile.potential ?? 0, 0, 100),
      boost: clamp(profile.boost ?? 0, 0, 300),
      mastery,
      ascended,
      refHp,
      refAtk,
      anchorHp: refHp,
      anchorAtk: refAtk,
      rawHp,
      rawAtk,
      baseStackHp,
      baseStackAtk,
      masteryTrackHp,
      masteryTrackAtk,
      hp,
      atk,
      cardHP: hp,
      cardATK: atk,
      blueHp,
      blueAtk,
      equipmentHp,
      equipmentAtk,
      spd,
      cost,
      gear,
      characterPower,
      masteryPower,
      equipmentPower,
      playerRankPower,
      flatBonusPower,
      power,
      battalionPower,
      isEstimated: !hasSeedRef && !explicitRef,
      source: explicitRef ? "profile-refstat200" : hasSeedRef ? "apk-refstat200" : "fallback-estimate"
    };
  }

  function calculateUnitStates(unit, profile = {}, account = {}) {
    const stateInfo = selectedStateInfo(unit, profile);
    return stateInfo.states.map(row => calculateFromSeed(unit, row.seed, { ...profile, stateIndex: row.index }, account, row));
  }

  function calculateUnit(unit, profile = {}, account = {}) {
    const stateInfo = selectedStateInfo(unit, profile);
    const seed = (stateInfo.selected && stateInfo.selected.seed) || findSeed(unit, profile);
    const result = calculateFromSeed(unit, seed, profile, account, stateInfo.selected);
    result.states = stateInfo.states.map(row => calculateFromSeed(unit, row.seed, { ...profile, stateIndex: row.index }, account, row));
    return result;
  }

  global.EvertaleRuntimeStatEngine = {
    installSeedIndex,
    loadSeedIndex,
    findSeed,
    listUnitStates,
    calculateUnit,
    calculateUnitStates,
    limitBreakTier,
    limitBreakMultiplier,
    boostFlat,
    rankBp,
    smartAscended,
    constants: { AWAKENING, LB_TIERS }
  };
})(window);
