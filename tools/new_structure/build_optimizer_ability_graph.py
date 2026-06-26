#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

ROOT_MARKERS = ["apkfiles", "tools"]
OUT_REL = "apkfiles/entries/runtime/optimizer_ability_graph.json"
REPORT_REL = "apkfiles/entries/reports/optimizer_ability_graph_report.json"

RAW_FILES = [
    "Ability.json",
    "AbilityAI.json",
    "Monster.json",
    "Boss.json",
    "Weapon.json",
    "Equipment.json",
]

PERCENT_KEY_RE = re.compile(r"percent|percentage|rate|ratio|multiplier|scale|scaler|boost|bonus|increase|decrease|damage|attack|hp|spirit|tu", re.I)
ABILITY_REF_RE = re.compile(r"ability|skill|passive|leader", re.I)


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root")


def load_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_id(value: Any) -> str:
    return str(value or "").strip()


def get_records(payload: Any) -> Iterable[Tuple[str, Dict[str, Any]]]:
    if isinstance(payload, list):
        for i, row in enumerate(payload):
            if isinstance(row, dict):
                rid = normalize_id(row.get("id") or row.get("Id") or row.get("name") or row.get("Name") or i)
                yield rid, row
    elif isinstance(payload, dict):
        for key, value in payload.items():
            if isinstance(value, dict):
                yield normalize_id(key), value
            elif isinstance(value, list):
                for i, row in enumerate(value):
                    if isinstance(row, dict):
                        rid = normalize_id(row.get("id") or row.get("Id") or row.get("name") or row.get("Name") or f"{key}[{i}]")
                        yield rid, row


def walk_numeric_fields(obj: Any, prefix: str = "") -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                if PERCENT_KEY_RE.search(path):
                    rows.append({"path": path, "value": value})
            elif isinstance(value, (dict, list)):
                rows.extend(walk_numeric_fields(value, path))
    elif isinstance(obj, list):
        for idx, value in enumerate(obj):
            rows.extend(walk_numeric_fields(value, f"{prefix}[{idx}]"))
    return rows


def walk_refs(obj: Any, prefix: str = "") -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            if ABILITY_REF_RE.search(path):
                if isinstance(value, (str, int, float)) and str(value).strip():
                    rows.append({"path": path, "value": str(value)})
                elif isinstance(value, list):
                    for item in value:
                        if isinstance(item, (str, int, float)) and str(item).strip():
                            rows.append({"path": path, "value": str(item)})
            if isinstance(value, (dict, list)):
                rows.extend(walk_refs(value, path))
    elif isinstance(obj, list):
        for idx, value in enumerate(obj):
            rows.extend(walk_refs(value, f"{prefix}[{idx}]"))
    return rows


def infer_effect_tags(record_id: str, row: Dict[str, Any]) -> List[str]:
    text = json.dumps(row, ensure_ascii=False).lower() + " " + record_id.lower()
    tags = set()
    for key in ["burn", "poison", "sleep", "stun", "stealth", "guardian", "protect", "heal", "purify", "cleanse", "spirit", "summon", "rage", "enrage", "tu", "turn", "leader"]:
        if key in text:
            tags.add(key)
    if "damage" in text or "attack" in text:
        tags.add("damage")
    if "multiplier" in text or "scale" in text or "scaler" in text or "percent" in text:
        tags.add("scaler")
    return sorted(tags)


def build_ability_nodes(repo: Path) -> Dict[str, Any]:
    raw_root = repo / "apkfiles"
    ability_nodes: Dict[str, Any] = {}
    source_reports = []

    for file_name in RAW_FILES:
        path = raw_root / file_name
        payload = load_json(path)
        if payload is None:
            source_reports.append({"file": file_name, "status": "missing_or_invalid"})
            continue

        count = 0
        for record_id, row in get_records(payload):
            count += 1
            node_id = f"{Path(file_name).stem}:{record_id}"
            ability_nodes[node_id] = {
                "nodeId": node_id,
                "sourceFile": f"apkfiles/{file_name}",
                "recordId": record_id,
                "name": row.get("name") or row.get("Name") or row.get("displayName") or record_id,
                "effectTags": infer_effect_tags(record_id, row),
                "numericScalers": walk_numeric_fields(row),
                "abilityRefs": walk_refs(row),
                "rawKeys": sorted([str(k) for k in row.keys()])[:100],
            }

        source_reports.append({"file": file_name, "status": "ok", "records": count})

    return {"nodes": ability_nodes, "sources": source_reports}


def build_character_links(repo: Path, ability_nodes: Dict[str, Any]) -> Dict[str, Any]:
    entries = repo / "apkfiles" / "entries"
    families_bundle = load_json(entries / "bundles" / "character_families.bundle.json", {}) or {}
    character_bundle = load_json(entries / "bundles" / "characters.bundle.json", {}) or {}
    all_ability_ids = {str(node.get("recordId")) for node in ability_nodes.values()}
    all_ability_ids_norm = {re.sub(r"[^a-z0-9]+", "", v.lower()): v for v in all_ability_ids if v}

    links: Dict[str, Any] = {}

    for source_name, bundle in [("character_families", families_bundle), ("characters", character_bundle)]:
        for row in bundle.get("entries", []) if isinstance(bundle, dict) else []:
            if not isinstance(row, dict):
                continue
            cid = normalize_id(row.get("family") or row.get("id") or row.get("sourceId") or row.get("internalMonsterId"))
            if not cid:
                continue
            refs = walk_refs(row)
            direct = []
            fuzzy = []
            for ref in refs:
                value = normalize_id(ref.get("value"))
                n = re.sub(r"[^a-z0-9]+", "", value.lower())
                if value in all_ability_ids:
                    direct.append(ref)
                elif n in all_ability_ids_norm:
                    patched = dict(ref)
                    patched["matchedRecordId"] = all_ability_ids_norm[n]
                    fuzzy.append(patched)
            if direct or fuzzy:
                links.setdefault(cid, {"characterId": cid, "sources": [], "abilityRefs": [], "fuzzyRefs": []})
                links[cid]["sources"].append(source_name)
                links[cid]["abilityRefs"].extend(direct)
                links[cid]["fuzzyRefs"].extend(fuzzy)

    return links


def main() -> int:
    repo = find_repo_root(Path(__file__).resolve())
    generated_at = int(time.time())
    built = build_ability_nodes(repo)
    links = build_character_links(repo, built["nodes"])

    graph = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "description": "Ability graph for optimizer V2. Keeps raw ability/effect/scaler nodes separate from character ownership links so new abilities can be inserted without hand-patching optimizer JS.",
        "abilityNodes": built["nodes"],
        "characterAbilityLinks": links,
    }

    report = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "sources": built["sources"],
        "abilityNodeCount": len(built["nodes"]),
        "characterLinkCount": len(links),
        "scalerNodeCount": sum(1 for n in built["nodes"].values() if n.get("numericScalers")),
        "linkedCharactersWithDirectRefs": sum(1 for l in links.values() if l.get("abilityRefs")),
        "linkedCharactersWithFuzzyRefs": sum(1 for l in links.values() if l.get("fuzzyRefs")),
        "output": OUT_REL,
    }

    write_json(repo / OUT_REL, graph)
    write_json(repo / REPORT_REL, report)
    print(json.dumps(report, ensure_ascii=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
