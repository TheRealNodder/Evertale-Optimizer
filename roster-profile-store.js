/* roster-profile-store.js
   Local-only roster profile storage + lightweight stat estimator.

   Raw apkfiles/entries are never mutated. Everything saves to localStorage and can be exported/imported.
*/
(function (global) {
  "use strict";

  const PROFILE_KEY = "evertale_roster_profiles_v1";
  const ACCOUNT_DEFAULTS = {
    playerLevel: 300,
    fellowshipEnabled: true,
    fellowshipHp: 4900,
    fellowshipAtk: 750
  };

  const AWAKENING = [1.00, 1.22, 1.44, 1.66, 1.88];

  function safeParse(raw, fallback) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function nowIso() { return new Date().toISOString(); }

  function clamp(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.min(max, Math.max(min, x));
  }

  function normId(v) { return v == null ? "" : String(v); }

  function defaultProfile() {
    return {
      level: 1,
      awakening: 0,
      ascended: false,
      potential: 0,
      boost: 0,
      mastery: 0,
      bonus: 0,
      updatedAt: nowIso()
    };
  }

  function loadState() {
    const parsed = safeParse(localStorage.getItem(PROFILE_KEY), null);
    if (!parsed || typeof parsed !== "object") {
      return { version: 1, account: { ...ACCOUNT_DEFAULTS }, profiles: {} };
    }
    return {
      version: 1,
      account: { ...ACCOUNT_DEFAULTS, ...(parsed.account || {}) },
      profiles: parsed.profiles && typeof parsed.profiles === "object" ? parsed.profiles : {}
    };
  }

  function saveState(state) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({
      version: 1,
      account: { ...ACCOUNT_DEFAULTS, ...(state.account || {}) },
      profiles: state.profiles || {}
    }));
    window.dispatchEvent(new CustomEvent("evertaleRosterProfilesChanged"));
  }

  function getAccount() {
    return loadState().account;
  }

  function saveAccount(patch) {
    const s = loadState();
    s.account = { ...ACCOUNT_DEFAULTS, ...(s.account || {}), ...(patch || {}) };
    s.account.playerLevel = Math.round(clamp(s.account.playerLevel, 1, 300));
    s.account.fellowshipHp = Math.round(clamp(s.account.fellowshipHp, 0, 999999));
    s.account.fellowshipAtk = Math.round(clamp(s.account.fellowshipAtk, 0, 999999));
    s.account.fellowshipEnabled = !!s.account.fellowshipEnabled;
    saveState(s);
    return s.account;
  }

  function getProfile(id) {
    const s = loadState();
    return { ...defaultProfile(), ...(s.profiles[normId(id)] || {}) };
  }

  function smartAscended(profile) {
    const p = { ...defaultProfile(), ...(profile || {}) };
    return !!p.ascended || (Number(p.level) > 100 && Number(p.awakening) >= 4);
  }

  function saveProfile(id, patch) {
    const unitId = normId(id);
    if (!unitId) return null;
    const s = loadState();
    const prev = { ...defaultProfile(), ...(s.profiles[unitId] || {}) };
    const next = { ...prev, ...(patch || {}) };

    next.level = Math.round(clamp(next.level, 1, 200));
    next.awakening = Math.round(clamp(next.awakening, 0, 4));
    next.potential = clamp(next.potential, 0, 100);
    next.boost = Math.round(clamp(next.boost, 0, 300));
    next.mastery = Math.round(clamp(next.mastery, 0, 40));
    next.bonus = Math.round(clamp(next.bonus, 0, 9999999));
    next.ascended = !!next.ascended || (next.level > 100 && next.awakening >= 4);
    next.updatedAt = nowIso();

    s.profiles[unitId] = next;
    saveState(s);
    return next;
  }

  function deleteProfile(id) {
    const s = loadState();
    delete s.profiles[normId(id)];
    saveState(s);
  }

  function boostFlat(boost) {
    const b = clamp(boost, 0, 300);
    if (b <= 90) return { hp: b * 14, atk: b * 3 };
    return {
      hp: 1260 + ((b - 90) * 311),
      atk: 270 + ((b - 90) * 73)
    };
  }

  function limitBreakMultiplier(level) {
    const lvl = clamp(level, 1, 200);
    if (lvl <= 100) return 1.00;
    if (lvl <= 120) return 1.08;
    if (lvl <= 140) return 1.16;
    if (lvl <= 160) return 1.24;
    if (lvl <= 180) return 1.32;
    return 1.40;
  }

  function rankBp(rank) {
    const r = clamp(rank, 0, 300);
    return Math.round((2000000 / 27000000) * Math.pow(r, 3));
  }

  function baseNumber(unit, key) {
    const stats = unit && unit.stats ? unit.stats : {};
    const value = stats[key] ?? unit?.[key] ?? 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function estimateUnitStats(unit, profileOverride) {
    const id = normId(unit && unit.id);
    const account = getAccount();
    const profile = { ...getProfile(id), ...(profileOverride || {}) };

    const level = clamp(profile.level, 1, 200);
    const lb = limitBreakMultiplier(level);
    const awk = AWAKENING[Math.round(clamp(profile.awakening, 0, 4))] || 1;
    const pot = 1 + (clamp(profile.potential, 0, 100) / 100);
    const flat = boostFlat(profile.boost);
    const fellowshipHp = account.fellowshipEnabled ? Number(account.fellowshipHp || 0) : 0;
    const fellowshipAtk = account.fellowshipEnabled ? Number(account.fellowshipAtk || 0) : 0;

    // Fallback approximation until a calibrated anchor exists.
    // This intentionally favors stable optimizer ranking over pretending exact level math is solved.
    const seedHp = Number(profile.anchorHp ?? baseNumber(unit, "hp"));
    const seedAtk = Number(profile.anchorAtk ?? baseNumber(unit, "atk"));
    const spd = baseNumber(unit, "spd");
    const levelScalar = ((level + 10) / 294) * lb;
    const ascended = smartAscended(profile);

    const ascHp = ascended ? seedHp * 0.05 : 0;
    const ascAtk = ascended ? seedAtk * 0.05 : 0;

    const hp = Math.round(((seedHp * levelScalar) + flat.hp + fellowshipHp) * awk * pot + ascHp);
    const atk = Math.round(((seedAtk * levelScalar) + flat.atk + fellowshipAtk) * awk * pot + ascAtk);

    const characterPower = (hp * 12) + (atk * 60);
    const masteryAnchorHp = ((seedHp * levelScalar) + flat.hp + fellowshipHp) * pot;
    const masteryAnchorAtk = ((seedAtk * levelScalar) + flat.atk + fellowshipAtk) * pot;
    const masteryPower = ((masteryAnchorHp * 12) + (masteryAnchorAtk * 60)) * 0.0025 * clamp(profile.mastery, 0, 40);
    const totalPower = Math.round(characterPower + masteryPower + rankBp(account.playerLevel) + Number(profile.bonus || 0));

    return {
      atk,
      hp,
      spd,
      cost: baseNumber(unit, "cost") || 1,
      power: totalPower,
      level,
      awakening: profile.awakening,
      ascended,
      potential: profile.potential,
      boost: profile.boost,
      mastery: profile.mastery,
      isEstimated: !(profile.anchorHp && profile.anchorAtk)
    };
  }

  function applyToUnit(unit) {
    if (!unit) return unit;
    const estimated = estimateUnitStats(unit);
    return {
      ...unit,
      stats: {
        ...(unit.stats || {}),
        atk: estimated.atk,
        hp: estimated.hp,
        spd: estimated.spd,
        cost: estimated.cost,
        power: estimated.power
      },
      atk: estimated.atk,
      hp: estimated.hp,
      spd: estimated.spd,
      __rosterProfile: getProfile(unit.id),
      __rosterEstimated: estimated
    };
  }

  function exportText() {
    return JSON.stringify(loadState(), null, 2);
  }

  function importText(text) {
    const parsed = safeParse(text, null);
    if (!parsed || typeof parsed !== "object") throw new Error("Import file is not valid roster profile JSON.");
    const next = {
      version: 1,
      account: { ...ACCOUNT_DEFAULTS, ...(parsed.account || {}) },
      profiles: parsed.profiles && typeof parsed.profiles === "object" ? parsed.profiles : {}
    };
    saveState(next);
    return next;
  }

  global.EvertaleRosterProfiles = {
    key: PROFILE_KEY,
    loadState,
    saveState,
    getAccount,
    saveAccount,
    getProfile,
    saveProfile,
    deleteProfile,
    smartAscended,
    estimateUnitStats,
    applyToUnit,
    exportText,
    importText,
    limitBreakMultiplier,
    boostFlat,
    rankBp
  };
})(window);
