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
    for folder in [current, *current.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root")


def load_json_checked(path: Path) -> Tuple[Any, Dict[str, Any]]:
    if not path.exists():
        return None, {"path": str(path), "status": "missing", "count": 0}
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        return None, {"path": str(path), "status": "invalid", "count": 0, "error": str(exc)}
    count = len(value) if isinstance(value, (dict, list)) else 0
    return value, {"path": str(path), "status": "ok", "count": count}


def write_json(path: Path, data: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def is_excluded_path(path: Path) -> bool:
    return path.name.startswith("_") or any(part in EXCLUDED_PATH_PARTS or part.startswith("_") for part in path.parts)


def normalize_rows(payload: Any) -> List[Dict[str, Any]]:
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


def tag_key(row: Dict[str, Any]) -> str:
    return str(row.get("internalMonsterId") or row.get("sourceId") or row.get("family") or row.get("id") or "").strip().lower()


def sanitize_rows(rows: Any) -> Tuple[List[Dict[str, Any]], int]:
    clean: List[Dict[str, Any]] = []
    skipped = 0
    seen = set()
    for row in normalize_rows(rows):
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
    for row in sorted(additions, key=tag_key):
        key = tag_key(row)
        if not key or key in by_key:
            continue
        existing.append(row)
        appended.append(row.get("internalMonsterId") or row.get("sourceId") or row.get("family") or row.get("id"))
        by_key[key] = row
    return existing, appended


def write_marker(repo: Path, report_payload: Dict[str, Any]) -> None:
    write_json(repo / "apkfiles/entries/_markers/sync_character_tags.marker.json", {
        "schemaVersion": 2,
        "tool": "sync_character_tags",
        "category": "characters",
        "status": report_payload["status"],
        "lastKey": "character_tags",
        "lastSourceId": "",
        "lastHandle": None,
        "lastFile": "data/character_tags.json",
        "processedCount": report_payload.get("totalTags", 0),
        "totalCount": report_payload.get("totalTags", 0),
        "updatedAt": int(time.time()),
        "extra": {
            "report": "apkfiles/entries/reports/tag_sync_report.json",
            "errors": len(report_payload.get("errors", [])),
            "warnings": len(report_payload.get("warnings", [])),
            "preservedExisting": report_payload.get("preservedExisting", False),
        },
    })


def main() -> int:
    repo = find_repo_root(Path(__file__).resolve())
    primary = repo / "data/character_tags.json"
    additions = repo / "data/character_tags_additions.json"
    report_path = repo / "apkfiles/entries/reports/tag_sync_report.json"
    if is_excluded_path(primary) or is_excluded_path(additions):
        raise SystemExit("ERROR: tag paths resolved to excluded folders")

    base_payload, base_source = load_json_checked(primary)
    additions_payload, additions_source = load_json_checked(additions)
    errors: List[str] = []
    warnings: List[str] = []
    if base_source["status"] == "invalid":
        errors.append(f"Primary tag authority is invalid: {base_source.get('error')}")
    elif base_source["status"] == "missing":
        warnings.append("Primary tag authority is missing")
    if additions_source["status"] == "invalid":
        errors.append(f"Tag additions authority is invalid: {additions_source.get('error')}")
    elif additions_source["status"] == "missing":
        warnings.append("Tag additions authority is missing")

    base_rows, skipped_base = sanitize_rows(base_payload)
    addition_rows, skipped_additions = sanitize_rows(additions_payload)
    merged, appended = merge_unique(list(base_rows), addition_rows)
    preserved_existing = bool(base_rows) and not merged
    wrote_primary = False

    if not errors and merged:
        write_json(primary, merged)
        wrote_primary = True
    elif not errors and not merged:
        warnings.append("No curated tag rows are available; primary authority was left unchanged")

    status = "failed" if errors else "warning" if warnings else "ok"
    payload = {
        "schemaVersion": 3,
        "generatedAt": int(time.time()),
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "appended": appended,
        "appendedCount": len(appended),
        "totalTags": len(merged),
        "skippedBaseRows": skipped_base,
        "skippedAdditionRows": skipped_additions,
        "preservedExisting": preserved_existing,
        "wrotePrimary": wrote_primary,
        "sources": {"primary": base_source, "additions": additions_source},
    }
    write_json(report_path, payload)
    write_marker(repo, payload)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
