#!/usr/bin/env python3
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict

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


def index_by_family(entries):
    result = {}
    for row in entries:
        family = row.get("family") or row.get("id") or row.get("sourceId")
        if family:
            result[str(family)] = row
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
    tags = load_json(entries / "maps" / "character_tags.json", {})

    runtime = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "characters": index_by_family(character_families.get("entries", [])),
        "characterEntries": index_by_family(characters.get("entries", [])),
        "weapons": index_by_family(weapons.get("entries", [])),
        "accessories": index_by_family(accessories.get("entries", [])),
        "bosses": index_by_family(bosses.get("entries", [])),
        "tags": tags,
        "optimizerKnowledge": knowledge,
        "runtimeFlags": {
            "usesAI": True,
            "usesScalers": True,
            "usesStatuses": True,
            "usesPassives": True,
            "usesLeaderSkills": True,
            "usesSummons": True,
        }
    }

    out = repo / OUT_REL
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(runtime, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": "ok",
        "characters": len(runtime["characters"]),
        "weapons": len(runtime["weapons"]),
        "accessories": len(runtime["accessories"]),
        "bosses": len(runtime["bosses"]),
        "output": str(out)
    }, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
