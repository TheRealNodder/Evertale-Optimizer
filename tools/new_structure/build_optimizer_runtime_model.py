#!/usr/bin/env python3
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List

ROOT_MARKERS = ["apkfiles", "tools"]
OUT_REL = "apkfiles/entries/runtime/optimizer_runtime_model.json"


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


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def index_by_family(entries: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    result: Dict[str, Dict[str, Any]] = {}
    for row in entries or []:
        if not isinstance(row, dict):
            continue
        family = row.get("family") or row.get("id") or row.get("sourceId") or row.get("internalMonsterId")
        if family:
            result[str(family)] = row
    return result


def normalize_tag_rows(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [r for r in payload if isinstance(r, dict)]
    if isinstance(payload, dict):
        for key in ("character_tags", "tags", "entries", "items", "characters"):
            rows = payload.get(key)
            if isinstance(rows, list):
                return [r for r in rows if isinstance(r, dict)]
        # Some older outputs are already keyed by id/internalMonsterId.
        if all(isinstance(v, dict) for v in payload.values()):
            return [v for v in payload.values() if isinstance(v, dict)]
    return []


def merge_tag_rows(*sources: Any) -> List[Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}
    for source in sources:
        for row in normalize_tag_rows(source):
            key = str(
                row.get("internalMonsterId")
                or row.get("sourceId")
                or row.get("family")
                or row.get("id")
                or row.get("name")
                or ""
            ).strip()
            if not key:
                continue
            if key not in merged:
                merged[key] = dict(row)
                continue
            # Additions are allowed to refine old rows without wiping existing fields.
            current = merged[key]
            for field, value in row.items():
                if field in ("derivedTags", "tags"):
                    old = current.get(field) or []
                    if not isinstance(old, list):
                        old = []
                    if not isinstance(value, list):
                        value = []
                    current[field] = sorted({str(x) for x in [*old, *value] if str(x).strip()})
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
        keys = [
            row.get("id"),
            row.get("internalMonsterId"),
            row.get("sourceId"),
            row.get("family"),
            row.get("name"),
        ]
        for key in keys:
            if key:
                result[str(key)] = row
    return result


def main() -> int:
    repo = find_repo_root(Path.cwd())
    entries = repo / "apkfiles" / "entries"

    character_families = load_json(entries / "bundles" / "character_families.bundle.json", {})
    characters = load_json(entries / "bundles" / "characters.bundle.json", {})
    weapons = load_json(entries / "bundles" / "weapons.bundle.json", {})
    accessories = load_json(entries / "bundles" / "accessories.bundle.json", {})
    bosses = load_json(entries / "bundles" / "bosses.bundle.json", {})
    knowledge = load_json(entries / "runtime" / "optimizer_knowledge.json", {})

    # The actual tag authority lives under /data. Keep maps fallback for older experiments.
    base_tags = load_json(repo / "data" / "character_tags.json", [])
    addition_tags = load_json(repo / "data" / "character_tags_additions.json", [])
    map_tags = load_json(entries / "maps" / "character_tags.json", [])
    tag_rows = merge_tag_rows(base_tags, addition_tags, map_tags)
    tags = index_tags(tag_rows)

    runtime = {
        "schemaVersion": 2,
        "generatedAt": int(time.time()),
        "characters": index_by_family(character_families.get("entries", [])),
        "characterEntries": index_by_family(characters.get("entries", [])),
        "weapons": index_by_family(weapons.get("entries", [])),
        "accessories": index_by_family(accessories.get("entries", [])),
        "bosses": index_by_family(bosses.get("entries", [])),
        "tags": tags,
        "tagRows": tag_rows,
        "optimizerKnowledge": knowledge,
        "runtimeFlags": {
            "usesAI": True,
            "usesScalers": True,
            "usesStatuses": True,
            "usesPassives": True,
            "usesLeaderSkills": True,
            "usesSummons": True,
            "usesTags": bool(tags),
        },
        "sources": {
            "tags": [
                "data/character_tags.json",
                "data/character_tags_additions.json",
                "apkfiles/entries/maps/character_tags.json",
            ],
            "knowledge": "apkfiles/entries/runtime/optimizer_knowledge.json",
        },
    }

    out = repo / OUT_REL
    write_json(out, runtime)

    report = {
        "status": "ok",
        "characters": len(runtime["characters"]),
        "characterEntries": len(runtime["characterEntries"]),
        "weapons": len(runtime["weapons"]),
        "accessories": len(runtime["accessories"]),
        "bosses": len(runtime["bosses"]),
        "tags": len(runtime["tags"]),
        "tagRows": len(runtime["tagRows"]),
        "optimizerKnowledge": len(runtime["optimizerKnowledge"]) if isinstance(runtime["optimizerKnowledge"], dict) else 0,
        "output": str(out),
    }
    print(json.dumps(report, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
