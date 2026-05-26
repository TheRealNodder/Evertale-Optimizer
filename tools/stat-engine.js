/**
 * Evertale Stat Engine
 *
 * Key model:
 * - White HP/ATK = character-only stats shown in-game. Note: the game card visually lists ATK first, then HP.
 * - Blue HP/ATK = white stats + locked weapon/accessory stats.
 * - APK raw stats are NOT treated as RefStat200 automatically.
 * - RefStat200 can be reversed from observed white stats.
 */

export const AWAKENING_MULTIPLIERS = [1.00, 1.22, 1.44, 1.66, 1.88];

export function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function limitBreakState(level) {
  const lvl = clampNumber(level, 1, 200);
  if (lvl <= 80) return { state: "Normal", tier: 0, multiplier: 1.00 };
  if (lvl <= 100) return { state: "Limit Break 1", tier: 1, multiplier: 1.00 };
  if (lvl <= 120) return { state: "Limit Break 2", tier: 2, multiplier: 1.08 };
  if (lvl <= 140) return { state: "Limit Break 3", tier: 3, multiplier: 1.16 };
  if (lvl <= 160) return { state: "Limit Break 4", tier: 4, multiplier: 1.24 };
  if (lvl <= 180) return { state: "Limit Break 5", tier: 5, multiplier: 1.32 };
  return { state: "Limit Break 6", tier: 6, multiplier: 1.40 };
}

export function limitBreakMultiplier(level) {
  return limitBreakState(level).multiplier;
}

export function boostFlat(boost) {
  const b = clampNumber(boost, 0, 300);
  if (b <= 90) return { hp: b * 14, atk: b * 3 };
  return {
    hp: 1260 + ((b - 90) * 311),
    atk: 270 + ((b - 90) * 73)
  };
}

export function accountRankBP(rank) {
  const safeRank = clampNumber(rank, 0, 300);
  return (2000000 / 27000000) * Math.pow(safeRank, 3);
}

/**
 * Reverse the hidden RefStat200 from an observed in-game white stat.
 * Use white text only, never blue equipment-modified text.
 */
export function projectWhiteStatFromRef({
  refStat200,
  level,
  copies = 0,
  potential = 0,
  boostFlatValue = 0,
  fellowshipFlat = 0,
  isAscended = false
}) {
  const ref = Math.max(0, Number(refStat200) || 0);
  const lvl = clampNumber(level, 1, 200);
  const awk = AWAKENING_MULTIPLIERS[clampNumber(copies, 0, 4)] || 1.00;
  const potentialScalar = 1 + (clampNumber(potential, 0, 100) / 100);
  const lb = limitBreakMultiplier(lvl);
  const raw = (ref / 294.0) * (lvl + 10) * lb;
  const baseStack = raw + Number(boostFlatValue || 0) + Number(fellowshipFlat || 0);

  // Engine checkpoint: visible card stat is rounded before BP conversion.
  // Ascension is a flat 5% RefStat200 premium compiled after percentage scaling.
  return Math.round(baseStack * awk * potentialScalar) + Math.round(isAscended ? ref * 0.05 : 0);
}

/**
 * Reverse the hidden RefStat200 from an observed in-game WHITE stat.
 * Use white text only, never blue equipment-modified text.
 *
 * This intentionally uses the same checkpoint rounding as the forward engine.
 * The algebraic value is used only as a seed; the returned value is refined
 * by monotonic binary search so it reproduces the observed integer stat.
 */
export function reverseRefStat200({
  observedWhiteStat,
  level,
  copies = 0,
  potential = 0,
  boostFlatValue = 0,
  fellowshipFlat = 0,
  isAscended = false
}) {
  const observed = Math.max(0, Number(observedWhiteStat) || 0);
  if (!observed) return 0;

  const lvl = clampNumber(level, 1, 200);
  const awk = AWAKENING_MULTIPLIERS[clampNumber(copies, 0, 4)] || 1.00;
  const potentialScalar = 1 + (clampNumber(potential, 0, 100) / 100);
  const lb = limitBreakMultiplier(lvl);
  const ascensionRate = isAscended ? 0.05 : 0;

  const nonRefContribution = (Number(boostFlatValue || 0) + Number(fellowshipFlat || 0)) * awk * potentialScalar;
  const refCoefficient = (((lvl + 10) / 294.0) * lb * awk * potentialScalar) + ascensionRate;
  const seed = refCoefficient ? Math.max(0, (observed - nonRefContribution) / refCoefficient) : 0;

  let lo = 0;
  let hi = Math.max(seed * 2, observed * 2, 1000);
  const forward = ref => projectWhiteStatFromRef({
    refStat200: ref,
    level: lvl,
    copies,
    potential,
    boostFlatValue,
    fellowshipFlat,
    isAscended
  });

  while (forward(hi) < observed) hi *= 2;

  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (forward(mid) >= observed) hi = mid;
    else lo = mid;
  }

  return hi;
}

export function calculateMasterUnitEngine(config) {
  const level = clampNumber(config.level, 1, 200);
  const copies = clampNumber(config.copies, 0, 4);
  const boost = clampNumber(config.boost, 0, 300);
  const potential = clampNumber(config.potential, 0, 100);
  const mastery = Math.max(0, Number(config.mastery) || 0);
  const refHP = Math.max(0, Number(config.refHP) || 0);
  const refATK = Math.max(0, Number(config.refATK) || 0);
  const flatFellowshipHP = Number(config.flatFellowshipHP ?? 4900);
  const flatFellowshipATK = Number(config.flatFellowshipATK ?? 750);
  const gear = Object.assign({ wepHP: 0, wepATK: 0, accHP: 0, accATK: 0, accSPD: 0 }, config.gear || {});

  const lb = limitBreakState(level);
  const rawHP = (refHP / 294.0) * (level + 10) * lb.multiplier;
  const rawATK = (refATK / 294.0) * (level + 10) * lb.multiplier;
  const boostStats = boostFlat(boost);
  const baseStackHP = rawHP + boostStats.hp + flatFellowshipHP;
  const baseStackATK = rawATK + boostStats.atk + flatFellowshipATK;
  const potentialScalar = 1 + (potential / 100.0);

  // Track A: unawakened anchor timeline for mastery.
  const anchorHP = baseStackHP * potentialScalar;
  const anchorATK = baseStackATK * potentialScalar;
  const anchorBasePower = (anchorHP * 12) + (anchorATK * 60);
  const masteryPower = anchorBasePower * 0.0025 * mastery;

  // Track B: awakened white card stats.
  const awakeningMultiplier = AWAKENING_MULTIPLIERS[copies] || 1.00;
  const ascensionHP = config.isAscended ? (refHP * 0.05) : 0;
  const ascensionATK = config.isAscended ? (refATK * 0.05) : 0;
  const whiteHP = Math.round(baseStackHP * awakeningMultiplier * potentialScalar) + Math.round(ascensionHP);
  const whiteATK = Math.round(baseStackATK * awakeningMultiplier * potentialScalar) + Math.round(ascensionATK);

  // Blue equipped stats shown in-game after locked platoon equipment.
  const equipmentHP = (Number(gear.wepHP) || 0) + (Number(gear.accHP) || 0);
  const equipmentATK = (Number(gear.wepATK) || 0) + (Number(gear.accATK) || 0);
  const blueHP = whiteHP + equipmentHP;
  const blueATK = whiteATK + equipmentATK;

  const characterPower = (whiteHP * 12) + (whiteATK * 60);
  const equipmentPower =
    (Number(gear.wepHP) || 0) * 6 +
    (Number(gear.wepATK) || 0) * 30 +
    (Number(gear.accHP) || 0) * 6 +
    (Number(gear.accATK) || 0) * 30 +
    (Number(gear.accSPD) || 0) * 180;

  const lockedPlatoonOffset = Number(config.lockedPlatoonOffset) || 0;
  const unitPower = Math.round(characterPower + masteryPower + equipmentPower + lockedPlatoonOffset);
  const accountRankPower = config.includeRank ? Math.round(accountRankBP(config.playerRank)) : 0;

  return {
    whiteHP,
    whiteATK,
    cardHP: whiteHP,
    cardATK: whiteATK,
    blueHP,
    blueATK,
    equipmentHP,
    equipmentATK,
    unitPower,
    battalionPower: unitPower + accountRankPower,
    accountRankPower,
    equipmentPower,
    masteryPower,
    characterPower,
    trace: {
      level, copies, boost, potential, mastery, refHP, refATK,
      limitBreak: lb,
      rawHP, rawATK, boostStats, baseStackHP, baseStackATK,
      anchorHP, anchorATK, anchorBasePower, masteryPower,
      awakeningMultiplier, ascensionHP, ascensionATK,
      whiteHP, whiteATK, blueHP, blueATK,
      equipmentHP, equipmentATK, equipmentPower, characterPower,
      lockedPlatoonOffset
    }
  };
}
