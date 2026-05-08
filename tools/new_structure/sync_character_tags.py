#!/usr/bin/env python3
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, List

ROOT_MARKERS = ["apkfiles", "tools"]


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for folder in [current] + list(current.parents):
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root")


def load_json(path: Path, fallback: Any):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def write_json(path: Path, data: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def merge_unique(existing: List[Dict[str, Any]], additions: List[Dict[str, Any]]):
    by_key = {}
    for row in existing:
        key = str(row.get("internalMonsterId") or row.get("id") or "").lower()
        if key:
            by_key[key] = row

    appended = []
    for row in additions:
        key = str(row.get("internalMonsterId") or row.get("id") or "").lower()
        if not key or key in by_key:
            continue
        existing.append(row)
        appended.append(row.get("internalMonsterId") or row.get("id"))
        by_key[key] = row

    return existing, appended


def main() -> int:
    repo = find_repo_root(Path.cwd())

    primary = repo / "data/character_tags.json"
    additions = repo / "data/character_tags_additions.json"
    report = repo / "apkfiles/entries/reports/tag_sync_report.json"

    base_data = load_json(primary, [])
    additions_data = load_json(additions, [])

    merged, appended = merge_unique(base_data, additions_data)

    write_json(primary, merged)

    write_json(report, {
        "generatedAt": int(time.time()),
        "appended": appended,
        "appendedCount": len(appended),
        "totalTags": len(merged)
    })

    print(json.dumps({
        "appended": appended,
        "appendedCount": len(appended),
        "totalTags": len(merged)
    }, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
