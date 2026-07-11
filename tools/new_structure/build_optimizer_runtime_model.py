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

FEATURE_RULES: Dict[str, Tuple[List[str], float]] = {
    "applies_burn": (["burnattack", "applyburn", "inflictburn", "frostburn", "burnskin"], 1.6),
    "applies_poison": (["poisonattack", "applypoison", "inflictpoison", "megapoison", "lethalpoison"], 1.6),
    "applies_sleep": (["sleepattack", "applysleep", "inflictsleep", "deepsleep", "noxioussleep"], 1.6),
    "applies_stun": (["stunattack", "applystun", "inflictstun", "pushback"], 1.6),
    "payoff_burn": (["burndrive", "burnblast", "burnforce", "burnfrenzy", "burningenemy"], 1.5),
    "payoff_poison": (["poisoneater", "poisondevour", "poisonfury", "poisonedenemy"], 1.5),
    "payoff_sleep": (["dreamhunt", "dreamhunter", "dreamdevour", "sleepingenemy", "nightmare"], 1.5),
    "payoff_stun": (["timestrike", "timebuster", "stunnedenemy", "stunburst"], 1.5),
    "role_guardian": (["guardian", "autoprotect", "protectteammates", "redirectdamage"], 1.35),
    "role_cleanser": (["purify", "cleanse", "removenegative", "removedebuff"], 1.35),
    "role_healer": (["heal", "restorehp", "recoverhp", "regeneration", "lifesteal"], 1.25),
    "role_reviver": (["revive", "resurrect", "returntobattlefield"], 1.35),
    "resource_spirit": (["gainspirit", "addspirit", "spiritrecovery", "painspirit"], 1.3),
    "tempo_turn": (["grantturn", "giveturn", "allyturn", "tureduction", "accelerate", "haste"], 1.3),
    "summon": (["summonablemonsters", "summon", "createminion", "spawnminion"], 1.2),
    "leader": (["leaderbuff", "leaderbuffcondition", "leaderskill"], 1.1),
}

APPLY_FEATURES = {"applies_burn", "applies_poison", "applies_sleep", "applies_stun"}
NEGATIVE_APPLY_WORDS = ("immune", "immunity", "resist", "remove", "purify", "cleanse", "killer")


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
    return str(row.get("family") or row.get("id") or row.get("sourceId") or internal(row).get("sourceId") or "").strip()


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


def scalar_evidence(value: Any, path: str, depth: int = 0) -> Iterable[Tuple[str, str]]:
    if value is None or depth > 7:
        return
    if isinstance(value, (str, int, float, bool)):
        yield path, str(value)
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            yield from scalar_evidence(item, f"{path}[{index}]", depth + 1)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            yield f"{path}.{key}#key", str(key)
            yield from scalar_evidence(item, f"{path}.{key}", depth + 1)


def confidence_for_path(path: str) -> float:
    lower = path.lower()
    if ".config" in lower or ".buffs" in lower or ".conditions" in lower:
        return 0.98
    if ".ability" in lower or lower.startswith("refs.activeskills"):
        return 0.94
    if "passive" in lower or "ai" in lower:
        return 0.88
    if "localization" in lower or "description" in lower:
        return 0.72
    return 0.65


def feature_evidence_for_entry(row: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
    projected_raw = {key: raw.get(key) for key in ("activeSkills", "passives", "leaderBuff", "leaderBuffCondition", "summonableMonsters")}
    sources = [
        *scalar_evidence(row.get("refs", {}), "refs"),
        *scalar_evidence(row.get("resolved", {}), "resolved"),
        *scalar_evidence(projected_raw, "raw"),
    ]
    matched: Dict[str, Dict[str, Any]] = {}
    for path, text in sources:
        token = normalized(text)
        if not token:
            continue
        for feature, (patterns, strength) in FEATURE_RULES.items():
            if not any(pattern in token for pattern in patterns):
                continue
            if feature in APPLY_FEATURES and any(word in token for word in NEGATIVE_APPLY_WORDS):
                continue
            current = matched.setdefault(feature, {"feature": feature, "strength": strength, "confidence": 0.0, "sources": []})
            current["confidence"] = max(float(current["confidence"]), confidence_for_path(path))
            if path not in current["sources"] and len(current["sources"]) < 8:
                current["sources"].append(path)
    return sorted(matched.values(), key=lambda item: item["feature"])


def build_feature_evidence(entries: Iterable[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    result: Dict[str, List[Dict[str, Any]]] = {}
    for row in entries:
        key = entry_key(row)
        evidence = feature_evidence_for_entry(row)
        if key and evidence:
            result[key] = evidence
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
    evidence_count = sum(len(rows) for rows in feature_evidence.values())
    if not feature_evidence:
        errors.append("Resolved character data produced no feature evidence")

    report = {
        "schemaVersion": 1,
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
        },
        "tagSources": tag_sources,
        "identityCollisions": collisions,
        "output": str(repo / OUT_REL),
    }
    write_json(repo / REPORT_REL, report)
    if errors:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    runtime = {
        "schemaVersion": 3,
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
        },
        "sources": {
            "tags": tag_sources,
            "featureEvidence": "characters.bundle.json resolved refs/configuration/localization",
            "knowledge": "apkfiles/entries/runtime/optimizer_knowledge.json",
        },
    }
    write_json(repo / OUT_REL, runtime)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
