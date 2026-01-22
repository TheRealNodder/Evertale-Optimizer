/* =========================================================
   optimizerEngine.js — Evertale Optimizer Engine (Doctrine)
   =========================================================
   - Pure logic engine (no UI)
   - Never mutates characters.json objects
   - Deterministic tie-breaking
   - Implements OPTIMIZER_DOCTRINE decisions from chat
   --------------------------------------------------------- */

(function (global) {
  "use strict";

  let DOCTRINE = (global.OPTIMIZER_DOCTRINE && global.OPTIMIZER_DOCTRINE.OPTIMIZER_DOCTRINE)
    ? global.OPTIMIZER_DOCTRINE.OPTIMIZER_DOCTRINE
    : global.OPTIMIZER_DOCTRINE;

  function deepMerge(dst, src) {
    if (!src || typeof src !== "object") return dst;
    for (const k of Object.keys(src)) {
      const sv = src[k];
      const dv = dst[k];
      if (Array.isArray(sv)) {
        dst[k] = sv.slice();
      } else if (sv && typeof sv === "object") {
        dst[k] = deepMerge(dv && typeof dv === "object" ? Object.assign({}, dv) : {}, sv);
      } else {
        dst[k] = sv;
      }
    }
    return dst;
  }

  function resolveDoctrine(overrides) {
    const base = (global.OPTIMIZER_DOCTRINE && global.OPTIMIZER_DOCTRINE.OPTIMIZER_DOCTRINE)
      ? global.OPTIMIZER_DOCTRINE.OPTIMIZER_DOCTRINE
      : global.OPTIMIZER_DOCTRINE;

    const merged = base && typeof base === "object" ? Object.assign({}, base) : {};
    if (overrides && typeof overrides === "object") deepMerge(merged, overrides);
    return merged;
  }


  if (!DOCTRINE) {
    console.error("[OptimizerEngine] OPTIMIZER_DOCTRINE not found on window.");
  }

  const EPS = 1e-9;

  /* ---------- helpers ---------- */
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  function stableId(u) {
    const id = u && (u.id ?? u.unitId ?? u._id ?? u.key);
    return typeof id === "string" ? id : String(id ?? "");
  }

  function safeLower(s) { return (s == null) ? "" : String(s).toLowerCase(); }

  function getFirstNumber(...vals) {
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  function pickNumberFromObject(obj, keys) {
    if (!obj || typeof obj !== "object") return 0;
    for (const k of keys) {
      if (obj[k] != null && Number.isFinite(Number(obj[k]))) return Number(obj[k]);
    }
    return 0;
  }

  function inferElement(unit) {
    const e = safeLower(unit.element ?? unit.elem ?? unit.attribute ?? unit.affinity ?? "");
    const allowed = new Set(DOCTRINE.leaderSkill.parsing.detectElements.concat(["unknown"]));
    if (allowed.has(e)) return e;
    // sometimes elements like "wind" -> storm
    if (e === "wind" || e === "thunder" || e === "lightning") return "storm";
    return "unknown";
  }

  function normalizeLeaderSkill(unit) {
    const fallback = DOCTRINE.dataAuthority.missingLeaderFallback;
    const ls = unit.leaderSkill ?? unit.leader_skill ?? unit.leader ?? unit.leaderAbility ?? unit.leader_ability ?? null;
    const name = (ls && (ls.name ?? ls.title)) ? String(ls.name ?? ls.title) : (unit.leaderSkillName ? String(unit.leaderSkillName) : "");
    const description = (ls && (ls.description ?? ls.desc ?? ls.text)) ? String(ls.description ?? ls.desc ?? ls.text) : (unit.leaderSkillDescription ? String(unit.leaderSkillDescription) : "");
    const hasAny = (name && name.trim()) || (description && description.trim());
    return {
      name: hasAny ? (name || fallback.name) : fallback.name,
      description: hasAny ? (description || fallback.description) : fallback.description
    };
  }

  function extractPercentMax(text) {
    if (!DOCTRINE.leaderSkill.parsing.detectPercents) return 0;
    const s = safeLower(text);
    const re = /(\d+(?:\.\d+)?)\s*%/g;
    let m;
    let best = 0;
    while ((m = re.exec(s)) !== null) {
      const v = Number(m[1]);
      if (Number.isFinite(v) && v > best) best = v;
    }
    return best;
  }

  function detectElementsMentioned(text) {
    const s = safeLower(text);
    const els = DOCTRINE.leaderSkill.parsing.detectElements;
    const out = new Set();
    for (const e of els) {
      // word boundary-ish match
      const re = new RegExp(`\\b${e}\\b`, "i");
      if (re.test(s)) out.add(e);
    }
    return out;
  }

  function detectGenericAllies(text) {
    const s = safeLower(text);
    // conservative generic detection
    return /all (allies|ally|units|teammates|friends)|all party|entire team|all team/i.test(s);
  }

  function tagsFromKeywords(text) {
    const s = safeLower(text);
    const map = DOCTRINE.leaderSkill.parsing.keywordsToTag;
    const tags = new Set();
    for (const [tag, kws] of Object.entries(map)) {
      for (const kw of kws) {
        if (!kw) continue;
        if (s.includes(String(kw).toLowerCase())) {
          tags.add(tag);
          break;
        }
      }
    }
    return tags;
  }

  function coerceTagSet(unit) {
    const tags = new Set();
    const raw = unit.tags ?? unit.tag ?? unit.labels ?? unit.traits ?? null;
    if (Array.isArray(raw)) {
      for (const t of raw) if (t != null && String(t).trim()) tags.add(String(t).toLowerCase());
    } else if (typeof raw === "string") {
      // comma/space separated
      raw.split(/[,\n]/g).forEach(t => {
        const v = String(t).trim().toLowerCase();
        if (v) tags.add(v);
      });
    }
    return tags;
  }

  function roleScoresFromTags(tagSet) {
    const w = DOCTRINE.statusWeights;
    let dpsRaw = 0, sustainRaw = 0, controlRaw = 0;

    function has(tag) { return tagSet.has(tag); }

    // Control tags
    if (has("sleep")) controlRaw += w.sleep;
    if (has("stun")) controlRaw += w.stun;
    if (has("turn")) { controlRaw += 4; dpsRaw += 4; } // tempo is both
    if (has("poison")) { controlRaw += w.poison; dpsRaw += 3; }
    if (has("burn")) { controlRaw += w.burn; dpsRaw += 3; }

    // Sustain tags
    if (has("heal")) sustainRaw += w.heal;
    if (has("cleanse")) sustainRaw += w.cleanse;
    if (has("hpbuff")) sustainRaw += w.hpBuff;

    // DPS tags
    if (has("atkbuff")) dpsRaw += w.atkBuff;

    function norm(x) { return 1 - Math.exp(-x / 6); }
    const dpsNorm = norm(dpsRaw);
    const sustainNorm = norm(sustainRaw);
    const controlNorm = norm(controlRaw);

    return {
      dpsRaw, sustainRaw, controlRaw,
      dpsNorm, sustainNorm, controlNorm,
      countsAsDps: dpsNorm >= 0.45,
      countsAsSustain: sustainNorm >= 0.45,
      countsAsControl: controlNorm >= 0.45
    };
  }

  function sum(arr, fn) {
    let s = 0;
    for (const x of arr) s += fn ? fn(x) : x;
    return s;
  }

  function lexCompare(a, b) {
    return String(a).localeCompare(String(b));
  }

  function sortStableBy(arr, cmp) {
    return arr
      .map((v, i) => ({ v, i }))
      .sort((a, b) => {
        const c = cmp(a.v, b.v);
        return c !== 0 ? c : (a.i - b.i);
      })
      .map(x => x.v);
  }

  /* ---------- stat extraction ---------- */
  function extractStats(unit) {
    // Try common shapes without assuming schema
    const statsObj = unit.stats ?? unit.baseStats ?? unit.base_stats ?? unit.parameters ?? unit.param ?? null;

    const atk = getFirstNumber(
      unit.atk, unit.attack, unit.ATK,
      pickNumberFromObject(statsObj, ["atk", "attack", "ATK"])
    );

    const spd = getFirstNumber(
      unit.spd, unit.speed, unit.SPD,
      pickNumberFromObject(statsObj, ["spd", "speed", "SPD"])
    );

    const hp = getFirstNumber(
      unit.hp, unit.HP, unit.health,
      pickNumberFromObject(statsObj, ["hp", "HP", "health"])
    );

    const cost = getFirstNumber(
      unit.cost, unit.teamCost, unit.team_cost, unit.unitCost,
      pickNumberFromObject(unit, ["cost", "teamCost", "team_cost", "unitCost"])
    );

    return { atk, spd, hp, cost: cost > 0 ? cost : 1 };
  }

  /* ---------- normalization ---------- */
  function computeMinMax(units, getter) {
    let mn = Infinity, mx = -Infinity;
    for (const u of units) {
      const v = getter(u);
      if (!Number.isFinite(v)) continue;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (!Number.isFinite(mn)) mn = 0;
    if (!Number.isFinite(mx)) mx = 0;
    return { mn, mx };
  }

  function norm01(x, mn, mx) {
    const d = (mx - mn);
    return d < EPS ? 0 : (x - mn) / (d + EPS);
  }

  /* ---------- UnitView builder ---------- */
  function buildUnitViews(units) {
    const views = [];

    for (const u of units) {
      const id = stableId(u);
      if (!id) continue;

      const element = inferElement(u);
      const stats = extractStats(u);
      const leader = normalizeLeaderSkill(u);
      const leaderText = `${leader.name} ${leader.description}`;

      const elementsMentioned = detectElementsMentioned(leaderText);
      const parsedPercentMax = extractPercentMax(leaderText);
      const keywordTags = tagsFromKeywords(leaderText);
      const isGenericAllies = detectGenericAllies(leaderText);

      const tagSet = coerceTagSet(u);
      // merge tags from leader parsing; note doctrine tags are camelCase in JSON but we store lowercase for internal
      for (const t of keywordTags) tagSet.add(String(t).toLowerCase());

      // Normalize certain external tags to internal canonical tag keys if they exist
      // (optional, but improves compatibility with external datasets)
      const alias = {
        "atk_buff": "atkbuff", "atk buff": "atkbuff", "attackbuff": "atkbuff",
        "hp_buff": "hpbuff", "hp buff": "hpbuff",
      };
      for (const [k, v] of Object.entries(alias)) {
        if (tagSet.has(k)) { tagSet.delete(k); tagSet.add(v); }
      }

      // Canonicalize doctrine tag keys to lowercase stable forms
      // doctrine uses "atkBuff", "hpBuff" but keywordsToTag keys will be lowercased earlier
      // ensure "atkbuff" and "hpbuff" exist if "atkbuff"/"hpbuff" present
      if (tagSet.has("atkbuff") === false && tagSet.has("atkbuff".toLowerCase())) tagSet.add("atkbuff");
      if (tagSet.has("hpbuff") === false && tagSet.has("hpbuff".toLowerCase())) tagSet.add("hpbuff");

      const roles = roleScoresFromTags(tagSet);

      views.push({
        id,
        raw: u, // reference only; never mutate
        element,
        atk: stats.atk,
        spd: stats.spd,
        hp: stats.hp,
        cost: stats.cost,
        leader,
        leaderParsed: {
          elementsMentioned: Array.from(elementsMentioned),
          parsedPercentMax,
          isGenericAllies
        },
        tags: Array.from(tagSet),
        roles,
        // normalized + base score computed later
        atkN: 0, spdN: 0, hpN: 0, atkPerCostN: 0,
        unitBase: 0
      });
    }

    // compute min/max across views for normalization
    const mmAtk = computeMinMax(views, v => v.atk);
    const mmSpd = computeMinMax(views, v => v.spd);
    const mmHp  = computeMinMax(views, v => v.hp);
    const mmApc = computeMinMax(views, v => v.atk / Math.max(v.cost, 1));

    for (const v of views) {
      v.atkN = clamp(norm01(v.atk, mmAtk.mn, mmAtk.mx), 0, 1);
      v.spdN = clamp(norm01(v.spd, mmSpd.mn, mmSpd.mx), 0, 1);
      v.hpN  = clamp(norm01(v.hp,  mmHp.mn,  mmHp.mx),  0, 1);
      v.atkPerCostN = clamp(norm01(v.atk / Math.max(v.cost, 1), mmApc.mn, mmApc.mx), 0, 1);

      const bs = DOCTRINE.scoringModel.baseStats;
      v.unitBase =
        bs.atkWeight * v.atkN +
        bs.spdWeight * v.spdN +
        bs.hpWeight  * v.hpN +
        bs.efficiencyAtkPerCostWeight * v.atkPerCostN;
    }

    // stable sort by id for determinism where needed
    return sortStableBy(views, (a, b) => lexCompare(a.id, b.id));
  }

  /* ---------- team features ---------- */
  function teamTagSet(teamViews) {
    const s = new Set();
    for (const v of teamViews) for (const t of v.tags) s.add(String(t).toLowerCase());
    return s;
  }

  function coverageScore(teamViews) {
    const tagSet = teamTagSet(teamViews);
    const w = DOCTRINE.statusWeights;
    const weights = [];
    // map internal lowercase to doctrine keys
    const map = {
      "poison": "poison",
      "burn": "burn",
      "turn": "turn",
      "sleep": "sleep",
      "stun": "stun",
      "heal": "heal",
      "atkbuff": "atkBuff",
      "hpbuff": "hpBuff",
      "cleanse": "cleanse"
    };
    let sumW = 0;
    for (const t of tagSet) {
      const k = map[t];
      if (!k) continue;
      const val = w[k] ?? 0;
      if (val > 0) sumW += val;
    }
    // top 5 weights: 5+5+5+4+4 = 23 (doctrine comment)
    return clamp(sumW / 23, 0, 1);
  }

  function pairSynergyScore(teamViews) {
    const n = teamViews.length;
    if (n < 2) return 0;
    let s = 0;

    function hasTag(v, tag) { return v._tagSet ? v._tagSet.has(tag) : false; }

    // cache sets
    for (const v of teamViews) v._tagSet = new Set(v.tags.map(t => String(t).toLowerCase()));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = teamViews[i], b = teamViews[j];

        const aPoBurn = hasTag(a, "poison") || hasTag(a, "burn");
        const bPoBurn = hasTag(b, "poison") || hasTag(b, "burn");
        if (aPoBurn && bPoBurn) s += 0.08;

        if (hasTag(a, "turn") && hasTag(b, "turn")) s += 0.08;

        const aControl = hasTag(a, "sleep") || hasTag(a, "stun") || hasTag(a, "turn");
        const bControl = hasTag(b, "sleep") || hasTag(b, "stun") || hasTag(b, "turn");

        const aHighDps = hasTag(a, "atkbuff") || a.atkN > 0.7;
        const bHighDps = hasTag(b, "atkbuff") || b.atkN > 0.7;

        const aSustain = hasTag(a, "heal") || hasTag(a, "cleanse") || hasTag(a, "hpbuff");
        const bSustain = hasTag(b, "heal") || hasTag(b, "cleanse") || hasTag(b, "hpbuff");

        if ((aControl && bHighDps) || (bControl && aHighDps)) s += 0.06;
        if ((aSustain && bHighDps) || (bSustain && aHighDps)) s += 0.05;
      }
    }

    // cleanup cache
    for (const v of teamViews) delete v._tagSet;

    const pairs = n * (n - 1) / 2;
    return clamp(s / (pairs * 0.10 + EPS), 0, 1);
  }

  function elementDistribution(teamViews) {
    const counts = {};
    for (const v of teamViews) {
      const e = v.element || "unknown";
      counts[e] = (counts[e] || 0) + 1;
    }
    let maxCount = 0;
    let majorityElement = "unknown";
    let distinct = 0;
    for (const [e, c] of Object.entries(counts)) {
      if (c > 0 && e !== "unknown") distinct++;
      if (c > maxCount) { maxCount = c; majorityElement = e; }
    }
    const majorityRatio = teamViews.length ? maxCount / teamViews.length : 0;
    return { counts, majorityElement, maxCount, distinctElements: distinct, majorityRatio };
  }

  function leaderMentionsElement(leaderView, element) {
    const els = new Set((leaderView.leaderParsed && leaderView.leaderParsed.elementsMentioned) || []);
    return els.has(element);
  }

  function elementStrategyScore(teamViews, leaderView) {
    const dist = elementDistribution(teamViews);
    const monoThresh = DOCTRINE.monoVsRainbow.monoThreshold.story;
    const rainbowMin = DOCTRINE.monoVsRainbow.rainbowThreshold.storyDistinctElementsMin;

    const leaderMatchesMajority = leaderView ? leaderMentionsElement(leaderView, dist.majorityElement) : false;
    const monoRequiresLeader = !!DOCTRINE.monoVsRainbow.monoRequiresLeader;
    const monoEligible = (dist.majorityRatio >= monoThresh) && (!monoRequiresLeader || leaderMatchesMajority);

    const rainbowTarget = dist.distinctElements >= rainbowMin;

    if (monoEligible) return clamp(0.85 + 0.15 * dist.majorityRatio, 0, 1);
    if (rainbowTarget) return clamp(0.70 + 0.10 * (dist.distinctElements / 6), 0, 1);
    return clamp(0.45 + 0.20 * dist.majorityRatio, 0, 1);
  }

  function roleCounts(teamViews) {
    let dps = 0, sustain = 0, control = 0;
    for (const v of teamViews) {
      if (v.roles.countsAsDps) dps++;
      if (v.roles.countsAsSustain) sustain++;
      if (v.roles.countsAsControl) control++;
    }
    return { dps, sustain, control };
  }

  function storyRolePenalty(teamViews) {
    const req = DOCTRINE.roleRules.storyRequirements;
    const c = roleCounts(teamViews);
    let p = 0;
    if (c.dps < req.dpsMin) p += 0.12 * (req.dpsMin - c.dps);
    if (c.sustain < req.sustainMin) p += 0.10 * (req.sustainMin - c.sustain);
    if (c.control < req.controlMin) p += 0.10 * (req.controlMin - c.control);
    return clamp(p, 0, 0.5);
  }

  function platoonRolePenalty(teamViews) {
    const req = DOCTRINE.roleRules.platoonRequirements;
    const c = roleCounts(teamViews);
    let p = 0;
    if (c.dps < req.dpsMin) p += 0.12 * (req.dpsMin - c.dps);
    const sustainOrControl = (c.sustain >= 1) || (c.control >= 1);
    if (!sustainOrControl) p += 0.10 * req.sustainOrControlMin;
    return clamp(p, 0, 0.5);
  }

  function teamAtkRaw(teamViews) {
    return sum(teamViews, v => v.atk);
  }

  /* ---------- leader scoring ---------- */
  function leaderMatchRatio(teamViews, leaderView) {
    const mentioned = new Set((leaderView.leaderParsed && leaderView.leaderParsed.elementsMentioned) || []);
    if (!mentioned.size) return 0; // treated as generic
    let match = 0;
    for (const v of teamViews) if (mentioned.has(v.element)) match++;
    return teamViews.length ? match / teamViews.length : 0;
  }

  function leaderScore(teamViews, leaderView) {
    const ratio = leaderMatchRatio(teamViews, leaderView);
    const minMatch = DOCTRINE.leaderSkill.scopeRules.elementMentioned.minMatchRatio;
    const bias = (ratio >= minMatch) ? 0.20 : -0.20;

    const percent = leaderView.leaderParsed ? (leaderView.leaderParsed.parsedPercentMax || 0) : 0;
    const percentNorm = clamp(percent / 100, 0, 2);

    const genericTier = DOCTRINE.leaderSkill.scopeRules.genericAllies.valueTier; // medium
    const genericValue = (leaderView.leaderParsed && leaderView.leaderParsed.isGenericAllies) ? (genericTier === "high" ? 0.25 : genericTier === "medium" ? 0.15 : 0.08) : 0;

    const matchComponent = ratio + bias;
    const score = 0.55 * matchComponent + 0.35 * percentNorm + 0.10 * genericValue;

    return { score, ratio, percent, percentNorm, genericValue };
  }

  function pickBestLeader(teamViews) {
    if (!teamViews.length) return { leaderId: null, leaderView: null, evals: [] };

    const evals = teamViews.map(v => {
      const e = leaderScore(teamViews, v);
      return { id: v.id, view: v, ...e };
    });

    const sorted = sortStableBy(evals, (a, b) => {
      if (Math.abs(b.score - a.score) > EPS) return b.score - a.score;
      // doctrine tie-breakers
      if (Math.abs(b.ratio - a.ratio) > EPS) return b.ratio - a.ratio;
      if (Math.abs(b.percent - a.percent) > EPS) return b.percent - a.percent;
      // higherTeamAtk uses team atk (same for all leaders), but doctrine wants it; keep deterministic anyway
      // final stable by id
      return lexCompare(a.id, b.id);
    });

    const best = sorted[0];
    return { leaderId: best.id, leaderView: best.view, evals: sorted };
  }

  function leaderMultiplier(teamViews, leaderEval) {
    const w = DOCTRINE.scoringModel.leaderMultiplierWeight;
    if (!leaderEval || !leaderEval.leaderView) return 1;

    const percent = leaderEval.evals && leaderEval.evals.length
      ? leaderEval.evals.find(x => x.id === leaderEval.leaderId)?.percent || 0
      : (leaderEval.leaderView.leaderParsed?.parsedPercentMax || 0);

    const percentNorm = clamp(percent / 100, 0, 2);

    if (percent > 0) return 1 + w * percentNorm;

    // no percent: fallback heuristic
    const ratio = leaderMatchRatio(teamViews, leaderEval.leaderView);
    return 1 + w * (0.15 + 0.20 * ratio);
  }

  /* ---------- scoring ---------- */
  function teamAdditives(teamViews, leaderViewOrNull) {
    const coverage = coverageScore(teamViews);
    const pairSyn = pairSynergyScore(teamViews);
    const elemStrat = elementStrategyScore(teamViews, leaderViewOrNull);

    const w = DOCTRINE.scoringModel.teamAdditives;
    const add = w.coverageWeight * coverage + w.pairSynergyWeight * pairSyn + w.elementStrategyWeight * elemStrat;

    return { coverage, pairSyn, elemStrat, add };
  }

  function storyScore(teamViews) {
    const baseSum = sum(teamViews, v => v.unitBase);
    const leaderEval = pickBestLeader(teamViews);
    const mult = leaderMultiplier(teamViews, leaderEval);

    const additives = teamAdditives(teamViews, leaderEval.leaderView);
    const penalty = storyRolePenalty(teamViews);

    const score = (baseSum * (1 - penalty) + additives.add) * mult;

    return {
      score,
      baseSum,
      penalty,
      leaderId: leaderEval.leaderId,
      leaderEvals: leaderEval.evals.map(e => ({ id: e.id, score: e.score, matchRatio: e.ratio, parsedPercent: e.percent, genericValue: e.genericValue })),
      leaderMultiplier: mult,
      teamAtk: teamAtkRaw(teamViews),
      additives
    };
  }

  function platoonScore(teamViews) {
    const baseSum = sum(teamViews, v => v.unitBase);
    const additives = teamAdditives(teamViews, null);
    const penalty = platoonRolePenalty(teamViews);
    const score = (baseSum * (1 - penalty) + additives.add);
    return { score, baseSum, penalty, additives };
  }

  /* ---------- candidate pool ---------- */
  function buildCandidatePool(views, lockedSet) {
    const poolSize = DOCTRINE.optimizerSearch.candidatePoolSize;

    const pre = views.map(v => ({
      v,
      preScore: v.unitBase + 0.08 * v.roles.controlNorm + 0.06 * v.roles.sustainNorm + 0.06 * v.roles.dpsNorm
    }));

    const sorted = sortStableBy(pre, (a, b) => {
      if (Math.abs(b.preScore - a.preScore) > EPS) return b.preScore - a.preScore;
      return lexCompare(a.v.id, b.v.id);
    });

    let pool = sorted.slice(0, poolSize).map(x => x.v);

    // force include locked units
    if (lockedSet && lockedSet.size) {
      const inPool = new Set(pool.map(v => v.id));
      for (const id of lockedSet) {
        if (!inPool.has(id)) {
          const found = views.find(v => v.id === id);
          if (found) pool.push(found);
        }
      }
      // trim back down if needed, dropping lowest non-locked
      if (pool.length > poolSize) {
        const lockedIds = new Set(lockedSet);
        pool = sortStableBy(pool, (a, b) => {
          // keep higher prescore
          const ap = (a.unitBase + 0.08*a.roles.controlNorm + 0.06*a.roles.sustainNorm + 0.06*a.roles.dpsNorm);
          const bp = (b.unitBase + 0.08*b.roles.controlNorm + 0.06*b.roles.sustainNorm + 0.06*b.roles.dpsNorm);
          if (Math.abs(bp - ap) > EPS) return bp - ap;
          return lexCompare(a.id, b.id);
        });
        // remove from end if non-locked
        const trimmed = [];
        for (const v of pool) trimmed.push(v);
        // trim
        while (trimmed.length > poolSize) {
          // remove lowest non-locked if possible
          let idx = trimmed.length - 1;
          while (idx >= 0 && lockedIds.has(trimmed[idx].id)) idx--;
          if (idx < 0) break;
          trimmed.splice(idx, 1);
        }
        pool = trimmed;
      }
    }

    // stable sort by id for deterministic iteration order
    return sortStableBy(pool, (a, b) => lexCompare(a.id, b.id));
  }

  /* ---------- beam search for story ---------- */
  function beamSearchStory(pool, lockedSet, targetSize) {
    const beamWidth = DOCTRINE.optimizerSearch.beamWidthStory;

    const idToView = new Map(pool.map(v => [v.id, v]));
    const locked = Array.from(lockedSet || []);
    const lockedViews = locked.map(id => idToView.get(id)).filter(Boolean);

    // If locked exceed target, keep best by base
    let initial = lockedViews;
    if (initial.length > targetSize) {
      initial = sortStableBy(initial, (a, b) => {
        if (Math.abs(b.unitBase - a.unitBase) > EPS) return b.unitBase - a.unitBase;
        return lexCompare(a.id, b.id);
      }).slice(0, targetSize);
    }

    const initialIds = new Set(initial.map(v => v.id));

    let beam = [{
      picked: initial.slice(),
      pickedSet: new Set(initialIds),
      baseSum: sum(initial, v => v.unitBase),
      // simple aggregates
      role: roleCounts(initial),
      tagSet: teamTagSet(initial),
      element: elementDistribution(initial)
    }];

    function approxCoverage(tagSet) {
      // compute quickly from tagSet
      const w = DOCTRINE.statusWeights;
      const map = { poison:"poison", burn:"burn", turn:"turn", sleep:"sleep", stun:"stun", heal:"heal", atkbuff:"atkBuff", hpbuff:"hpBuff", cleanse:"cleanse" };
      let s = 0;
      for (const t of tagSet) {
        const k = map[t];
        if (!k) continue;
        const val = w[k] ?? 0;
        if (val > 0) s += val;
      }
      return clamp(s / 23, 0, 1);
    }

    function approxRoleSatisfaction(role, size) {
      const req = DOCTRINE.roleRules.storyRequirements;
      // fraction of requirements met
      const dpsOk = Math.min(role.dps / req.dpsMin, 1);
      const susOk = Math.min(role.sustain / req.sustainMin, 1);
      const ctlOk = Math.min(role.control / req.controlMin, 1);
      return (dpsOk + susOk + ctlOk) / 3;
    }

    function approxElementConcentration(element, size) {
      return element.majorityRatio || 0;
    }

    const allPool = pool.slice(); // stable by id

    while (beam.length && beam[0].picked.length < targetSize) {
      const nextStates = [];
      for (const st of beam) {
        for (const cand of allPool) {
          if (st.pickedSet.has(cand.id)) continue;

          const picked = st.picked.concat([cand]);
          const pickedSet = new Set(st.pickedSet); pickedSet.add(cand.id);

          // update aggregates
          const baseSum = st.baseSum + cand.unitBase;

          const tagSet = new Set(st.tagSet);
          for (const t of cand.tags) tagSet.add(String(t).toLowerCase());

          const role = { ...st.role };
          if (cand.roles.countsAsDps) role.dps++;
          if (cand.roles.countsAsSustain) role.sustain++;
          if (cand.roles.countsAsControl) role.control++;

          // element
          const element = { ...st.element };
          const counts = { ...(st.element.counts || {}) };
          const e = cand.element || "unknown";
          counts[e] = (counts[e] || 0) + 1;
          element.counts = counts;
          let maxCount = 0, maj = "unknown", distinct = 0;
          for (const [el, c] of Object.entries(counts)) {
            if (c > maxCount) { maxCount = c; maj = el; }
            if (c > 0 && el !== "unknown") distinct++;
          }
          element.maxCount = maxCount;
          element.majorityElement = maj;
          element.distinctElements = distinct;
          element.majorityRatio = picked.length ? maxCount / picked.length : 0;

          // heuristic
          const cov = approxCoverage(tagSet);
          const rs = approxRoleSatisfaction(role, picked.length);
          const ec = approxElementConcentration(element, picked.length);
          const heur = baseSum + 0.2 * cov + 0.2 * rs + 0.1 * ec;

          nextStates.push({ picked, pickedSet, baseSum, role, tagSet, element, heur });
        }
      }

      // keep top beamWidth by heur, deterministic
      const sorted = sortStableBy(nextStates, (a, b) => {
        if (Math.abs(b.heur - a.heur) > EPS) return b.heur - a.heur;
        // deterministic by picked ids string
        const as = a.picked.map(x => x.id).join("|");
        const bs = b.picked.map(x => x.id).join("|");
        return lexCompare(as, bs);
      });

      beam = sorted.slice(0, beamWidth);
    }

    // leaf scoring
    let best = null;
    for (const st of beam) {
      const s = storyScore(st.picked);
      const pickedIds = st.picked.map(v => v.id);
      const record = { picked: st.picked, pickedIds, story: s };
      if (!best) best = record;
      else if (s.score > best.story.score + EPS) best = record;
      else if (Math.abs(s.score - best.story.score) <= EPS) {
        // tie-break by teamAtk then lex
        const ta = s.teamAtk, tb = best.story.teamAtk;
        if (ta > tb + EPS) best = record;
        else if (Math.abs(ta - tb) <= EPS) {
          const as = pickedIds.join("|");
          const bs = best.pickedIds.join("|");
          if (as < bs) best = record;
        }
      }
    }

    return best ? best : { picked: [], pickedIds: [], story: storyScore([]) };
  }

  /* ---------- front/back assignment (story) ---------- */
  function frontBackAssign(teamViews, options) {
    const mainN = DOCTRINE.teamFormats.story.main;
    const backN = DOCTRINE.teamFormats.story.back;

    const neverBack = new Set(DOCTRINE.frontVsBack.neverBacklineTags.map(x => String(x).toLowerCase()));
    const neverFront = new Set(DOCTRINE.frontVsBack.neverFrontlineTags.map(x => String(x).toLowerCase()));

    function tagSet(v) { return new Set(v.tags.map(t => String(t).toLowerCase())); }

    function hasAny(v, set) {
      const ts = tagSet(v);
      for (const t of set) if (ts.has(t)) return true;
      return false;
    }

    function reviveNorm(v) {
      // revive is captured in heal keyword list; detect revive/resurrect in leader skill text as well
      const text = safeLower(v.leader.description || "");
      return (/revive|resurrect/i.test(text) || v.tags.includes("revive")) ? 1 : 0;
    }

    const fp = DOCTRINE.frontVsBack.frontPreference;
    const bp = DOCTRINE.frontVsBack.backPreference;

    const scored = teamViews.map(v => {
      const control = v.roles.controlNorm;
      const heal = v.roles.sustainNorm;
      const frontScore = fp.weightSpd * v.spdN + fp.weightControl * control + fp.weightHp * v.hpN;
      const backScore  = bp.weightAtk * v.atkN + bp.weightHeal * heal + bp.weightRevive * reviveNorm(v);
      const forcedMain = hasAny(v, neverBack);
      const forcedBack = hasAny(v, neverFront);
      return { v, frontScore, backScore, forcedMain, forcedBack };
    });

    // apply optional fixed locks if provided
    const lockMain = new Set((options && options.storyLockedMainIds) ? options.storyLockedMainIds : []);
    const lockBack = new Set((options && options.storyLockedBackIds) ? options.storyLockedBackIds : []);

    for (const s of scored) {
      if (lockMain.has(s.v.id)) { s.forcedMain = true; s.forcedBack = false; }
      if (lockBack.has(s.v.id)) { s.forcedBack = true; s.forcedMain = false; }
    }

    let forcedMain = scored.filter(x => x.forcedMain && !x.forcedBack);
    let forcedBack = scored.filter(x => x.forcedBack && !x.forcedMain);
    let flex = scored.filter(x => !(x.forcedMain ^ x.forcedBack) || (x.forcedMain && x.forcedBack));

    // resolve conflicts (both true) by preference difference
    const conflicts = scored.filter(x => x.forcedMain && x.forcedBack);
    for (const c of conflicts) {
      // explicit *_only wins if present in tags; otherwise compare preference
      const ts = new Set(c.v.tags.map(t => String(t).toLowerCase()));
      const frontOnly = ts.has("frontline_only");
      const backOnly = ts.has("backline_only");
      if (frontOnly && !backOnly) { forcedMain.push(c); continue; }
      if (backOnly && !frontOnly) { forcedBack.push(c); continue; }
      if ((c.frontScore - c.backScore) >= 0) forcedMain.push(c);
      else forcedBack.push(c);
      // remove from flex
      flex = flex.filter(x => x.v.id !== c.v.id);
    }

    // if overflow, keep best by preference delta
    if (forcedMain.length > mainN) {
      forcedMain = sortStableBy(forcedMain, (a, b) => {
        const ad = (a.frontScore - a.backScore);
        const bd = (b.frontScore - b.backScore);
        if (Math.abs(bd - ad) > EPS) return bd - ad;
        return lexCompare(a.v.id, b.v.id);
      });
      flex = flex.concat(forcedMain.slice(mainN));
      forcedMain = forcedMain.slice(0, mainN);
    }

    if (forcedBack.length > backN) {
      forcedBack = sortStableBy(forcedBack, (a, b) => {
        const ad = (a.backScore - a.frontScore);
        const bd = (b.backScore - b.frontScore);
        if (Math.abs(bd - ad) > EPS) return bd - ad;
        return lexCompare(a.v.id, b.v.id);
      });
      flex = flex.concat(forcedBack.slice(backN));
      forcedBack = forcedBack.slice(0, backN);
    }

    // fill remaining slots
    const remainingMain = mainN - forcedMain.length;
    const remainingBack = backN - forcedBack.length;

    const flexSortedForMain = sortStableBy(flex, (a, b) => {
      const ad = (a.frontScore - a.backScore);
      const bd = (b.frontScore - b.backScore);
      if (Math.abs(bd - ad) > EPS) return bd - ad;
      return lexCompare(a.v.id, b.v.id);
    });

    const main = forcedMain.map(x => x.v);
    const used = new Set(main.map(v => v.id));

    for (const x of flexSortedForMain) {
      if (main.length >= mainN) break;
      if (used.has(x.v.id)) continue;
      main.push(x.v);
      used.add(x.v.id);
    }

    const flexRemaining = scored.filter(x => !used.has(x.v.id) && !forcedBack.some(b => b.v.id === x.v.id));
    const backSorted = sortStableBy(forcedBack.concat(flexRemaining), (a, b) => {
      const ad = (a.backScore - a.frontScore);
      const bd = (b.backScore - b.frontScore);
      if (Math.abs(bd - ad) > EPS) return bd - ad;
      return lexCompare(a.v.id, b.v.id);
    });

    const back = [];
    const used2 = new Set(used);
    for (const x of backSorted) {
      if (back.length >= backN) break;
      if (used2.has(x.v.id)) continue;
      back.push(x.v);
      used2.add(x.v.id);
    }

    return {
      mainIds: main.map(v => v.id),
      backIds: back.map(v => v.id),
      debug: scored.map(x => ({ id: x.v.id, frontScore: x.frontScore, backScore: x.backScore, forcedMain: x.forcedMain, forcedBack: x.forcedBack }))
    };
  }

  /* ---------- platoon builder ---------- */
  function buildPlatoons(remainingViews) {
    const count = DOCTRINE.teamFormats.platoons.count;
    const size = DOCTRINE.teamFormats.platoons.size;

    const variety = DOCTRINE.optimizerSearch.varietyPressure;
    const usage = {}; // tag -> count

    function varietyPenaltyForUnit(v) {
      if (!variety.enabled || !variety.penalizeOverusedTags) return 0;
      const pen = variety.penaltyPerRepeatTag;
      let s = 0;
      const seen = new Set();
      for (const tRaw of v.tags) {
        const t = String(tRaw).toLowerCase();
        if (seen.has(t)) continue;
        seen.add(t);
        if ((usage[t] || 0) > 0) s += pen * (usage[t] || 0);
      }
      return s;
    }

    function updateUsageForPlatoon(teamViews) {
      if (!variety.enabled) return;
      const set = teamTagSet(teamViews);
      for (const t of set) usage[t] = (usage[t] || 0) + 1;
    }

    const left = remainingViews.slice(); // stable id order already
    const used = new Set();
    const platoons = [];

    for (let p = 0; p < count; p++) {
      const team = [];
      while (team.length < size) {
        const candidates = left.filter(v => !used.has(v.id));
        if (!candidates.length) break;

        // determine needs for better greedy choices
        const rc = roleCounts(team);
        const needDps = rc.dps < 1;
        const needSusOrCtl = !((rc.sustain >= 1) || (rc.control >= 1));
        const slotsLeft = size - team.length;

        let best = null;

        for (const v of candidates) {
          // evaluate marginal
          const trial = team.concat([v]);
          const base = platoonScore(team).score;
          const next = platoonScore(trial).score;
          let marginal = next - base;

          // need boosts if running out of slots
          if (needDps && slotsLeft <= 2 && v.roles.countsAsDps) marginal += 0.08;
          if (needSusOrCtl && slotsLeft <= 2 && (v.roles.countsAsSustain || v.roles.countsAsControl)) marginal += 0.06;

          // apply variety penalty
          marginal -= varietyPenaltyForUnit(v);

          if (!best || marginal > best.marginal + EPS) best = { v, marginal };
          else if (best && Math.abs(marginal - best.marginal) <= EPS) {
            // tie-break: higher unitBase then id
            if (v.unitBase > best.v.unitBase + EPS) best = { v, marginal };
            else if (Math.abs(v.unitBase - best.v.unitBase) <= EPS && v.id < best.v.id) best = { v, marginal };
          }
        }

        if (!best) break;
        team.push(best.v);
        used.add(best.v.id);
      }

      if (!team.length) break;

      const scoreObj = platoonScore(team);
      updateUsageForPlatoon(team);

      platoons.push({
        units: team.map(v => v.id),
        score: scoreObj.score,
        explain: {
          baseSum: scoreObj.baseSum,
          penalty: scoreObj.penalty,
          additives: scoreObj.additives
        }
      });
    }

    return platoons;
  }

  /* ---------- main run ---------- */
  function run(unitsRaw, options) {
    DOCTRINE = resolveDoctrine(options && options.doctrineOverrides);
    const ownedViewsAll = buildUnitViews(unitsRaw || []);

    const ownedSet = new Set(ownedViewsAll.map(v => v.id));
    const banned = new Set((options && options.bannedUnitIds) ? options.bannedUnitIds : []);
    const locked = new Set((options && options.lockedUnitIds) ? options.lockedUnitIds : []);

    // filter banned
    const ownedViews = ownedViewsAll.filter(v => !banned.has(v.id));

    // keep locked only if owned
    for (const id of Array.from(locked)) if (!ownedSet.has(id) || banned.has(id)) locked.delete(id);

    const storySize = Math.min(DOCTRINE.teamFormats.story.main + DOCTRINE.teamFormats.story.back, ownedViews.length);
    if (storySize === 0) {
      return {
        story: { main: [], back: [], leaderId: null, explain: { reason: "No owned units after bans." } },
        platoons: []
      };
    }

    const pool = buildCandidatePool(ownedViews, locked);

    // ensure story picks from pool, but if owned < poolSize, ok
    const storyPick = beamSearchStory(pool, locked, storySize);
    const storyViews = storyPick.picked;

    const leaderId = storyPick.story.leaderId;

    const fb = frontBackAssign(storyViews, options || {});
    const storyMain = fb.mainIds;
    const storyBack = fb.backIds;

    // If storySize < 8, fb will only fill as possible; ensure no dup and order stable
    const storySet = new Set(storyMain.concat(storyBack));

    // remaining for platoons: owned minus story, no duplicates
    const remainingViews = ownedViews.filter(v => !storySet.has(v.id));
    // stable by id
    const remainingSorted = sortStableBy(remainingViews, (a, b) => lexCompare(a.id, b.id));

    const platoons = buildPlatoons(remainingSorted);

    return {
      story: {
        main: storyMain,
        back: storyBack,
        leaderId: leaderId,
        explain: {
          storyScore: storyPick.story.score,
          baseSum: storyPick.story.baseSum,
          rolePenalty: storyPick.story.penalty,
          leaderMultiplier: storyPick.story.leaderMultiplier,
          leaderEvals: storyPick.story.leaderEvals,
          additives: storyPick.story.additives,
          frontBack: fb.debug,
          pickedIds: storyPick.pickedIds
        }
      },
      platoons
    };
  }

  global.OptimizerEngine = { run };

})(window);