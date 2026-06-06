#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List

ROOT_MARKERS = ["apkfiles", "tools"]
CATEGORIES = ["weapons", "accessories", "bosses"]
EXCLUDED_DIR_NAMES = {"legacy", "Legacy", "_weapon_duplicate_quarantine", "_boss_duplicate_quarantine", "_duplicate_quarantine"}


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for folder in [current] + list(current.parents):
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root. Run inside Evertale-Optimizer.")


def load_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def write_json(path: Path, data: Any, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        text = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
    else:
        text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def is_excluded_entry_file(path: Path) -> bool:
    if path.name.startswith("_") or path.name.endswith("_report.json") or path.name.endswith(".renumber_tmp") or path.suffix.lower() != ".json":
        return True
    return any(part in EXCLUDED_DIR_NAMES or part.startswith("_") for part in path.parts)


def file_handle_order(path: Path) -> int:
    match = re.match(r"^(\d+)_", path.name)
    return int(match.group(1)) if match else 999999


def strip_file_handle(path: Path) -> str:
    return re.sub(r"^\d+_", "", path.stem)


def source_id_from_entry(data: Dict[str, Any], fallback: str) -> str:
    internal = data.get("internal") if isinstance(data.get("internal"), dict) else {}
    raw = data.get("raw") if isinstance(data.get("raw"), dict) else {}
    value = internal.get("sourceId") or data.get("sourceId") or data.get("name") or data.get("id") or raw.get("sourceId") or raw.get("id") or fallback
    return str(value or fallback).strip()



def weapon_family_key(source_id: str, fallback: str) -> str:
    value = str(source_id or fallback or "").strip()
    return re.sub(r"\d+$", "", value) or value


def is_primary_weapon_form(source_id: str, path: Path) -> bool:
    value = str(source_id or strip_file_handle(path)).strip()
    match = re.search(r"(\d+)$", value)
    return not match or match.group(1) == "01"

def display_name_from_entry(data: Dict[str, Any], source_id: str) -> str:
    raw = data.get("raw") if isinstance(data.get("raw"), dict) else {}
    for value in [data.get("displayName"), data.get("title"), data.get("name"), raw.get("displayName"), raw.get("title"), raw.get("name")]:
        if value and str(value).strip() and str(value).strip() != source_id:
            return str(value).strip()
    return source_id


def family_from_entry(data: Dict[str, Any], source_id: str) -> str:
    internal = data.get("internal") if isinstance(data.get("internal"), dict) else {}
    raw = data.get("raw") if isinstance(data.get("raw"), dict) else {}
    return str(internal.get("family") or raw.get("family") or re.sub(r"\d+$", "", source_id)).strip()


def existing_index_map(category_dir: Path) -> Dict[str, Dict[str, Any]]:
    index = load_json(category_dir / "index.json", {}) or {}
    rows = index.get("entries", []) if isinstance(index, dict) else []
    out: Dict[str, Dict[str, Any]] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        sid = str(row.get("sourceId") or row.get("id") or row.get("key") or "").strip()
        file_name = Path(str(row.get("file") or "")).name
        if sid:
            out[f"sid:{sid}"] = row
        if file_name:
            out[f"file:{file_name}"] = row
    return out


def build_index_for_category(repo_root: Path, category: str) -> Dict[str, Any]:
    category_dir = repo_root / "apkfiles" / "entries" / category
    entries_dir = category_dir / "entries"
    report: Dict[str, Any] = {
        "category": category,
        "categoryDir": str(category_dir),
        "entriesDir": str(entries_dir),
        "status": "missing_entries_dir",
        "scannedFiles": 0,
        "indexedCount": 0,
        "duplicateSourceIds": {},
        "errors": [],
    }
    if not entries_dir.exists():
        return report

    old_rows = existing_index_map(category_dir)
    files = sorted([p for p in entries_dir.glob("*.json") if p.is_file() and not is_excluded_entry_file(p)], key=lambda p: (file_handle_order(p), p.name.lower()))
    rows: List[Dict[str, Any]] = []
    seen: Dict[str, List[str]] = {}
    seen_weapon_families: set[str] = set()

    for path in files:
        data = load_json(path, None)
        if not isinstance(data, dict):
            report["errors"].append(f"Invalid JSON: {path.name}")
            continue
        fallback = strip_file_handle(path)
        source_id = source_id_from_entry(data, fallback)
        if category == "weapons":
            family_key = weapon_family_key(source_id, fallback)
            if family_key in seen_weapon_families or not is_primary_weapon_form(source_id, path):
                continue
            seen_weapon_families.add(family_key)
        order = file_handle_order(path)
        old = old_rows.get(f"sid:{source_id}") or old_rows.get(f"file:{path.name}") or {}
        row = {
            "sourceId": source_id,
            "file": f"entries/{path.name}",
            "fileHandleOrder": order if order != 999999 else old.get("fileHandleOrder") or old.get("sourceOrder") or old.get("order") or None,
            "sourceOrder": order if order != 999999 else old.get("sourceOrder") or old.get("fileHandleOrder") or old.get("order") or None,
            "family": old.get("family") or family_from_entry(data, source_id),
            "displayName": old.get("displayName") or display_name_from_entry(data, source_id),
        }
        row = {k: v for k, v in row.items() if v is not None and v != ""}
        rows.append(row)
        seen.setdefault(source_id, []).append(path.name)

    duplicates = {sid: names for sid, names in seen.items() if len(names) > 1}
    index = {
        "schemaVersion": 2,
        "category": category,
        "generatedAt": int(time.time()),
        "source": "rebuild_strict_category_indexes_from_files.py",
        "strictIndexOnly": True,
        "count": len(rows),
        "entries": rows,
    }
    write_json(category_dir / "index.json", index, compact=False)
    report.update({
        "status": "complete" if not duplicates and not report["errors"] else "warning",
        "scannedFiles": len(files),
        "indexedCount": len(rows),
        "duplicateSourceIds": duplicates,
        "indexFile": str(category_dir / "index.json"),
    })
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild strict category index.json files from actual entry filenames.")
    parser.add_argument("--category", choices=CATEGORIES + ["all"], default="all")
    args = parser.parse_args()

    repo_root = find_repo_root(Path.cwd())
    categories = CATEGORIES if args.category == "all" else [args.category]
    reports = [build_index_for_category(repo_root, category) for category in categories]
    total_indexed = sum(r.get("indexedCount", 0) for r in reports)
    total_scanned = sum(r.get("scannedFiles", 0) for r in reports)
    total_errors = sum(len(r.get("errors", [])) for r in reports)
    total_duplicates = sum(len(r.get("duplicateSourceIds", {})) for r in reports)

    out = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "repoRoot": str(repo_root),
        "status": "complete" if total_errors == 0 and total_duplicates == 0 else "warning",
        "scannedFiles": total_scanned,
        "indexedCount": total_indexed,
        "errorCount": total_errors,
        "duplicateSourceIdCount": total_duplicates,
        "categories": reports,
    }
    entries_root = repo_root / "apkfiles" / "entries"
    write_json(entries_root / "reports" / "strict_category_index_rebuild_report.json", out, compact=False)
    write_json(entries_root / "_markers" / "rebuild_strict_category_indexes_from_files.marker.json", {
        "schemaVersion": 1,
        "tool": "rebuild_strict_category_indexes_from_files",
        "category": args.category,
        "status": out["status"],
        "lastKey": "strict_category_indexes",
        "lastSourceId": "",
        "lastHandle": None,
        "lastFile": "apkfiles/entries/reports/strict_category_index_rebuild_report.json",
        "processedCount": total_indexed,
        "totalCount": total_scanned,
        "updatedAt": int(time.time()),
        "extra": {"errorCount": total_errors, "duplicateSourceIdCount": total_duplicates},
    }, compact=False)
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 1 if total_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
