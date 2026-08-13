#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Tuple

ROOT_MARKERS = ["apkfiles", "tools"]
OUT_REL = "apkfiles/entries/runtime/optimizer_runtime_model.json"
REPORT_REL = "apkfiles/entries/reports/optimizer_runtime_model_report.json"

FEATURE_STRENGTH: Dict[str, float] = {
    "applies_burn": 1.6,
    "applies_poison": 1.6,
    "applies_sleep": 1.6,
    "applies_stun": 1.6,
    "payoff_burn": 1.5,
    "payoff_poison": 1.5,
    "payoff_sleep": 1.5,
    "payoff_stun": 1.5,
    "applies_frostburn": 1.6,
    "payoff_frostburn": 1.5,
    "converts_frostburn_to_burn": 1.1,
    "applies_stealth": 1.45,
    "payoff_stealth": 1.4,
    "applies_counter": 1.35,
    "payoff_counter": 1.35,
    "applies_charge": 1.4,
    "payoff_charge": 1.4,
    "summon": 1.2,
    "payoff_blood": 1.5,
    "payoff_crisis": 1.45,
    "payoff_survivor": 1.45,
    "role_guardian": 1.35,
    "role_cleanser": 1.35,
    "role_healer": 1.25,
    "role_ally_healer": 1.35,
    "role_team_healer": 1.45,
    "role_self_sustain": 1.0,
    "role_reviver": 1.35,
    "role_team_cleanser": 1.45,
    "role_ally_cleanser": 1.35,
    "role_self_cleanser": 0.9,
    "role_defender": 1.2,
    "defense_hold_ground": 1.25,
    "defense_armor": 1.15,
    "ward_burn": 1.1,
    "ward_poison": 1.1,
    "ward_sleep": 1.1,
    "ward_stun": 1.1,
    "removes_burn": 1.0,
    "removes_poison": 1.0,
    "removes_sleep": 1.0,
    "removes_stun": 1.0,
    "penalized_by_burn": 1.2,
    "penalized_by_poison": 1.2,
    "penalized_by_sleep": 1.2,
    "penalized_by_stun": 1.2,
    "resource_spirit": 1.3,
    "tempo_turn": 1.3,
    "timing_entry_self": 1.2,
    "timing_death_self": 1.1,
    "timing_revenge": 1.2,
    "timing_reinforcement_add": 1.15,
    "leader": 1.1,
}

# These rules operate on explicit ability/passive identifiers, not arbitrary
# nested configuration text.  The previous global substring scan treated AI
# target hints, immunity lists, negative conditions, and even "healthy" as
# mechanical features.  Keep the identifiers conservative and use localized
# descriptions below only for precise action/condition phrases.
IDENTIFIER_RULES: Dict[str, Tuple[str, ...]] = {
    "applies_burn": (
        "burnself", "burnboth", "burnally", "burnall", "ignition", "heating",
        "burnskin", "burnrevenge", "burnentrance", "burnstart", "autoburn",
        "prepareburn", "burnchance", "grantburn", "burnenemy",
    ),
    "payoff_burn": (
        "burnblast", "burndrive", "burnforce", "burnfrenzy", "burndevour",
        "burnboosted", "hasburned", "burntimestrike", "burndrain", "ifburn",
        "whileburn", "burningallies", "burnarmor",
        "burninggoddess", "burningjourney", "burnregeneration", "regeneratewhenburn",
    ),
    "applies_poison": (
        "poisontouch", "poisonattack", "poisonskin", "poisonrevenge", "poisontrap",
        "poisonentrance", "megapoisontouch", "megapoisonjolt", "megapoisonpassive",
        "megapoisonaura", "superpoisontouch", "superpoisonskin", "lethalpoison",
        "poisonparalysis",
    ),
    "payoff_poison": (
        "poisoneater", "poisondevour", "poisonfury", "poisondrain", "poisoncharge",
        "poisonmomentum", "momentumstrikepoison", "poisonkiller", "poisonlust",
        "poisonturn", "enemypoisoned", "whileenemypoisoned",
    ),
    "applies_sleep": (
        "sleepsingle", "sleepdouble", "sleepbomb", "sleepattack", "forcesleep",
        "massforcesleep", "sleepwave", "sleeprevenge", "sleepskin", "sleepentrance",
        "sleepchance",
    ),
    "payoff_sleep": (
        "dreamhunt", "dreamhunter", "dreambuster", "dreamdevour", "nightmare",
        "killsleep", "sleepstrike", "sleepingenemy",
    ),
    "payoff_stun": ("timestrike", "timebuster", "stunburst", "stunnedenemy"),
    "applies_frostburn": ("grantfrostburn", "frostburnenemy", "frostburninfection"),
    "payoff_frostburn": ("iffrostburn", "frostburnedtarget", "vsfrostburn"),
    "applies_stealth": (
        "stealthself", "stealthally", "stealthentrance", "getstealth", "gainstealth",
        "maximumstealth", "superstealth", "stealthshieldallies",
    ),
    "applies_stun": (
        "stunsingle", "stundouble", "stunrandom", "stunall", "stunbomb",
        "stunattack", "stunskin", "stunrevenge", "stunentrance", "grantstun",
        "enemystun", "killstun", "stunlowesttu",
    ),
    "payoff_stealth": (
        "stealthfury", "stealthstrike", "stealthblast", "stealthoverdrive",
        "stealthhunter", "sneakattack", "sneakstanceattack",
    ),
    "applies_counter": ("counterstance", "counterskin", "grantcounter", "getcounter"),
    "payoff_counter": ("ifcounterstance", "counterstanceattack", "counterstrike"),
    "applies_charge": (
        "energycharge", "gaincharge", "grantcharge", "recharge", "fullrecharge",
        "powercharge", "spiritcharge", "fullychargedstart",
    ),
    "payoff_charge": (
        "chargeattack", "chargeblast", "dischargestrike", "ifcharged", "whilecharged",
        "chargedalliance", "chargeddefense", "gigacharged",
    ),
    "summon": ("summontoken", "summonangel", "summonminion", "summonmass", "summonmagical", "summondoll", "summonsnow", "summonjeanne"),
    "payoff_blood": ("bloodfury", "bloodthirst", "vicariousblood"),
    "payoff_crisis": ("crisis", "lowhp", "hp25", "desperate"),
    "payoff_survivor": ("survivor",),
    "role_guardian": (
        "autoprotect", "protectteammates", "grantprotectteammates", "promisedguard",
        "puppeteerguard", "emergencyprotect", "protectallies",
    ),
    "role_reviver": ("revive", "revival", "resurrect", "returntobattlefield"),
    "resource_spirit": (
        "gainspirit", "spiritgain", "addspirit", "spiritrecovery", "painspirit",
        "alliesgainspirit", "spiritthief", "energyconverter",
    ),
    "tempo_turn": (
        "grantturn", "giveturn", "allyturn", "randomallyturn", "instantturn",
        "extraturn", "gainturn", "getturn", "tureduc", "accelerate", "haste",
        "turnreprise",
    ),
    "defense_hold_ground": ("holdground", "blockdeath", "endure", "survivewith1hp"),
    "defense_armor": ("grantarmor", "getarmor", "barrier", "damagereduction", "fortify"),
}

STUN_SETUP_EXCLUSIONS = (
    "immunity", "immune", "absorber", "absorb", "minus", "reduc", "ward",
    "killer", "buster", "timestrike", "tough", "nostun", "antistun",
)


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root")


def load_json(path: Path, fallback: Any):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def load_json_checked(path: Path) -> Tuple[Any, Dict[str, Any]]:
    if not path.exists():
        return None, {"path": str(path), "status": "missing", "count": 0}
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        return None, {"path": str(path), "status": "invalid", "count": 0, "error": str(exc)}
    count = len(value) if isinstance(value, (dict, list)) else 0
    return value, {"path": str(path), "status": "ok", "count": count}


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if path.exists() and path.read_text(encoding="utf-8-sig") == content:
        return
    path.write_text(content, encoding="utf-8", newline="\n")


def internal(row: Dict[str, Any]) -> Dict[str, Any]:
    return row.get("internal") if isinstance(row.get("internal"), dict) else {}


def family_key(row: Dict[str, Any]) -> str:
    source = str(row.get("sourceId") or internal(row).get("sourceId") or "")
    return str(row.get("family") or internal(row).get("family") or re.sub(r"\d+$", "", source)).strip()


def entry_key(row: Dict[str, Any]) -> str:
    return str(row.get("sourceId") or internal(row).get("sourceId") or "").strip()


def generic_key(row: Dict[str, Any]) -> str:
    return str(row.get("sourceId") or internal(row).get("sourceId") or row.get("family") or row.get("id") or "").strip()


def index_unique(
    entries: Iterable[Dict[str, Any]],
    key_fn: Callable[[Dict[str, Any]], str],
    authority: str,
) -> Tuple[Dict[str, Dict[str, Any]], List[Dict[str, Any]]]:
    result: Dict[str, Dict[str, Any]] = {}
    collisions: List[Dict[str, Any]] = []
    for row in entries or []:
        if not isinstance(row, dict):
            continue
        key = key_fn(row)
        if not key:
            collisions.append({"authority": authority, "type": "missing_key", "rowId": row.get("id")})
            continue
        if key in result:
            collisions.append({
                "authority": authority,
                "type": "duplicate_key",
                "key": key,
                "firstSourceId": entry_key(result[key]),
                "secondSourceId": entry_key(row),
            })
            continue
        result[key] = row
    return result, collisions


def normalize_tag_rows(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        for key in ("character_tags", "tags", "entries", "items", "characters"):
            rows = payload.get(key)
            if isinstance(rows, list):
                return [row for row in rows if isinstance(row, dict)]
        if payload and all(isinstance(value, dict) for value in payload.values()):
            return list(payload.values())
    return []


def merge_tag_rows(*sources: Any) -> List[Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}
    for source in sources:
        for row in normalize_tag_rows(source):
            key = str(row.get("internalMonsterId") or row.get("sourceId") or row.get("family") or row.get("id") or "").strip()
            if not key:
                continue
            current = merged.setdefault(key, dict(row))
            if current is row:
                continue
            for field, value in row.items():
                if field in ("derivedTags", "tags"):
                    old = current.get(field) if isinstance(current.get(field), list) else []
                    new = value if isinstance(value, list) else []
                    current[field] = sorted({str(item) for item in [*old, *new] if str(item).strip()})
                elif field == "tagEvidence" and isinstance(value, dict):
                    evidence = current.get("tagEvidence") if isinstance(current.get("tagEvidence"), dict) else {}
                    evidence.update(value)
                    current["tagEvidence"] = evidence
                elif value not in (None, "", [], {}):
                    current[field] = value
    return list(merged.values())


def index_tags(rows: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    result: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        for key in (row.get("id"), row.get("internalMonsterId"), row.get("sourceId"), row.get("family")):
            if key:
                result[str(key)] = row
    return result


def normalized(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def iter_scalar_identifiers(value: Any, path: str, depth: int = 0) -> Iterable[Tuple[str, str]]:
    """Yield explicit referenced identifiers without treating dictionary keys as facts."""
    if value is None or depth > 4:
        return
    if isinstance(value, str):
        if value.strip():
            yield path, value
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            yield from iter_scalar_identifiers(item, f"{path}[{index}]", depth + 1)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            yield from iter_scalar_identifiers(item, f"{path}.{key}", depth + 1)


def identifier_features(identifier: Any) -> List[str]:
    token = normalized(identifier)
    if not token:
        return []
    features = {
        feature
        for feature, patterns in IDENTIFIER_RULES.items()
        if any(pattern in token for pattern in patterns)
    }
    if "applies_stun" in features and any(exclusion in token for exclusion in STUN_SETUP_EXCLUSIONS):
        features.remove("applies_stun")
    return sorted(features)


def source_scope(path: str) -> str:
    lowered = path.lower()
    if ".activeskills." in lowered:
        return "active"
    if ".passives." in lowered:
        return "passive"
    if "leader" in lowered:
        return "leader"
    return "entry"


def receipt(
    feature: str,
    *,
    relation: str = "provides",
    target_team: str = "unknown",
    timing: str = "",
    status_variant: str = "",
    trigger: str = "",
) -> Dict[str, Any]:
    return {
        "feature": feature,
        "relation": relation,
        "targetTeam": target_team,
        "timing": timing,
        "statusVariant": status_variant,
        "trigger": trigger,
    }


def iter_named_scalars(value: Any, path: str = "config", depth: int = 0) -> Iterable[Tuple[str, str]]:
    """Yield scalar values with their exact field path from resolved configuration."""
    if value is None or depth > 8:
        return
    if isinstance(value, (str, int, float, bool)):
        yield path, str(value)
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            yield from iter_named_scalars(item, f"{path}[{index}]", depth + 1)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            yield from iter_named_scalars(item, f"{path}.{key}", depth + 1)


def target_scope_from_config(config: Dict[str, Any]) -> str:
    blob = " ".join(value for _, value in iter_named_scalars(config)).lower()
    targeting = str(config.get("targetingData") or "").lower()
    if "allall" in targeting or "all allies" in blob or "allally" in blob:
        return "allies"
    if "friendly" in blob or "ally" in targeting:
        return "allies"
    if "enemy" in blob or "enemy" in targeting:
        return "enemies"
    if "sourceonly" in blob or "targettype source" in blob or targeting in {"self", "user"}:
        return "self"
    return "unknown"


def targets_all_allies(config: Dict[str, Any]) -> bool:
    targeting = normalized(config.get("targetingData"))
    return targeting.startswith("allally") or targeting in {"allfriends", "allfriendly"}


def configuration_feature_records(config: Any) -> List[Dict[str, Any]]:
    """Extract positive mechanics from resolved AbilityConfig fields.

    Exact configuration fields outrank prose.  Negative condition, immunity,
    ward, and targeting metadata must never become status production.
    """
    if not isinstance(config, dict):
        return []
    found: Dict[Tuple[str, str, str], Dict[str, Any]] = {}

    def add(feature: str, relation: str = "provides", target_team: str = "unknown", variant: str = "") -> None:
        key = (feature, relation, target_team)
        found.setdefault(key, receipt(feature, relation=relation, target_team=target_team, status_variant=variant))

    flags = {normalized(value) for value in config.get("flags", []) if str(value).strip()}
    scalars = list(iter_named_scalars(config))
    target_team = target_scope_from_config(config)
    config_blob = normalized(" ".join(value for _, value in scalars))
    stun_setup_blocked = any(fragment in config_blob for fragment in STUN_SETUP_EXCLUSIONS) or "stunabsorb" in config_blob

    setup_flags = {
        "burn": "applies_burn", "poisoner": "applies_poison", "sleep": "applies_sleep",
        "stun": "applies_stun", "stealth": "applies_stealth", "energycharge": "applies_charge",
    }
    for flag, feature in setup_flags.items():
        if flag in flags and not (feature == "applies_stun" and stun_setup_blocked):
            add(feature, "produces", target_team)

    payoff_flag_fragments = {
        "payoff_burn": ("burnblast", "burndrive", "burnforce", "burnfrenzy", "burnattack"),
        "payoff_poison": ("poisoneater", "poisonfury", "poisondevour", "poisonattack"),
        "payoff_sleep": ("dreamhunt", "dreambuster", "nightmare"),
        "payoff_stun": ("timestrike", "timebuster", "stunburst"),
        "payoff_stealth": ("sneak", "stealthfury", "stealthstrike", "stealthblast"),
        "payoff_counter": ("counterattack", "counterstrike"),
        "payoff_charge": ("charged", "discharge", "chargeblast"),
    }
    for feature, fragments in payoff_flag_fragments.items():
        if any(any(fragment in flag for fragment in fragments) for flag in flags):
            add(feature, "benefits_from")

    status_buffs = {
        "applies_burn": ("burn", "healingburn", "megahealingburn"),
        "applies_poison": ("poison", "superpoison", "megapoison", "lethalpoison"),
        "applies_sleep": ("sleep", "deepsleep", "cursedsleep", "forcesleep"),
        "applies_stun": ("stun",),
        "applies_frostburn": ("frostburn",),
        "applies_stealth": ("stealth", "activestealthjustgained", "maximumstealth"),
        "applies_counter": ("counterstance", "counterskin"),
        "applies_charge": ("powercharge", "energycharge"),
    }
    forbidden_buff_fragments = ("immun", "ward", "condition", "skip", "reduc", "minus", "remove")
    for path, value in scalars:
        field = path.lower()
        token = normalized(value)
        if not token:
            continue
        if field.endswith(".buffs") or ".buffs[" in field:
            for feature, prefixes in status_buffs.items():
                if any(token == prefix or token.startswith(prefix) for prefix in prefixes):
                    if feature == "applies_stun" and stun_setup_blocked:
                        continue
                    if any(fragment in token for fragment in forbidden_buff_fragments) or ("counter" in token and feature != "applies_counter"):
                        continue
                    add(feature, "produces", target_team, next((prefix for prefix in prefixes if token.startswith(prefix)), ""))
        if any(key in field for key in ("attackscalors", "damageboosts", "spiritcondition")):
            conditions = {
                "payoff_burn": ("burning", "burned", "hasburn"),
                "payoff_poison": ("poisoned", "vsPoison".lower()),
                "payoff_sleep": ("sleeping", "vssleep"),
                "payoff_stun": ("stunned", "vsstun"),
                "payoff_frostburn": ("frostburn",),
                "payoff_stealth": ("stealth", "sneak"),
                "payoff_counter": ("counterstance",),
                "payoff_charge": ("charged", "powercharge", "energycharge"),
            }
            for feature, fragments in conditions.items():
                if "not" not in token and "without" not in token and any(fragment in token for fragment in fragments):
                    add(feature, "benefits_from")

    # Resolved target-aware support roles.
    component_tokens = {normalized(value) for path, value in scalars if ".components" in path.lower()}
    override_blob = " ".join(value for _, value in scalars).lower()
    has_heal = "heal" in component_tokens or "healer" in flags or any("healthperattack" in path.lower() for path, _ in scalars)
    if has_heal:
        if target_team == "allies":
            add("role_healer", "provides", "allies")
            add("role_team_healer" if targets_all_allies(config) else "role_ally_healer", "provides", "allies")
        else:
            add("role_self_sustain", "provides", "self")
    if "purify" in flags or "purify" in override_blob or "removenegative" in override_blob:
        if target_team == "allies":
            add("role_cleanser", "removes", "allies")
            add("role_team_cleanser" if targets_all_allies(config) else "role_ally_cleanser", "removes", "allies")
        else:
            add("role_self_cleanser", "removes", "self")
    if "protect" in flags:
        add("role_guardian", "protects", "allies")
    buff_tokens = {
        normalized(value) for path, value in scalars
        if path.lower().endswith(".buffs") or ".buffs[" in path.lower()
    }
    if any(
        (token.startswith("armor") or token.startswith("barrier") or token.startswith("fortif"))
        and not any(blocked in token for blocked in ("remove", "ignore", "condition"))
        for token in buff_tokens
    ):
        add("role_defender", "protects", target_team)
        add("defense_armor", "provides", target_team)
    if any(
        (token.startswith("holdground") or token.startswith("endure") or token.startswith("blockdeath"))
        and not any(blocked in token for blocked in ("ignore", "killer", "condition"))
        for token in buff_tokens
    ):
        add("defense_hold_ground", "provides", "self")
    return list(found.values())


def configuration_negative_payoffs(config: Any) -> set[str]:
    if not isinstance(config, dict):
        return set()
    result = set()
    for path, value in iter_named_scalars(config):
        if not any(field in path.lower() for field in ("attackscalors", "damageboosts", "usecondition")):
            continue
        token = normalized(value)
        for status in ("burn", "poison", "sleep", "stun"):
            if any(fragment in token for fragment in (f"not{status}", f"non{status}", f"without{status}")):
                result.add(status)
    return result


def description_feature_records(description: Any) -> List[Dict[str, Any]]:
    """Return positive, clause-local mechanics from localized help text.

    This fallback deliberately rejects examples, immunities, wards, reductions,
    redirections, removals and negative conditions as status setup/payoff.  A
    resolved configuration receipt is preferred whenever one exists.
    """
    raw_text = str(description or "")
    if not raw_text.strip():
        return []
    text = re.sub(r"\((?:e\.g\.|for example)[^)]*\)", " ", raw_text, flags=re.I)
    text = re.sub(r"[\r\n]+", ". ", text)
    text = re.sub(r"\s+", " ", text).strip().lower()
    clauses = [part.strip(" -:;") for part in re.split(r"[.!?;]+|\s+-\s+|\bthen\b", text) if part.strip(" -:;")]
    scoped_clauses = list(clauses)
    for clause in clauses:
        scoped_clauses.extend(part.strip(" -:;") for part in re.split(r"\band\b|,", clause) if part.strip(" -:;"))
    found: Dict[Tuple[str, str, str], Dict[str, Any]] = {}

    def add(feature: str, relation: str = "provides", target_team: str = "unknown", **details: Any) -> None:
        key = (feature, relation, target_team)
        found.setdefault(key, receipt(feature, relation=relation, target_team=target_team, **details))

    def target_of(clause: str) -> str:
        if re.search(r"\b(?:enemy|enemies|enemy team)\b", clause):
            return "enemies"
        if re.search(r"\b(?:ally|allies|allied units|ally team)\b", clause):
            return "allies"
        if re.search(r"\b(?:the user|this unit|user)\b", clause):
            return "self"
        return "unknown"

    setup_patterns = {
        "applies_burn": (
            r"\bgrant(?:s|ed)?\b.{0,80}\b(?:healing |mega healing )?burn(?: status effect)?\b",
            r"\b(?:enemy|enemies|target|targets|ally|allies|the user|this unit)\b.{0,70}\b(?:become|becomes|is|are|will be) burned\b",
            r"\bburns?\b\s+(?:an? |the |all |random )?(?:enemy|enemies|target|targets|ally|allies)\b",
        ),
        "applies_poison": (
            r"\bgrant(?:s|ed)?\b.{0,80}\b(?:mega |super |lethal )?poison(?: status effect)?\b",
            r"\b(?:enemy|enemies|target|targets)\b.{0,70}\b(?:become|becomes|is|are|will be) (?:mega |super |lethal )?poisoned\b",
            r"\bpoisons?\b\s+(?:an? |the |all |random )?(?:enemy|enemies|target|targets)\b",
        ),
        "applies_sleep": (
            r"\bgrant(?:s|ed)?\b.{0,80}\b(?:deep |cursed |forced )?sleep(?: status effect)?\b",
            r"\bput(?:s)?\b.{0,70}\bto sleep\b",
        ),
        "applies_stun": (
            r"\bstuns?\b\s+(?:an? |the |all |random |\d+ )*(?:enemy|enemies|target|targets)\b",
            r"\b(?:enemy|enemies|target|targets)\b.{0,70}\b(?:is|are|will be|become|becomes) stunned(?: for)?\b",
        ),
        "applies_frostburn": (
            r"\bgrant(?:s|ed)?\b.{0,80}\bfrostburn\b",
            r"\b(?:enemy|enemies|target|targets)\b.{0,70}\b(?:is|are|will be|become|becomes) frostburned\b",
        ),
        "applies_stealth": (
            r"\bgrant(?:s|ed)?\b.{0,80}\bstealth(?: status effect| shield)?\b",
            r"\b(?:gain|gains|gained|enter(?:s)? battle with)\b.{0,50}\bstealth\b",
        ),
        "applies_counter": (
            r"\bgrant(?:s|ed)?\b.{0,80}\bcounter stance\b",
            r"\b(?:gain|gains|enter(?:s)? battle with)\b.{0,50}\bcounter stance\b",
        ),
        "applies_charge": (
            r"\bgrant(?:s|ed)?\b.{0,80}\b(?:a |\d+ )?(?:power |energy )?charges?\b",
            r"\b(?:gain|gains|gained|enter(?:s)? battle with)\b.{0,50}\b(?:a |\d+ )?(?:power |energy )?charges?\b",
        ),
    }
    blocked_setup = (
        "cannot be", "immune", "immunity", " ward", "prevents ", "takes the stun instead",
        "absorbs the stun", "stun reduction", "reduces the amount", "less stun", "would be affected",
        "influence the turn order", "stuns targeting", "ignore incoming", "remove", "removed",
    )
    for feature, patterns in setup_patterns.items():
        for clause in clauses:
            if feature == "applies_burn" and "frostburn" in clause:
                continue
            if any(fragment in clause for fragment in blocked_setup):
                continue
            if any(re.search(pattern, clause) for pattern in patterns):
                variants = {
                    "applies_burn": ("mega healing burn", "healing burn", "burn"),
                    "applies_poison": ("mega poison", "super poison", "lethal poison", "poison"),
                    "applies_sleep": ("deep sleep", "cursed sleep", "forced sleep", "sleep"),
                    "applies_stun": ("stun",),
                    "applies_frostburn": ("frostburn",),
                    "applies_stealth": ("stealth",),
                    "applies_counter": ("counter stance",),
                    "applies_charge": ("power charge", "energy charge", "charge"),
                }
                variant = next((name for name in variants.get(feature, ()) if name in clause), "")
                add(feature, "produces", target_of(clause), status_variant=variant)
                break

    payoff_statuses = {
        "payoff_burn": (r"(?<!frost)\bburning\b", r"(?<!frost)\bburned\b", r"\bburn status\b"),
        "payoff_poison": (r"\bpoisoned\b", r"\b(?:mega |super |lethal )?poison status\b"),
        "payoff_sleep": (r"\bsleeping\b", r"\basleep\b", r"\bsleep status\b"),
        "payoff_stun": (r"\bstunned\b", r"\bstun status\b"),
        "payoff_frostburn": (r"\bfrostburned\b", r"\bfrostburn\b"),
        "payoff_stealth": (r"\bstealthed\b", r"\bstealth status\b", r"\bwhile.{0,30}stealth\b"),
        "payoff_counter": (r"\bcounter stance\b",),
        "payoff_charge": (r"\bcharged\b", r"\bpower charge\b", r"\benergy charge\b"),
    }
    positive_benefit = re.compile(r"\b(?:damage|attack|heal|spirit|next turns?|tu cost|increased|reduced to 0)\b")
    payoff_conditions = {
        "payoff_burn": (r"\b(?:if|when|while|against|each time|targets? that|targets? (?:is|are)|(?:all )?(?:other )?allies? that|allies? (?:is|are)).{0,90}\b(?:burning|burned)\b", r"\b(?:burning|burned)\b.{0,60}\b(?:ally|allies|enemy|enemies|target|targets)\b"),
        "payoff_poison": (r"\b(?:if|when|while|against|each time|targets? that|targets? (?:is|are)|(?:all )?(?:other )?allies? that|allies? (?:is|are)).{0,90}\bpoisoned\b", r"\bpoisoned\b.{0,60}\b(?:ally|allies|enemy|enemies|target|targets)\b"),
        "payoff_sleep": (r"\b(?:if|when|while|against|each time|targets? that|targets? (?:is|are)|(?:all )?(?:other )?allies? that|allies? (?:is|are)).{0,90}\b(?:sleeping|asleep)\b", r"\b(?:sleeping|asleep)\b.{0,60}\b(?:ally|allies|enemy|enemies|target|targets)\b"),
        "payoff_stun": (r"\b(?:if|when|while|against|each time|targets? that|targets? (?:is|are)|(?:all )?(?:other )?allies? that|allies? (?:is|are)).{0,90}\bstunned\b", r"\bstunned\b.{0,60}\b(?:ally|allies|enemy|enemies|target|targets)\b"),
        "payoff_frostburn": (r"\b(?:if|when|while|against|each time|targets? that|targets? (?:is|are)).{0,90}\bfrostburned\b",),
        "payoff_stealth": (r"\b(?:if|when|while|each time).{0,90}\b(?:stealthed|stealth status)\b",),
        "payoff_counter": (r"\b(?:if|when|while).{0,90}\bcounter stance\b",),
        "payoff_charge": (r"\b(?:if|when|while|each time).{0,90}\b(?:charged|power charge|energy charge)\b",),
    }
    negative_benefit = (
        "minus ", "less damage", "damage is reduced", "damage reduced", "cannot ", "not ",
        "without ", "remove", "purif", "no ally", "no allies", "non-burning", "non-poisoned",
        "non-sleeping", "non-stunned",
    )
    status_outcomes = {
        "payoff_burn": (r"\b(?:grant|grants|granted|become|becomes|will be)\b.{0,60}\bburn(?:ing|ed| status)?\b",),
        "payoff_poison": (r"\b(?:grant|grants|granted|become|becomes|will be)\b.{0,60}\bpoison(?:ed| status)?\b",),
        "payoff_sleep": (r"\b(?:grant|grants|granted|put|puts|will be)\b.{0,60}\b(?:sleep|asleep)\b",),
        "payoff_stun": (r"\b(?:stun|stuns|get|gets|will be|are)\b.{0,40}\bstunned?\b", r"\bstunned for\b"),
        "payoff_frostburn": (r"\b(?:grant|grants|granted|will be)\b.{0,60}\bfrostburn(?:ed)?\b",),
        "payoff_stealth": (r"\b(?:grant|grants|granted|gain|gains)\b.{0,60}\bstealth\b",),
        "payoff_counter": (r"\b(?:grant|grants|granted|gain|gains)\b.{0,60}\bcounter stance\b",),
        "payoff_charge": (r"\b(?:grant|grants|granted|gain|gains)\b.{0,60}\b(?:power |energy )?charges?\b",),
    }
    for feature, statuses in payoff_statuses.items():
        for clause in clauses:
            if feature == "payoff_burn" and "frostburn" in clause:
                continue
            if not any(re.search(status, clause) for status in statuses):
                continue
            if any(fragment in clause for fragment in ("immunity", " ward", "cannot be", "prevents ", "takes the stun", "influence the turn order")):
                continue
            if any(fragment in clause for fragment in negative_benefit):
                continue
            if any(re.search(pattern, clause) for pattern in status_outcomes.get(feature, ())):
                continue
            if positive_benefit.search(clause) and any(re.search(pattern, clause) for pattern in payoff_conditions.get(feature, ())):
                add(feature, "benefits_from", target_of(clause))
                break

    # Support scope is explicit: self-only healing/cleansing is not team sustain.
    for clause in clauses:
        if re.search(r"\b(?:all allies|all allied units|ally team)\b.{0,90}\b(?:heal|healed|recover|restore)\b|\b(?:heal|heals|restore|restores)\b.{0,90}\ball allies\b", clause):
            add("role_healer", "provides", "allies")
            add("role_team_healer", "provides", "allies")
        elif re.search(r"\b(?:an ally|another ally|allies)\b.{0,80}\b(?:heal|healed|recover|restore)\b|\b(?:heal|heals|restore|restores)\b.{0,80}\b(?:an ally|another ally|allies)\b", clause):
            add("role_healer", "provides", "allies")
            add("role_ally_healer", "provides", "allies")
        elif re.search(r"\b(?:this unit|the user|user)\b.{0,80}\b(?:heal|heals|recovers?|restores?)\b|\b(?:heal|heals)\b.{0,50}\b(?:this unit|the user|user)\b", clause):
            add("role_self_sustain", "provides", "self")

        if re.search(r"\b(?:all allies|all allied units|all other allies)\b.{0,80}\bpurif", clause):
            add("role_cleanser", "removes", "allies")
            add("role_team_cleanser", "removes", "allies")
        elif target_of(clause) == "allies" and re.search(r"\bpurif(?:y|ies|ied)\b", clause):
            add("role_cleanser", "removes", "allies")
        elif re.search(r"\b(?:this unit|the user|user)\b.{0,80}\bpurif|\bpurif(?:y|ies)\b.{0,60}\b(?:this unit|the user|user)\b", clause):
            add("role_self_cleanser", "removes", "self")

    if re.search(r"\b(?:allies|ally|the user|user) gain(?:s)? (?:\d+ |one )?spirit\b", text) or "steals spirit" in text:
        add("resource_spirit", "provides", "allies")
    if re.search(r"\b(?:give|gives|grant|grants)\b.{0,100}\bnext turns?\b", text) or re.search(r"\breduc(?:e|es|ing)\b.{0,100}\btu to 0\b", text):
        add("tempo_turn", "provides", "allies")
    if re.search(r"\badds? (?:a|an|\d+)\b.{0,100}\ballied reinforcements\b", text) or re.search(r"\bsummons?\b", text):
        add("summon", "produces", "allies")
        add("timing_reinforcement_add", "produces", "allies", timing="reinforcement")

    if re.search(r"\bthis unit (?:enters|entered) (?:the battlefield|battle) from (?:the )?(?:allied )?reinforcements\b|\btriggered when this unit enters the battlefield from", text):
        add("timing_entry_self", "triggers", "self", timing="entry")
    if re.search(r"\bwhen this unit is defeated\b|\bif this unit is defeated\b", text):
        add("timing_death_self", "triggers", "self", timing="death")
    if re.search(r"\b(?:is|counts as|considered) (?:a )?revenge passive\b|\brevenge passive\b.{0,60}\btriggers?\b", text) and not re.search(r"\b(?:not considered|ignores?) (?:a )?revenge\b", text):
        add("timing_revenge", "triggers", "self", timing="revenge")

    if re.search(r"\b(?:endure|survive any damage|survives? with 1 ?hp|would be defeated.{0,70}instead survives)\b", text):
        add("defense_hold_ground", "provides", "self")
    if re.search(r"\b(?:this unit|the user|all allies|an ally|allied units)\b.{0,80}\b(?:has|have|gain|gains|granted|receive|receives)\b.{0,60}\b(?:armor|barrier|damage reduction|fortified)\b", text):
        add("role_defender", "protects", target_of(text))
        add("defense_armor", "provides", target_of(text))
    for clause in clauses:
        if any(fragment in clause for fragment in ("cannot become", "cannot be redirected", "not a guardian")):
            continue
        guardian_actor = re.search(
            r"\b(?:this unit|the user|user)\b.{0,45}\b(?:is|become|becomes|will become|counts as|is considered) (?:a )?guardian\b",
            clause,
        )
        guardian_redirect = re.search(
            r"\b(?:this unit\b.{0,100}\bredirect(?:s|ed)?\b|redirect(?:s|ed)?\b.{0,70}\bto this unit\b)",
            clause,
        )
        if guardian_actor or guardian_redirect:
            add("role_guardian", "protects", "allies")
            break

    for status in ("burn", "poison", "sleep", "stun"):
        if re.search(rf"\b{status} ward\b", text):
            add(f"ward_{status}", "prevents", "self")
        for clause in scoped_clauses:
            removal_pattern = rf"\b(?:remove|removes|removed|purif(?:y|ies|ied)).{{0,90}}\b{status}\b|\b{status}\b.{{0,70}}\bremoved\b"
            if not re.search(removal_pattern, clause):
                if not (re.search(r"\b(?:remove|removes|removed|purif(?:y|ies|ied))\b", text) and re.search(rf"\b{status}\b", clause)):
                    continue
            target = target_of(clause)
            removal_from_allies = re.search(r"\b(?:from them|from all allies|from allied units)\b", text)
            if removal_from_allies:
                target = "allies"
            elif target == "unknown":
                target = target_of(text)
            add(f"removes_{status}", "removes", target)
            if target == "allies":
                add("role_cleanser", "removes", "allies")
                if re.search(r"\b(?:all allies|all allied units|all other allies)\b", clause):
                    add("role_team_cleanser", "removes", "allies")
                else:
                    add("role_ally_cleanser", "removes", "allies")
    if "when a unit has frostburn" in text and "granted the burn status effect" in text:
        add("converts_frostburn_to_burn", "converts", "enemies", status_variant="frostburn")
    return list(found.values())


def description_features(description: Any) -> List[str]:
    """Compatibility wrapper used by semantic tests and downstream tools."""
    return sorted({row["feature"] for row in description_feature_records(description)})


def feature_evidence_for_entry(row: Dict[str, Any]) -> List[Dict[str, Any]]:
    refs = row.get("refs") if isinstance(row.get("refs"), dict) else {}
    resolved = row.get("resolved") if isinstance(row.get("resolved"), dict) else {}
    raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
    matched: Dict[str, Dict[str, Any]] = {}

    def add(feature: str, source: str, confidence: float, details: Dict[str, Any] | None = None) -> None:
        if feature not in FEATURE_STRENGTH:
            return
        details = details or receipt(
            feature,
            relation=(
                "produces" if feature.startswith("applies_") or feature == "summon"
                else "benefits_from" if feature.startswith("payoff_")
                else "prevents" if feature.startswith("ward_")
                else "removes" if feature.startswith("removes_")
                else "triggers" if feature.startswith("timing_")
                else "provides"
            ),
        )
        current = matched.setdefault(feature, {
            "feature": feature,
            "strength": FEATURE_STRENGTH[feature],
            "confidence": 0.0,
            "sources": [],
            "relations": [],
            "receipts": [],
        })
        current["confidence"] = max(float(current["confidence"]), confidence)
        # Keep the compact source summary complete so every typed receipt can be
        # audited back to a listed authority. Evidence volume is bounded by the
        # resolved entry itself, so silently truncating here only breaks provenance.
        if source not in current["sources"]:
            current["sources"].append(source)
        relation = str(details.get("relation") or "provides")
        if relation not in current["relations"]:
            current["relations"].append(relation)
        typed_receipt = {
            "source": source,
            "sourceScope": source_scope(source),
            "confidence": confidence,
            **{key: value for key, value in details.items() if key != "feature" and value not in (None, "", [], {})},
        }
        if typed_receipt not in current["receipts"]:
            current["receipts"].append(typed_receipt)

    for collection_name, identifier_confidence in (("activeSkills", 0.98), ("passives", 0.90)):
        abilities = resolved.get(collection_name) if isinstance(resolved.get(collection_name), dict) else {}
        for ability_id, ability in abilities.items():
            source_base = f"resolved.{collection_name}.{ability_id}"
            for feature in identifier_features(ability_id):
                add(feature, f"{source_base}#identifier", identifier_confidence)
            if not isinstance(ability, dict):
                continue
            config = ability.get("config") if isinstance(ability.get("config"), dict) else {}
            negative_payoffs = configuration_negative_payoffs(config)
            for record in configuration_feature_records(config):
                add(record["feature"], f"{source_base}.config", 0.99, record)
            for status in negative_payoffs:
                feature = f"penalized_by_{status}"
                add(feature, f"{source_base}.config", 0.99, receipt(feature, relation="penalized_by", target_team="allies", trigger="ability_scaler"))
            localization = ability.get("localization") if isinstance(ability.get("localization"), dict) else {}
            description = localization.get("description")
            if description:
                for record in description_feature_records(description):
                    if record["feature"].startswith("payoff_") and record["feature"].removeprefix("payoff_") in negative_payoffs:
                        continue
                    add(record["feature"], f"{source_base}.localization.description", 0.84, record)

    for collection_name, confidence in (("activeSkills", 0.94), ("passives", 0.88)):
        for source, identifier in iter_scalar_identifiers(refs.get(collection_name), f"refs.{collection_name}"):
            for feature in identifier_features(identifier):
                add(feature, source, confidence)
        for source, identifier in iter_scalar_identifiers(raw.get(collection_name), f"raw.{collection_name}"):
            for feature in identifier_features(identifier):
                add(feature, source, confidence)

    if raw.get("summonableMonsters") or refs.get("summonableMonsters"):
        add("summon", "raw.summonableMonsters", 1.0, receipt("summon", relation="produces", target_team="allies", timing="reinforcement"))
        add("timing_reinforcement_add", "raw.summonableMonsters", 1.0, receipt("timing_reinforcement_add", relation="produces", target_team="allies", timing="reinforcement"))
    if raw.get("leaderBuff") or refs.get("leaderBuff") or row.get("leaderSkills"):
        add("leader", "raw.leaderBuff", 1.0)
    return sorted(matched.values(), key=lambda item: item["feature"])


def build_feature_evidence(entries: Iterable[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    result: Dict[str, List[Dict[str, Any]]] = {}
    for row in entries:
        key = entry_key(row)
        evidence = feature_evidence_for_entry(row)
        if key and evidence:
            result[key] = evidence
    return result


def finite_number(value: Any, fallback: Any = None) -> Any:
    if isinstance(value, bool) or value is None:
        return fallback
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if number != number or number in (float("inf"), float("-inf")):
        return fallback
    return int(number) if number.is_integer() else number


def skill_profile_for_entry(row: Dict[str, Any]) -> Dict[str, Any]:
    resolved = row.get("resolved") if isinstance(row.get("resolved"), dict) else {}
    active = resolved.get("activeSkills") if isinstance(resolved.get("activeSkills"), dict) else {}
    requested_order = row.get("activeSkills") if isinstance(row.get("activeSkills"), list) else []
    ordered_ids = [str(value) for value in requested_order if str(value) in active]
    ordered_ids.extend(str(value) for value in active if str(value) not in ordered_ids)
    skills: List[Dict[str, Any]] = []
    for skill_id in ordered_ids:
        payload = active.get(skill_id)
        if not isinstance(payload, dict) or payload.get("found") is False:
            continue
        ability = payload.get("ability") if isinstance(payload.get("ability"), dict) else {}
        config = payload.get("config") if isinstance(payload.get("config"), dict) else {}
        localization = payload.get("localization") if isinstance(payload.get("localization"), dict) else {}
        flags = config.get("flags") if isinstance(config.get("flags"), list) else []
        components = config.get("components") if isinstance(config.get("components"), list) else []
        use_limit = finite_number(ability.get("useLimit"), 0)
        skills.append({
            "id": str(payload.get("id") or skill_id),
            "name": str(localization.get("name") or payload.get("id") or skill_id),
            "description": str(localization.get("description") or ""),
            "tuCost": finite_number(ability.get("tuCost")),
            "spiritGain": max(0, finite_number(ability.get("spiritGain"), 0)),
            "spiritCost": max(0, finite_number(ability.get("spiritCost"), 0)),
            "useLimit": use_limit if use_limit and use_limit > 0 else None,
            "targeting": str(config.get("targetingData") or ""),
            "useCondition": str(config.get("useCondition") or ""),
            "flags": [str(value) for value in flags if str(value).strip()],
            "components": [str(value) for value in components if str(value).strip()],
            "source": f"resolved.activeSkills.{skill_id}",
        })
    return {
        "sourceId": entry_key(row),
        "family": family_key(row),
        "skills": skills,
    }


def build_skill_profiles(entries: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    result: Dict[str, Dict[str, Any]] = {}
    for row in entries:
        profile = skill_profile_for_entry(row)
        if profile["sourceId"] and profile["skills"]:
            result[profile["sourceId"]] = profile
    return result


LEADER_ELEMENT_BY_CONDITION = {
    "IsFire": "fire",
    "IsWater": "water",
    "IsAir": "storm",
    "IsEarth": "earth",
    "IsLife": "light",
    "IsDeath": "dark",
}


def leader_profile_for_entry(row: Dict[str, Any], authority: Dict[str, Any]) -> Dict[str, Any] | None:
    raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
    refs = row.get("refs") if isinstance(row.get("refs"), dict) else {}
    candidates = [row.get("leaderSkills"), raw.get("leaderBuff"), refs.get("leaderBuff")]
    leader_id = ""
    for value in candidates:
        if isinstance(value, list):
            value = next((item for item in value if str(item).strip()), "")
        if isinstance(value, dict):
            value = value.get("id") or value.get("sourceId") or ""
        if str(value or "").strip():
            leader_id = str(value).strip()
            break
    if not leader_id:
        return None
    localized = authority.get(leader_id) if isinstance(authority.get(leader_id), dict) else {}
    condition = str(localized.get("condition") or raw.get("leaderBuffCondition") or refs.get("leaderBuffCondition") or "")
    affected = str(localized.get("affected") or "")
    description = str(localized.get("description") or "")
    percentages = [float(value) for value in re.findall(r"(\d+(?:\.\d+)?)\s*%", f"{affected} {description}")]
    element = LEADER_ELEMENT_BY_CONDITION.get(condition, "")
    plan = "stealth" if condition == "IsSneakAttacker" else "blood" if condition == "IsThrower" else ""
    match_kind = "element" if element else "story_family" if condition == "IsStory" else "plan" if plan else "allies"
    return {
        "sourceId": entry_key(row),
        "family": family_key(row),
        "id": leader_id,
        "name": str(localized.get("name") or leader_id),
        "description": description,
        "affected": affected,
        "condition": condition,
        "matchKind": match_kind,
        "elements": [element] if element else [],
        "plans": [plan] if plan else [],
        "percentages": percentages,
        "generic": condition in {"", "AlwaysTrue"},
        "source": "leader_skill_localization.json" if localized else "character raw leaderBuff",
        "authorityResolved": bool(localized),
    }


def build_leader_profiles(entries: Iterable[Dict[str, Any]], authority: Any) -> Dict[str, Dict[str, Any]]:
    skills = authority.get("skills") if isinstance(authority, dict) and isinstance(authority.get("skills"), dict) else {}
    result: Dict[str, Dict[str, Any]] = {}
    for row in entries:
        profile = leader_profile_for_entry(row, skills)
        if profile and profile["sourceId"]:
            result[profile["sourceId"]] = profile
    return result


def main() -> int:
    repo = find_repo_root(Path(__file__).resolve())
    entries_root = repo / "apkfiles" / "entries"
    bundles = entries_root / "bundles"

    character_families = load_json(bundles / "character_families.bundle.json", {})
    characters = load_json(bundles / "characters.bundle.json", {})
    weapons = load_json(bundles / "weapons.bundle.json", {})
    accessories = load_json(bundles / "accessories.bundle.json", {})
    bosses = load_json(bundles / "bosses.bundle.json", {})
    knowledge = load_json(entries_root / "runtime" / "optimizer_knowledge.json", {})
    leader_authority = load_json(entries_root / "localization" / "leader_skill_localization.json", {})
    character_rows = [row for row in characters.get("entries", []) if isinstance(row, dict)]

    tag_paths = [
        repo / "data" / "character_tags.json",
        repo / "data" / "character_tags_additions.json",
        entries_root / "maps" / "character_tags.json",
    ]
    tag_payloads: List[Any] = []
    tag_sources: List[Dict[str, Any]] = []
    warnings: List[str] = []
    errors: List[str] = []
    for path in tag_paths:
        payload, source_report = load_json_checked(path)
        tag_sources.append(source_report)
        if source_report["status"] == "invalid":
            errors.append(f"Invalid tag authority: {path}: {source_report.get('error')}")
        elif source_report["status"] == "missing":
            warnings.append(f"Missing optional tag authority: {path}")
        if payload is not None:
            tag_payloads.append(payload)

    tag_rows = merge_tag_rows(*tag_payloads)
    tags = index_tags(tag_rows)
    if not tags:
        warnings.append("Curated tag authority is empty; generated feature evidence is required")

    families_index, family_collisions = index_unique(character_families.get("entries", []), family_key, "characters")
    entry_index, entry_collisions = index_unique(character_rows, entry_key, "characterEntries")
    weapons_index, weapon_collisions = index_unique(weapons.get("entries", []), generic_key, "weapons")
    accessories_index, accessory_collisions = index_unique(accessories.get("entries", []), generic_key, "accessories")
    bosses_index, boss_collisions = index_unique(bosses.get("entries", []), generic_key, "bosses")
    collisions = family_collisions + entry_collisions + weapon_collisions + accessory_collisions + boss_collisions
    if collisions:
        errors.append(f"Runtime identity collisions detected: {len(collisions)}")

    feature_evidence = build_feature_evidence(character_rows)
    skill_profiles = build_skill_profiles(character_rows)
    leader_profiles = build_leader_profiles(character_rows, leader_authority)
    evidence_count = sum(len(rows) for rows in feature_evidence.values())
    skill_profile_skills = sum(len(row.get("skills") or []) for row in skill_profiles.values())
    skill_profiles_with_spirit_gain = sum(
        1 for row in skill_profiles.values() for skill in row.get("skills") or []
        if finite_number(skill.get("spiritGain"), 0) > 0
    )
    skill_profiles_with_spirit_cost = sum(
        1 for row in skill_profiles.values() for skill in row.get("skills") or []
        if finite_number(skill.get("spiritCost"), 0) > 0
    )
    skill_profiles_with_tu = sum(
        1 for row in skill_profiles.values() for skill in row.get("skills") or []
        if finite_number(skill.get("tuCost")) is not None
    )
    skill_profile_entries_by_element: Dict[str, int] = {}
    skill_profile_gain_by_element: Dict[str, int] = {}
    skill_profile_cost_by_element: Dict[str, int] = {}
    for source_id, profile in skill_profiles.items():
        element = str(entry_index.get(source_id, {}).get("element") or "unknown").lower()
        skill_profile_entries_by_element[element] = skill_profile_entries_by_element.get(element, 0) + 1
        for skill in profile.get("skills") or []:
            if finite_number(skill.get("spiritGain"), 0) > 0:
                skill_profile_gain_by_element[element] = skill_profile_gain_by_element.get(element, 0) + 1
            if finite_number(skill.get("spiritCost"), 0) > 0:
                skill_profile_cost_by_element[element] = skill_profile_cost_by_element.get(element, 0) + 1
    if not feature_evidence:
        errors.append("Resolved character data produced no feature evidence")
    if not skill_profiles:
        errors.append("Resolved character data produced no structured skill profiles")
    expected_leader_entries = sum(
        1 for row in character_rows
        if (row.get("raw") if isinstance(row.get("raw"), dict) else {}).get("leaderBuff") or row.get("leaderSkills")
    )
    unresolved_leader_profiles = [source_id for source_id, profile in leader_profiles.items() if not profile.get("authorityResolved")]
    if expected_leader_entries and len(leader_profiles) != expected_leader_entries:
        errors.append(f"Leader profile count mismatch: expected {expected_leader_entries}, generated {len(leader_profiles)}")
    if unresolved_leader_profiles:
        warnings.append(f"Leader localization unresolved for {len(unresolved_leader_profiles)} character entries")
    feature_counts: Dict[str, int] = {}
    feature_element_counts: Dict[str, Dict[str, int]] = {}
    feature_relation_counts: Dict[str, int] = {}
    feature_target_counts: Dict[str, int] = {}
    feature_timing_counts: Dict[str, int] = {}
    feature_variant_counts: Dict[str, int] = {}
    suspicious_evidence: List[Dict[str, Any]] = []
    for source_id, items in feature_evidence.items():
        element = str(entry_index.get(source_id, {}).get("element") or "unknown").lower()
        for item in items:
            feature = str(item.get("feature") or "")
            feature_counts[feature] = feature_counts.get(feature, 0) + 1
            by_element = feature_element_counts.setdefault(feature, {})
            by_element[element] = by_element.get(element, 0) + 1
            for row_receipt in item.get("receipts") or []:
                relation = str(row_receipt.get("relation") or "unknown")
                target = str(row_receipt.get("targetTeam") or "unknown")
                timing = str(row_receipt.get("timing") or "")
                variant = str(row_receipt.get("statusVariant") or "")
                feature_relation_counts[f"{feature}:{relation}"] = feature_relation_counts.get(f"{feature}:{relation}", 0) + 1
                feature_target_counts[f"{feature}:{target}"] = feature_target_counts.get(f"{feature}:{target}", 0) + 1
                if timing:
                    feature_timing_counts[f"{feature}:{timing}"] = feature_timing_counts.get(f"{feature}:{timing}", 0) + 1
                if variant:
                    feature_variant_counts[f"{feature}:{variant}"] = feature_variant_counts.get(f"{feature}:{variant}", 0) + 1
            source_blob = " ".join(str(source) for source in item.get("sources") or []).lower()
            reasons = []
            if "activeskillsai" in source_blob:
                reasons.append("AI targeting metadata")
            if feature == "applies_burn" and "frostburn" in source_blob:
                reasons.append("Frostburn classified as normal Burn setup")
            if feature == "role_healer" and "healthy" in source_blob:
                reasons.append("healthy substring classified as healing")
            if feature.startswith("applies_") and any(token in source_blob for token in ("immunitylist", "revengeeffectstoskip")):
                reasons.append("negative/excluded status list")
            if reasons:
                suspicious_evidence.append({"sourceId": source_id, "feature": feature, "reasons": reasons, "sources": item.get("sources") or []})
    if suspicious_evidence:
        errors.append(f"Context-invalid feature evidence detected: {len(suspicious_evidence)}")

    report = {
        "schemaVersion": 3,
        "generatedAt": int(time.time()),
        "status": "failed" if errors else "warning" if warnings else "ok",
        "errors": errors,
        "warnings": warnings,
        "counts": {
            "characters": len(families_index),
            "characterEntries": len(entry_index),
            "sourceCharacterEntries": len(character_rows),
            "weapons": len(weapons_index),
            "accessories": len(accessories_index),
            "bosses": len(bosses_index),
            "tags": len(tags),
            "tagRows": len(tag_rows),
            "featureEvidenceEntries": len(feature_evidence),
            "featureEvidenceItems": evidence_count,
            "featureEvidenceByFeature": dict(sorted(feature_counts.items())),
            "featureEvidenceByElement": {feature: dict(sorted(counts.items())) for feature, counts in sorted(feature_element_counts.items())},
            "featureEvidenceByRelation": dict(sorted(feature_relation_counts.items())),
            "featureEvidenceByTarget": dict(sorted(feature_target_counts.items())),
            "featureEvidenceByTiming": dict(sorted(feature_timing_counts.items())),
            "featureEvidenceByVariant": dict(sorted(feature_variant_counts.items())),
            "skillProfileEntries": len(skill_profiles),
            "skillProfileSkills": skill_profile_skills,
            "skillProfilesWithSpiritGain": skill_profiles_with_spirit_gain,
            "skillProfilesWithSpiritCost": skill_profiles_with_spirit_cost,
            "skillProfilesWithTU": skill_profiles_with_tu,
            "leaderProfileEntries": len(leader_profiles),
            "leaderProfilesResolved": len(leader_profiles) - len(unresolved_leader_profiles),
            "leaderProfilesUnresolved": len(unresolved_leader_profiles),
            "skillProfileEntriesByElement": dict(sorted(skill_profile_entries_by_element.items())),
            "skillProfilesWithSpiritGainByElement": dict(sorted(skill_profile_gain_by_element.items())),
            "skillProfilesWithSpiritCostByElement": dict(sorted(skill_profile_cost_by_element.items())),
        },
        "tagSources": tag_sources,
        "identityCollisions": collisions,
        "suspiciousFeatureEvidence": suspicious_evidence,
        "unresolvedLeaderProfiles": unresolved_leader_profiles,
        "output": str(repo / OUT_REL),
    }
    write_json(repo / REPORT_REL, report)
    if errors:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    runtime = {
        "schemaVersion": 5,
        "generatedAt": int(time.time()),
        "characters": families_index,
        "characterEntries": entry_index,
        "weapons": weapons_index,
        "accessories": accessories_index,
        "bosses": bosses_index,
        "tags": tags,
        "tagRows": tag_rows,
        "tagAuthority": {
            "status": "ok" if tags else "warning",
            "sourceCounts": {Path(row["path"]).as_posix(): row.get("count", 0) for row in tag_sources},
            "warnings": [warning for warning in warnings if "tag" in warning.lower()],
            "errors": [error for error in errors if "tag" in error.lower()],
        },
        "featureEvidence": feature_evidence,
        "skillProfiles": skill_profiles,
        "leaderProfiles": leader_profiles,
        "optimizerKnowledge": knowledge,
        "identityCollisions": [],
        "runtimeFlags": {
            "usesAI": True,
            "usesScalers": True,
            "usesStatuses": True,
            "usesPassives": True,
            "usesLeaderSkills": True,
            "usesSummons": True,
            "usesTags": bool(tags),
            "usesFeatureEvidence": bool(feature_evidence),
            "usesSkillProfiles": bool(skill_profiles),
            "usesLeaderProfiles": bool(leader_profiles),
        },
        "sources": {
            "tags": tag_sources,
            "featureEvidence": "characters.bundle.json resolved refs/configuration/localization",
            "skillProfiles": "characters.bundle.json resolved.activeSkills structured ability/config/localization fields",
            "leaderProfiles": "leader_skill_localization.json joined to source-indexed character leaderBuff records",
            "knowledge": "apkfiles/entries/runtime/optimizer_knowledge.json",
        },
    }
    existing_runtime = load_json(repo / OUT_REL, {})
    if isinstance(existing_runtime, dict):
        existing_semantic = {key: value for key, value in existing_runtime.items() if key != "generatedAt"}
        runtime_semantic = {key: value for key, value in runtime.items() if key != "generatedAt"}
        if existing_semantic == runtime_semantic and isinstance(existing_runtime.get("generatedAt"), int):
            runtime["generatedAt"] = existing_runtime["generatedAt"]
    write_json(repo / OUT_REL, runtime)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
