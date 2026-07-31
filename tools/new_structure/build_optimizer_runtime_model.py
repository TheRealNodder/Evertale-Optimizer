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
    "summon": 1.2,
    "payoff_blood": 1.5,
    "payoff_crisis": 1.45,
    "payoff_survivor": 1.45,
    "role_guardian": 1.35,
    "role_cleanser": 1.35,
    "role_healer": 1.25,
    "role_reviver": 1.35,
    "resource_spirit": 1.3,
    "tempo_turn": 1.3,
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
        "whileburn", "burningallies", "burnarmor", "unlessburning",
        "burninggoddess", "burningjourney", "burnregeneration", "regeneratewhenburn",
    ),
    "applies_poison": (
        "poisontouch", "poisonattack", "poisonskin", "poisonrevenge", "poisontrap",
        "poisonentrance", "megapoisontouch", "megapoisonjolt", "megapoisonpassive",
        "megapoisonaura", "superpoisontouch", "superpoisonskin", "lethalpoison",
        "poisonparalysis", "hypnosis",
    ),
    "payoff_poison": (
        "poisoneater", "poisondevour", "poisonfury", "poisondrain", "poisoncharge",
        "poisonmomentum", "momentumstrikepoison", "poisonkiller", "poisonlust",
        "poisonturn", "enemypoisoned", "whileenemypoisoned",
    ),
    "applies_sleep": (
        "sleepsingle", "sleepdouble", "sleepbomb", "sleepattack", "forcesleep",
        "massforcesleep", "sleepwave", "sleeprevenge", "sleepskin", "sleepentrance",
        "sleepchance", "hypnosis",
    ),
    "payoff_sleep": (
        "dreamhunt", "dreamhunter", "dreambuster", "dreamdevour", "nightmare",
        "killsleep", "sleepstrike", "sleepingenemy",
    ),
    "payoff_stun": ("timestrike", "timebuster", "stunburst", "stunnedenemy"),
    "summon": ("summontoken", "summonangel", "summonminion", "summonmass", "summonmagical", "summondoll", "summonsnow", "summonjeanne"),
    "payoff_blood": ("bloodfury", "bloodthirst", "vicariousblood"),
    "payoff_crisis": ("crisis", "lowhp", "hp25", "desperate"),
    "payoff_survivor": ("survivor",),
    "role_guardian": (
        "autoprotect", "protectteammates", "grantprotectteammates", "promisedguard",
        "puppeteerguard", "emergencyprotect", "protectallies", "guardianangel",
        "guardpassive", "guardblockade", "guardianevasion",
    ),
    "role_cleanser": ("purify", "cleanse", "removenegative", "removedebuff"),
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
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
    if "stun" in token and not any(fragment in token for fragment in STUN_SETUP_EXCLUSIONS):
        features.add("applies_stun")
    if (
        ("heal" in token or "regenerat" in token or "lifesteal" in token)
        and "healthy" not in token
        and "healthboost" not in token
    ):
        features.add("role_healer")
    return sorted(features)


def description_features(description: Any) -> List[str]:
    text = re.sub(r"\s+", " ", str(description or "")).strip().lower()
    if not text:
        return []
    features = set()
    sentences = [sentence.strip() for sentence in re.split(r"[.!?]+", text) if sentence.strip()]

    setup_patterns = {
        "applies_burn": (
            r"\bgrant(?:s|ed)?\b.{0,100}\bburn status effect\b",
            r"\bburns\b.{0,70}\b(?:ally|allies|enemy|enemies|target|unit|user)\b",
        ),
        "applies_poison": (
            r"\bgrant(?:s|ed)?\b.{0,100}\b(?:mega |super |lethal )?poison(?: status effect)?\b",
            r"\bpoisons?\b.{0,70}\b(?:enemy|enemies|target|unit)\b",
        ),
        "applies_sleep": (
            r"\bgrant(?:s|ed)?\b.{0,100}\b(?:deep )?sleep status effect\b",
            r"\bput(?:s)?\b.{0,70}\bto sleep\b",
        ),
        "applies_stun": (
            r"\bstuns?\b.{0,100}\b(?:enemy|enemies|target|unit)\b",
            r"\b(?:enemy|enemies|target|unit)\b.{0,100}\bstunned for\b",
        ),
    }
    blocked_setup = {
        "applies_burn": ("frostburn", "burn ward", "cannot be burned", "burn immunity"),
        "applies_poison": ("poison ward", "cannot be poisoned", "poison immunity"),
        "applies_sleep": ("sleep ward", "cannot be put to sleep", "sleep immunity"),
        "applies_stun": ("stun ward", "cannot be stunned", "stun immunity", "stun absorber"),
    }
    for feature, patterns in setup_patterns.items():
        for sentence in sentences:
            # Frostburn is its own delayed sleep/control mechanic.  It must not
            # satisfy the normal Burn setup contract merely because its help
            # text describes a later conversion into Burn.
            if feature == "applies_burn" and "frostburn" in sentence:
                continue
            scrubbed = sentence
            if any(fragment in scrubbed for fragment in blocked_setup[feature]):
                continue
            if any(re.search(pattern, scrubbed) for pattern in patterns):
                features.add(feature)
                break

    payoff_statuses = {
        # Word boundaries are mandatory here: plain substring matching made
        # "burned" match inside "frostburned" and fabricated normal-Burn
        # payoff evidence for Frostburn-only skills.
        "payoff_burn": (r"(?<!frost)(?<!non-)(?<!not )\bburning\b", r"(?<!frost)(?<!non-)(?<!not )\bburned\b", r"\bburn status\b"),
        "payoff_poison": (r"(?<!non-)(?<!not )\bpoisoned\b", r"\bpoison status\b", r"\bmega poison\b", r"\bsuper poison\b", r"\blethal poison\b"),
        "payoff_sleep": (r"(?<!non-)(?<!not )\bsleeping\b", r"(?<!not )\basleep\b", r"\bsleep status\b"),
        "payoff_stun": (r"(?<!non-)(?<!not )\bstunned\b", r"\bstun status\b"),
    }
    benefit_words = ("damage", "attack", "heal", "spirit", "next turn", "tu cost", "usable", "unlocked", "increased", "reduced")
    condition_words = (" if ", " when ", " while ", " against ", " for each ", " per ", " targets that ", " target is ", " allies that ", " user has ")
    for feature, statuses in payoff_statuses.items():
        for sentence in sentences:
            if not any(re.search(status, sentence) for status in statuses):
                continue
            if any(blocked in sentence for blocked in ("immunity", " ward", "cannot be", "prevents ")):
                continue
            if any(word in sentence for word in benefit_words) and any(word in f" {sentence} " for word in condition_words):
                features.add(feature)
                break

    if any(re.search(pattern, text) for pattern in (
        r"\bheals?\b.{0,80}\b(?:user|ally|allies|unit)\b",
        r"\b(?:user|ally|allies|unit)\b.{0,80}\bheals?\b",
        r"\brecovers? hp\b",
        r"\brestores?\b.{0,50}\bhp\b",
    )):
        features.add("role_healer")
    if re.search(r"\bpurif(?:y|ies)\b", text) or "removes negative status effects" in text:
        features.add("role_cleanser")
    if re.search(r"\b(?:allies|ally|the user|user) gain(?:s)? (?:\d+ |one )?spirit\b", text):
        features.add("resource_spirit")
    if re.search(r"\b(?:give|gives|grant|grants)\b.{0,100}\bnext turns?\b", text) or re.search(r"\breduc(?:e|es|ing)\b.{0,100}\btu to 0\b", text):
        features.add("tempo_turn")
    if re.search(r"\badds? \d+\b.{0,100}\ballied reinforcements\b", text) or re.search(r"\bsummons?\b", text):
        features.add("summon")
    return sorted(features)


def feature_evidence_for_entry(row: Dict[str, Any]) -> List[Dict[str, Any]]:
    refs = row.get("refs") if isinstance(row.get("refs"), dict) else {}
    resolved = row.get("resolved") if isinstance(row.get("resolved"), dict) else {}
    raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
    matched: Dict[str, Dict[str, Any]] = {}

    def add(feature: str, source: str, confidence: float) -> None:
        if feature not in FEATURE_STRENGTH:
            return
        current = matched.setdefault(feature, {
            "feature": feature,
            "strength": FEATURE_STRENGTH[feature],
            "confidence": 0.0,
            "sources": [],
        })
        current["confidence"] = max(float(current["confidence"]), confidence)
        if source not in current["sources"] and len(current["sources"]) < 12:
            current["sources"].append(source)

    for collection_name, identifier_confidence in (("activeSkills", 0.98), ("passives", 0.90)):
        abilities = resolved.get(collection_name) if isinstance(resolved.get(collection_name), dict) else {}
        for ability_id, ability in abilities.items():
            source_base = f"resolved.{collection_name}.{ability_id}"
            for feature in identifier_features(ability_id):
                add(feature, f"{source_base}#identifier", identifier_confidence)
            if not isinstance(ability, dict):
                continue
            localization = ability.get("localization") if isinstance(ability.get("localization"), dict) else {}
            description = localization.get("description")
            if description:
                for feature in description_features(description):
                    add(feature, f"{source_base}.localization.description", 0.84)

    for collection_name, confidence in (("activeSkills", 0.94), ("passives", 0.88)):
        for source, identifier in iter_scalar_identifiers(refs.get(collection_name), f"refs.{collection_name}"):
            for feature in identifier_features(identifier):
                add(feature, source, confidence)
        for source, identifier in iter_scalar_identifiers(raw.get(collection_name), f"raw.{collection_name}"):
            for feature in identifier_features(identifier):
                add(feature, source, confidence)

    if raw.get("summonableMonsters") or refs.get("summonableMonsters"):
        add("summon", "raw.summonableMonsters", 1.0)
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
    feature_counts: Dict[str, int] = {}
    feature_element_counts: Dict[str, Dict[str, int]] = {}
    suspicious_evidence: List[Dict[str, Any]] = []
    for source_id, items in feature_evidence.items():
        element = str(entry_index.get(source_id, {}).get("element") or "unknown").lower()
        for item in items:
            feature = str(item.get("feature") or "")
            feature_counts[feature] = feature_counts.get(feature, 0) + 1
            by_element = feature_element_counts.setdefault(feature, {})
            by_element[element] = by_element.get(element, 0) + 1
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
        "schemaVersion": 2,
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
            "skillProfileEntries": len(skill_profiles),
            "skillProfileSkills": skill_profile_skills,
            "skillProfilesWithSpiritGain": skill_profiles_with_spirit_gain,
            "skillProfilesWithSpiritCost": skill_profiles_with_spirit_cost,
            "skillProfilesWithTU": skill_profiles_with_tu,
            "skillProfileEntriesByElement": dict(sorted(skill_profile_entries_by_element.items())),
            "skillProfilesWithSpiritGainByElement": dict(sorted(skill_profile_gain_by_element.items())),
            "skillProfilesWithSpiritCostByElement": dict(sorted(skill_profile_cost_by_element.items())),
        },
        "tagSources": tag_sources,
        "identityCollisions": collisions,
        "suspiciousFeatureEvidence": suspicious_evidence,
        "output": str(repo / OUT_REL),
    }
    write_json(repo / REPORT_REL, report)
    if errors:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    runtime = {
        "schemaVersion": 4,
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
        },
        "sources": {
            "tags": tag_sources,
            "featureEvidence": "characters.bundle.json resolved refs/configuration/localization",
            "skillProfiles": "characters.bundle.json resolved.activeSkills structured ability/config/localization fields",
            "knowledge": "apkfiles/entries/runtime/optimizer_knowledge.json",
        },
    }
    write_json(repo / OUT_REL, runtime)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
