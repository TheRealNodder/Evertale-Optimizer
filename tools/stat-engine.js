/**
 * Evertale Master Stat Engine
 * Source of truth: Evertale_Ultimate_Master_Engine_Specification.pdf
 */
export const AWAKENING_MULTIPLIERS = [1.00, 1.22, 1.44, 1.66, 1.88];

export function limitBreakMultiplier(level) {
  if (level > 180) return 1.40;
  if (level > 160) return 1.32;
  if (level > 140) return 1.24;
  if (level > 120) return 1.16;
  if (level > 100) return 1.08;
  return 1.00;
}

export function boostFlat(boost) {
  if (boost <= 90) return { hp: boost * 14, atk: boost * 3 };
  return { hp: 1260 + ((boost - 90) * 311), atk: 270 + ((boost - 90) * 73) };
}

export function accountRankBP(rank) {
  const safeRank = Math.max(0, Math.min(300, Number(rank) || 0));
  return (2000000 / 27000000) * Math.pow(safeRank, 3);
}

export function calculateMasterUnitEngine(config) {
  const {
    level,
    copies,
    boost,
    potential,
    mastery,
    refHP,
    refATK,
    isAscended,
    gear = {},
    flatFellowshipHP = 4900,
    flatFellowshipATK = 750,
    includeRank = false,
    playerRank = 0
  } = config;

  const lbMul = limitBreakMultiplier(level);
  const rawHP = (refHP / 294.0) * (level + 10) * lbMul;
  const rawATK = (refATK / 294.0) * (level + 10) * lbMul;
  const boostStats = boostFlat(boost);

  const baseStackHP = rawHP + boostStats.hp + flatFellowshipHP;
  const baseStackATK = rawATK + boostStats.atk + flatFellowshipATK;
  const potentialScalar = 1 + (potential / 100.0);

  const anchorHP = baseStackHP * potentialScalar;
  const anchorATK = baseStackATK * potentialScalar;
  const anchorBasePower = (anchorHP * 12) + (anchorATK * 60);
  const masteryPower = anchorBasePower * 0.0025 * mastery;

  const awakeningMultiplier = AWAKENING_MULTIPLIERS[copies] || 1.00;
  const ascensionHP = isAscended ? (refHP * 0.05) : 0;
  const ascensionATK = isAscended ? (refATK * 0.05) : 0;
  const cardHP = Math.round(baseStackHP * awakeningMultiplier * potentialScalar) + ascensionHP;
  const cardATK = Math.round(baseStackATK * awakeningMultiplier * potentialScalar) + ascensionATK;
  const characterPower = (cardHP * 12) + (cardATK * 60);

  const equipmentPower =
    (Number(gear.wepHP) || 0) * 6 +
    (Number(gear.wepATK) || 0) * 30 +
    (Number(gear.accHP) || 0) * 6 +
    (Number(gear.accATK) || 0) * 30 +
    (Number(gear.accSPD) || 0) * 180;

  const unitPower = Math.round(characterPower + masteryPower + equipmentPower);
  const accountRankPower = includeRank ? Math.round(accountRankBP(playerRank)) : 0;

  return {
    cardHP,
    cardATK,
    unitPower,
    battalionPower: unitPower + accountRankPower,
    accountRankPower,
    equipmentPower,
    masteryPower,
    characterPower
  };
}


/**
 * Solve the hidden RefStat200 anchor from an observed in-game card stat.
 * Monster.json baseMaxHp/baseAttack are APK raw stats, not guaranteed RefStat200.
 */
export function solveRefStat200FromObserved({
  observed,
  stat = 'hp',
  level,
  copies,
  boost,
  potential,
  mastery = 0,
  isAscended = false,
  flatFellowshipHP = 4900,
  flatFellowshipATK = 750
}) {
  const isHP = stat === 'hp';
  let lo = 0;
  let hi = 500000;

  for (let i = 0; i < 90; i += 1) {
    const mid = (lo + hi) / 2;
    const result = calculateMasterUnitEngine({
      level,
      copies,
      boost,
      potential,
      mastery,
      refHP: isHP ? mid : 0,
      refATK: isHP ? 0 : mid,
      isAscended,
      flatFellowshipHP,
      flatFellowshipATK,
      gear: {}
    });
    const value = isHP ? result.cardHP : result.cardATK;
    if (value < observed) lo = mid;
    else hi = mid;
  }

  return (lo + hi) / 2;
}
