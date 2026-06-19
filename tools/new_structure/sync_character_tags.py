#!/usr/bin/env python3
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT_MARKERS = ["apkfiles", "tools"]
EXCLUDED_PATH_PARTS = {"legacy", "Legacy", "_duplicate_quarantine", "_weapon_duplicate_quarantine", "_boss_duplicate_quarantine"}


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
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def is_excluded_path(path: Path) -> bool:
    return path.name.startswith("_") or any(part in EXCLUDED_PATH_PARTS or part.startswith("_") for part in path.parts)


def tag_key(row: Dict[str, Any]) -> str:
    return str(row.get("internalMonsterId") or row.get("sourceId") or row.get("id") or "").strip().lower()


def sanitize_rows(rows: Any) -> Tuple[List[Dict[str, Any]], int]:
    clean: List[Dict[str, Any]] = []
    skipped = 0
    seen = set()
    for row in rows or []:
        if not isinstance(row, dict):
            skipped += 1
            continue
        key = tag_key(row)
        if not key or key in seen:
            skipped += 1
            continue
        seen.add(key)
        clean.append(row)
    return clean, skipped


def merge_unique(existing: List[Dict[str, Any]], additions: List[Dict[str, Any]]):
    by_key = {tag_key(row): row for row in existing if tag_key(row)}
    appended = []
    for row in sorted(additions, key=lambda r: tag_key(r)):
        key = tag_key(row)
        if not key or key in by_key:
            continue
        existing.append(row)
        appended.append(row.get("internalMonsterId") or row.get("sourceId") or row.get("id"))
        by_key[key] = row
    return existing, appended


def write_marker(repo: Path, report_payload: Dict[str, Any]) -> None:
    write_json(repo / "apkfiles/entries/_markers/sync_character_tags.marker.json", {"schemaVersion": 1, "tool": "sync_character_tags", "category": "characters", "status": "complete", "lastKey": "character_tags", "lastSourceId": "", "lastHandle": None, "lastFile": "data/character_tags.json", "processedCount": report_payload.get("totalTags", 0), "totalCount": report_payload.get("totalTags", 0), "updatedAt": int(time.time()), "extra": {"report": "apkfiles/entries/reports/tag_sync_report.json", "appendedCount": report_payload.get("appendedCount", 0), "skippedBaseRows": report_payload.get("skippedBaseRows", 0), "skippedAdditionRows": report_payload.get("skippedAdditionRows", 0)}})


def main() -> int:
    repo = find_repo_root(Path(__file__).resolve())
    primary = repo / "data/character_tags.json"
    additions = repo / "data/character_tags_additions.json"
    report = repo / "apkfiles/entries/reports/tag_sync_report.json"
    if is_excluded_path(primary) or is_excluded_path(additions):
        raise SystemExit("ERROR: tag paths resolved to excluded folders")
    base_data, skipped_base = sanitize_rows(load_json(primary, []))
    additions_data, skipped_additions = sanitize_rows(load_json(additions, []))
    merged, appended = merge_unique(base_data, additions_data)
    payload = {"schemaVersion": 2, "generatedAt": int(time.time()), "appended": appended, "appendedCount": len(appended), "totalTags": len(merged), "skippedBaseRows": skipped_base, "skippedAdditionRows": skipped_additions, "primary": str(primary), "additions": str(additions)}
    write_json(primary, merged)
    write_json(report, payload)
    write_marker(repo, payload)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
