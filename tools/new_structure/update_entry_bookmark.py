#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT_MARKERS = ["apkfiles", "tools"]
CATEGORIES = ["characters", "weapons", "accessories", "bosses"]


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for folder in [current] + list(current.parents):
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate Evertale-Optimizer repo root. Run from inside the repo.")


def load_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")


def normalize_rel(rel: str) -> str:
    return str(rel or "").replace("\\", "/").lstrip("./")


def resolve_entry_path(entries_root: Path, category_dir: Path, rel_file: str) -> Path:
    rel = normalize_rel(rel_file)
    candidates = [category_dir / rel, entries_root / rel]
    if rel.startswith("entries/"):
        candidates.insert(0, category_dir / rel)
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def extract_source_id(index_row: Dict[str, Any], entry_data: Dict[str, Any]) -> str:
    for value in [
        index_row.get("sourceId"),
        index_row.get("id"),
        entry_data.get("internal", {}).get("sourceId") if isinstance(entry_data.get("internal"), dict) else None,
        entry_data.get("name"),
        entry_data.get("id"),
    ]:
        value = str(value or "").strip()
        if value:
            return value
    return ""


def scan_category(entries_root: Path, category: str) -> Tuple[Dict[str, Any], List[str]]:
    category_dir = entries_root / category
    index_path = category_dir / "index.json"
    index_data = load_json(index_path, {}) or {}
    rows = index_data.get("entries", []) if isinstance(index_data, dict) else []
    bookmark_rows: Dict[str, Any] = {}
    errors: List[str] = []

    for order, row in enumerate(rows):
        if not isinstance(row, dict):
            errors.append(f"[{category}] index row #{order} is not an object")
            continue
        rel_file = normalize_rel(row.get("file", ""))
        if not rel_file:
            errors.append(f"[{category}] index row #{order} missing file")
            continue
        path = resolve_entry_path(entries_root, category_dir, rel_file)
        entry_data = load_json(path, {}) or {}
        if not isinstance(entry_data, dict):
            errors.append(f"[{category}] invalid entry json: {rel_file}")
            entry_data = {}
        source_id = extract_source_id(row, entry_data)
        if not source_id:
            errors.append(f"[{category}] unable to determine sourceId: {rel_file}")
            continue
        bookmark_rows[source_id] = {
            "sourceId": source_id,
            "category": category,
            "file": rel_file,
            "order": order,
            "entryId": entry_data.get("id") or row.get("id") or "",
            "displayName": entry_data.get("displayName") or entry_data.get("name") or row.get("displayName") or "",
            "mtime": int(path.stat().st_mtime) if path.exists() else None,
        }
    return bookmark_rows, errors


def build_bookmark(entries_root: Path) -> Dict[str, Any]:
    categories: Dict[str, Any] = {}
    all_source_ids: Dict[str, str] = {}
    errors: List[str] = []

    for category in CATEGORIES:
        rows, category_errors = scan_category(entries_root, category)
        categories[category] = {
            "count": len(rows),
            "sourceIds": sorted(rows.keys()),
            "entries": rows,
        }
        for source_id in rows:
            all_source_ids[source_id] = category
        errors.extend(category_errors)

    return {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "entriesRoot": str(entries_root),
        "totalCount": len(all_source_ids),
        "categories": categories,
        "allSourceIds": all_source_ids,
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build/update append-safe bookmark of already-created entry sourceIds.")
    parser.add_argument("--entries", default=None, help="Path to apkfiles/entries. Auto-detected when omitted.")
    args = parser.parse_args()

    repo_root = find_repo_root(Path.cwd())
    entries_root = Path(args.entries).resolve() if args.entries else (repo_root / "apkfiles" / "entries").resolve()
    bookmark = build_bookmark(entries_root)
    output_path = entries_root / "maps" / "entry_bookmark.json"
    report_path = entries_root / "reports" / "entry_bookmark_report.json"
    write_json(output_path, bookmark)
    write_json(report_path, {
        "schemaVersion": bookmark["schemaVersion"],
        "generatedAt": bookmark["generatedAt"],
        "entriesRoot": bookmark["entriesRoot"],
        "output": str(output_path),
        "totalCount": bookmark["totalCount"],
        "categoryCounts": {k: v["count"] for k, v in bookmark["categories"].items()},
        "errorCount": len(bookmark["errors"]),
        "errors": bookmark["errors"],
    })
    print(json.dumps({
        "output": str(output_path),
        "totalCount": bookmark["totalCount"],
        "categoryCounts": {k: v["count"] for k, v in bookmark["categories"].items()},
        "errorCount": len(bookmark["errors"]),
    }, ensure_ascii=False, indent=2))
    return 1 if bookmark["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
