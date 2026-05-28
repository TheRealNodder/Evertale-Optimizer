/* runtime-stat-engine.js
   Central runtime-style stat estimator.

   Why this exists:
   The decompiled runtime confirmed Evertale uses MonsterInstance / WeaponInstance /
   EquipmentInstance state objects, cached stats, training state, and limit-break helpers.
   This file mirrors that architecture for the website without mutating apkfiles/entries.

   It is intentionally conservative:
   - exact visible formulas still depend on hidden runtime/native details
   - calibrated anchors win when present
   - otherwise APK seed stats are converted through a documented approximation
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

  function findSeed(unit) {
    if (!unit) return null;

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
    const r = clamp(playerLevel, 1, 300);
    return (2000000 / 27000000) * Math.pow(r, 3);
  }

  function smartAscended(profile) {
    const level = n(profile && profile.level);
    const awakening = n(profile && profile.awakening);
    if (profile && profile.ascended === true) return true;
    return level > 100 && awakening >= 4;
  }

  function defaultAnchorFromSeed(seed, statName, profile) {
    // Calibrated anchors are stored as profile.anchorHp/profile.anchorAtk.
    // If missing, use APK seed as a stable input. The exact hidden transform is
    // still being mined from runtime/native code, so this is marked estimated.
    if (statName === "hp") return n(profile && profile.anchorHp, n(seed && seed.baseMaxHp));
    return n(profile && profile.anchorAtk, n(seed && seed.baseAttack));
  }

  function calculateUnit(unit, profile = {}, account = {}) {
    const seed = findSeed(unit);
    const acc = { ...DEFAULTS, ...(account || {}) };
    const level = clamp(profile.level ?? 1, 1, 200);
    const lb = limitBreakMultiplier(level);
    const awkIndex = Math.round(clamp(profile.awakening ?? 0, 0, 4));
    const awk = AWAKENING[awkIndex] || 1;
    const pot = 1 + (clamp(profile.potential ?? 0, 0, 100) / 100);
    const boost = boostFlat(profile.boost ?? profile.bonus ?? 0);
    const mastery = clamp(profile.mastery ?? 0, 0, 40);
    const fellowshipHp = acc.fellowshipEnabled ? n(acc.fellowshipHp) : 0;
    const fellowshipAtk = acc.fellowshipEnabled ? n(acc.fellowshipAtk) : 0;
    const ascended = smartAscended({ ...profile, level, awakening: awkIndex });

    const anchorHp = defaultAnchorFromSeed(seed, "hp", profile);
    const anchorAtk = defaultAnchorFromSeed(seed, "atk", profile);

    const levelScalar = ((level + 10) / 294) * lb;
    const rawHp = anchorHp * levelScalar;
    const rawAtk = anchorAtk * levelScalar;

    const baseStackHp = rawHp + boost.hp + fellowshipHp;
    const baseStackAtk = rawAtk + boost.atk + fellowshipAtk;

    // Mastery track: potential yes, awakening no.
    const anchorTrackHp = baseStackHp * pot;
    const anchorTrackAtk = baseStackAtk * pot;
    const anchorPower = (anchorTrackHp * 12) + (anchorTrackAtk * 60);
    const masteryPower = anchorPower * 0.0025 * mastery;

    // Card track: awakening + potential, rounded before BP conversion.
    const ascHp = ascended ? anchorHp * 0.05 : 0;
    const ascAtk = ascended ? anchorAtk * 0.05 : 0;
    const hp = roundInt(baseStackHp * awk * pot + ascHp);
    const atk = roundInt(baseStackAtk * awk * pot + ascAtk);

    const spd = n(seed && seed.speed, n(unit && (unit.spd ?? unit.stats?.spd)));
    const cost = n(seed && seed.cost, n(unit && (unit.cost ?? unit.stats?.cost), 1));

    const characterPower = (hp * 12) + (atk * 60);
    const playerRankPower = rankBp(acc.playerLevel);
    const flatBonusPower = n(profile.bonus ?? 0);
    const power = roundInt(characterPower + masteryPower + flatBonusPower + playerRankPower);

    return {
      seed,
      level,
      limitBreakTier: limitBreakTier(level).tier,
      limitBreakMultiplier: lb,
      awakening: awkIndex,
      awakeningMultiplier: awk,
      potential: clamp(profile.potential ?? 0, 0, 100),
      boost: clamp(profile.boost ?? 0, 0, 300),
      mastery,
      ascended,
      anchorHp,
      anchorAtk,
      rawHp,
      rawAtk,
      baseStackHp,
      baseStackAtk,
      hp,
      atk,
      spd,
      cost,
      characterPower,
      masteryPower,
      playerRankPower,
      power,
      isEstimated: !(profile.anchorHp && profile.anchorAtk),
      source: (profile.anchorHp && profile.anchorAtk) ? "calibrated-anchor" : "apk-seed-runtime-estimate"
    };
  }

  global.EvertaleRuntimeStatEngine = {
    installSeedIndex,
    loadSeedIndex,
    findSeed,
    calculateUnit,
    limitBreakTier,
    limitBreakMultiplier,
    boostFlat,
    rankBp,
    smartAscended,
    constants: { AWAKENING, LB_TIERS }
  };
})(window);
