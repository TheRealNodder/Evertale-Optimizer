#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

CATEGORIES = ["characters", "weapons", "accessories", "bosses"]
ROOT_MARKERS = ["apkfiles"]
EXCLUDED_DIR_NAMES = {"legacy", "Legacy", "_weapon_duplicate_quarantine", "_boss_duplicate_quarantine", "_duplicate_quarantine"}
TESTLIKE_RE = re.compile(r"(test|debug|prototype|dev|internal|placeholder|sandbox|experimental)", re.I)

def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for folder in [current] + list(current.parents):
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    return current

def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)

def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8", newline="\n")

def stable_hash(data: Any) -> str:
    raw = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]

def normalize_rel_path(path_value: str) -> str:
    return str(path_value or "").replace("\\", "/").lstrip("./")

def file_handle(path_or_name: Any) -> int:
    m = re.match(r"^(\d+)_", str(path_or_name or "").split("/")[-1])
    return int(m.group(1)) if m else 0

def read_index_entries(category_dir: Path) -> List[Dict[str, Any]]:
    index_path = category_dir / "index.json"
    if not index_path.exists():
        return []
    index = load_json(index_path)
    rows = list(index.get("entries", [])) if isinstance(index, dict) else []
    return sorted(rows, key=lambda r: int(r.get("fileHandleOrder") or r.get("sourceOrder") or r.get("order") or file_handle(r.get("file")) or 0))

def resolve_entry_path(category_dir: Path, rel_file: str) -> Path:
    rel_file = normalize_rel_path(rel_file)
    if rel_file.startswith("entries/"):
        return category_dir / rel_file
    return category_dir / "entries" / rel_file

def is_excluded(path: Path) -> bool:
    return path.name.startswith("_") or path.name.endswith("_report.json") or any(part in EXCLUDED_DIR_NAMES or part.startswith("_") for part in path.parts)

def discover_entry_files(category_dir: Path) -> List[Path]:
    entries_dir = category_dir / "entries"
    if not entries_dir.exists():
        return []
    return sorted(p for p in entries_dir.glob("*.json") if p.is_file() and not is_excluded(p))

def source_id_from_entry(entry: Dict[str, Any], fallback: str = "") -> str:
    internal = entry.get("internal") if isinstance(entry.get("internal"), dict) else {}
    raw = entry.get("raw") if isinstance(entry.get("raw"), dict) else {}
    return str(internal.get("sourceId") or internal.get("weaponId") or entry.get("sourceId") or raw.get("name") or entry.get("name") or entry.get("id") or fallback).strip()

def apply_order(entry: Dict[str, Any], handle: int, source_file: str, test_like: bool = False) -> Dict[str, Any]:
    entry = dict(entry)
    entry["order"] = handle
    entry["fileHandleOrder"] = handle
    entry["sourceOrder"] = handle
    entry["_bundleSourceFile"] = source_file
    if test_like:
        entry["_testLike"] = True
    return entry

def load_weapon_entries(category_dir: Path) -> Tuple[List[Dict[str, Any]], List[str], Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    errors: List[str] = []
    seen_source_ids: set[str] = set()
    production: List[Tuple[int, Dict[str, Any]]] = []
    testlike: List[Tuple[int, Dict[str, Any]]] = []

    for path in discover_entry_files(category_dir):
        handle = file_handle(path.name)
        try:
            entry = load_json(path)
            sid = source_id_from_entry(entry, path.stem)
            # Keep one visible card per exact source id. This avoids duplicated resolved entries,
            # while still preserving distinct handles/families.
            if sid and sid in seen_source_ids:
                continue
            if sid:
                seen_source_ids.add(sid)
            is_test = bool(TESTLIKE_RE.search(path.name) or TESTLIKE_RE.search(sid))
            item = apply_order(entry, handle, f"entries/{path.name}", is_test)
            (testlike if is_test else production).append((handle, item))
        except Exception as exc:
            errors.append(f"entries/{path.name}: {exc}")

    production.sort(key=lambda x: x[0], reverse=True)
    testlike.sort(key=lambda x: x[0], reverse=True)
    rows = [x[1] for x in production] + [x[1] for x in testlike]
    meta = {
        "mode": "weapon_handle_source_of_truth",
        "orderAuthority": "real 4-digit filename handle; newest is highest handle",
        "productionCount": len(production),
        "testLikeCount": len(testlike),
        "count": len(rows),
        "strictIndexOnly": False,
        "discoveredUnindexedCount": 0,
        "skippedUnindexedCount": 0,
    }
    return rows, errors, meta

def load_indexed_with_discovery(category_dir: Path, category: str) -> Tuple[List[Dict[str, Any]], List[str], Dict[str, Any]]:
    if category == "weapons":
        return load_weapon_entries(category_dir)

    rows: List[Dict[str, Any]] = []
    errors: List[str] = []
    seen_files: set[str] = set()
    seen_ids: set[str] = set()
    for index_row in read_index_entries(category_dir):
        rel_file = normalize_rel_path(index_row.get("file", ""))
        if not rel_file:
            continue
        entry_path = resolve_entry_path(category_dir, rel_file)
        seen_files.add(entry_path.name)
        try:
            entry = load_json(entry_path)
            handle = int(index_row.get("fileHandleOrder") or index_row.get("sourceOrder") or index_row.get("order") or file_handle(rel_file) or 0)
            if handle:
                entry = apply_order(entry, handle, rel_file)
            sid = source_id_from_entry(entry, entry_path.stem)
            if sid:
                seen_ids.add(sid)
            rows.append(entry)
        except Exception as exc:
            errors.append(f"{rel_file}: {exc}")

    discovered: List[str] = []
    for entry_path in discover_entry_files(category_dir):
        if entry_path.name in seen_files:
            continue
        try:
            entry = load_json(entry_path)
            sid = source_id_from_entry(entry, entry_path.stem)
            if sid and sid in seen_ids:
                continue
            if sid:
                seen_ids.add(sid)
            entry = apply_order(entry, file_handle(entry_path.name), f"entries/{entry_path.name}")
            rows.append(entry)
            discovered.append(entry_path.name)
        except Exception as exc:
            errors.append(f"entries/{entry_path.name}: {exc}")

    meta = {
        "indexedCount": len(seen_files),
        "discoveredUnindexedCount": len(discovered),
        "discoveredUnindexedFiles": discovered[:500],
        "strictIndexOnly": False,
    }
    return rows, errors, meta

def strip_bundle_markers(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{k: v for k, v in row.items() if not k.startswith("_bundle")} for row in rows]

def build_category(entries_root: Path, bundles_dir: Path, category: str) -> Dict[str, Any]:
    category_dir = entries_root / category
    index_path = category_dir / "index.json"
    if not category_dir.exists():
        return {"category": category, "status": "missing_category", "count": 0}
    source_index_count = len(read_index_entries(category_dir)) if index_path.exists() else 0
    rows, errors, discovery = load_indexed_with_discovery(category_dir, category)
    clean_rows = strip_bundle_markers(rows)
    bundle = {
        "schemaVersion": 4,
        "category": category,
        "generatedAt": int(time.time()),
        "sourceIndexCount": source_index_count,
        "discovery": discovery,
        "count": len(clean_rows),
        "errors": errors,
        "contentHash": stable_hash(clean_rows),
        "entries": clean_rows,
    }
    out_path = bundles_dir / f"{category}.bundle.json"
    write_json(out_path, bundle)
    return {"category": category, "status": "ok" if not errors else "warning", "sourceIndexCount": source_index_count, "count": len(clean_rows), "errors": len(errors), "discovery": discovery, "contentHash": bundle["contentHash"], "output": str(out_path)}

def resolve_family_path(family_dir: Path, rel_file: str) -> Path:
    rel_file = normalize_rel_path(rel_file)
    if rel_file.startswith("families/"):
        return family_dir / rel_file.split("/", 1)[1]
    return family_dir / rel_file

def build_character_families(entries_root: Path, bundles_dir: Path) -> Dict[str, Any]:
    family_dir = entries_root / "characters" / "families"
    index_path = family_dir / "index.json"
    if not index_path.exists():
        return {"category": "character_families", "status": "missing_index", "count": 0}
    index = load_json(index_path)
    index_rows = list(index.get("entries", [])) if isinstance(index, dict) else []
    rows: List[Dict[str, Any]] = []
    errors: List[str] = []
    for row in index_rows:
        rel_file = normalize_rel_path(row.get("file", ""))
        if not rel_file:
            continue
        path = resolve_family_path(family_dir, rel_file)
        try:
            rows.append(load_json(path))
        except Exception as exc:
            errors.append(f"{rel_file}: {exc}")
    bundle = {"schemaVersion": 4, "category": "character_families", "generatedAt": int(time.time()), "sourceIndexCount": len(index_rows), "count": len(rows), "errors": errors, "contentHash": stable_hash(rows), "entries": rows}
    out_path = bundles_dir / "character_families.bundle.json"
    write_json(out_path, bundle)
    return {"category": "character_families", "status": "ok" if not errors else "warning", "sourceIndexCount": len(index_rows), "count": len(rows), "errors": len(errors), "contentHash": bundle["contentHash"], "output": str(out_path)}

def build_catalog_bundle(bundles_dir: Path) -> Dict[str, Any]:
    categories: Dict[str, List[Dict[str, Any]]] = {}
    missing = []
    for category in CATEGORIES:
        path = bundles_dir / f"{category}.bundle.json"
        if not path.exists():
            categories[category] = []
            missing.append(category)
            continue
        payload = load_json(path)
        categories[category] = payload.get("entries", []) if isinstance(payload, dict) else []
    families_path = bundles_dir / "character_families.bundle.json"
    character_families = []
    if families_path.exists():
        payload = load_json(families_path)
        character_families = payload.get("entries", []) if isinstance(payload, dict) else []
    catalog = {"schemaVersion": 4, "generatedAt": int(time.time()), "categories": categories, "characterFamilies": character_families, "missingBundles": missing, "categoryCounts": {c: len(categories.get(c, [])) for c in CATEGORIES}, "characterFamilyCount": len(character_families), "contentHash": stable_hash({"categories": categories, "characterFamilies": character_families})}
    out_path = bundles_dir / "catalog.bundle.json"
    write_json(out_path, catalog)
    return {"category": "catalog", "status": "ok" if not missing else "warning", "count": sum(len(v) for v in categories.values()), "characterFamilies": len(character_families), "missingBundles": missing, "categoryCounts": catalog["categoryCounts"], "contentHash": catalog["contentHash"], "output": str(out_path)}

def main() -> int:
    parser = argparse.ArgumentParser(description="Build compact entry bundles from apkfiles/entries.")
    parser.add_argument("--entries-root", default="apkfiles/entries")
    parser.add_argument("--bundles-root", default=None)
    args = parser.parse_args()
    repo = find_repo_root(Path.cwd())
    entries_root = (repo / args.entries_root).resolve() if not Path(args.entries_root).is_absolute() else Path(args.entries_root).resolve()
    bundles_dir = Path(args.bundles_root).resolve() if args.bundles_root else entries_root / "bundles"
    bundles_dir.mkdir(parents=True, exist_ok=True)

    results = [build_category(entries_root, bundles_dir, category) for category in CATEGORIES]
    results.append(build_character_families(entries_root, bundles_dir))
    results.append(build_catalog_bundle(bundles_dir))

    report = {"schemaVersion": 4, "generatedAt": int(time.time()), "entriesRoot": str(entries_root), "bundlesRoot": str(bundles_dir), "categories": results}
    report_path = entries_root / "reports" / "bundle_build_report.json"
    write_json(report_path, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
