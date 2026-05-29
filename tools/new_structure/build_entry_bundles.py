#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

CATEGORIES = ["characters", "weapons", "accessories", "bosses"]
ROOT_MARKERS = ["apkfiles"]


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


def read_index_entries(category_dir: Path) -> List[Dict[str, Any]]:
    index_path = category_dir / "index.json"
    if not index_path.exists():
        return []
    index = load_json(index_path)
    return list(index.get("entries", [])) if isinstance(index, dict) else []


def resolve_entry_path(category_dir: Path, rel_file: str) -> Path:
    rel_file = normalize_rel_path(rel_file)
    if rel_file.startswith("entries/"):
        return category_dir / rel_file
    return category_dir / "entries" / rel_file


def load_indexed_entries(category_dir: Path) -> tuple[List[Dict[str, Any]], List[str]]:
    rows: List[Dict[str, Any]] = []
    errors: List[str] = []
    for index_row in read_index_entries(category_dir):
        rel_file = normalize_rel_path(index_row.get("file", ""))
        if not rel_file:
            continue
        entry_path = resolve_entry_path(category_dir, rel_file)
        try:
            rows.append(load_json(entry_path))
        except Exception as exc:
            errors.append(f"{rel_file}: {exc}")
    return rows, errors


def source_id_from_entry(entry: Dict[str, Any], fallback: str = "") -> str:
    internal = entry.get("internal") if isinstance(entry.get("internal"), dict) else {}
    return str(internal.get("sourceId") or entry.get("sourceId") or entry.get("name") or entry.get("id") or fallback).strip()


def discover_entry_files(category_dir: Path) -> List[Path]:
    entries_dir = category_dir / "entries"
    if not entries_dir.exists():
        return []
    return sorted(p for p in entries_dir.glob("*.json") if p.is_file())


def load_entries_with_discovery(category_dir: Path) -> tuple[List[Dict[str, Any]], List[str], Dict[str, Any]]:
    """Load indexed entries, then append any raw entry files not listed in index.json.

    This prevents stale override/index files from hiding newly extracted content.
    Existing index order remains authoritative; auto-discovered files append in filename order.
    """
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
            # Do not drop same display id values; only prevent exact sourceId duplicates.
            if sid and sid in seen_ids:
                continue
            if sid:
                seen_ids.add(sid)
            rows.append(entry)
            discovered.append(entry_path.name)
        except Exception as exc:
            errors.append(f"entries/{entry_path.name}: {exc}")

    meta = {
        "indexedCount": len(seen_files),
        "discoveredUnindexedCount": len(discovered),
        "discoveredUnindexedFiles": discovered,
    }
    return rows, errors, meta


def build_category(entries_root: Path, bundles_dir: Path, category: str) -> Dict[str, Any]:
    category_dir = entries_root / category
    index_path = category_dir / "index.json"
    if not index_path.exists():
        return {"category": category, "status": "missing_index", "count": 0}
    source_index_count = len(read_index_entries(category_dir))
    rows, errors, discovery = load_entries_with_discovery(category_dir)
    bundle = {
        "schemaVersion": 2,
        "category": category,
        "generatedAt": int(time.time()),
        "sourceIndexCount": source_index_count,
        "discovery": discovery,
        "count": len(rows),
        "errors": errors,
        "contentHash": stable_hash(rows),
        "entries": rows,
    }
    out_path = bundles_dir / f"{category}.bundle.json"
    write_json(out_path, bundle)
    return {"category": category, "status": "ok", "sourceIndexCount": source_index_count, "count": len(rows), "errors": len(errors), "discoveredUnindexedCount": discovery["discoveredUnindexedCount"], "contentHash": bundle["contentHash"], "output": str(out_path)}


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
    for index_row in index_rows:
        rel_file = normalize_rel_path(index_row.get("file", ""))
        if not rel_file:
            continue
        entry_path = resolve_family_path(family_dir, rel_file)
        try:
            rows.append(load_json(entry_path))
        except Exception as exc:
            errors.append(f"{rel_file}: {exc}")
    bundle = {
        "schemaVersion": 2,
        "category": "character_families",
        "generatedAt": int(time.time()),
        "sourceIndexCount": len(index_rows),
        "count": len(rows),
        "errors": errors,
        "contentHash": stable_hash(rows),
        "entries": rows,
    }
    out_path = bundles_dir / "character_families.bundle.json"
    write_json(out_path, bundle)
    return {"category": "character_families", "status": "ok", "sourceIndexCount": len(index_rows), "count": len(rows), "errors": len(errors), "contentHash": bundle["contentHash"], "output": str(out_path)}


def build_catalog_bundle(entries_root: Path, bundles_dir: Path, category_reports: List[Dict[str, Any]], families_report: Dict[str, Any]) -> Dict[str, Any]:
    catalog: Dict[str, Any] = {"schemaVersion": 2, "generatedAt": int(time.time()), "categories": {}, "characterFamilies": [], "report": {"categories": category_reports, "characterFamilies": families_report}}
    for category in CATEGORIES:
        bundle_path = bundles_dir / f"{category}.bundle.json"
        if bundle_path.exists():
            bundle = load_json(bundle_path)
            catalog["categories"][category] = bundle.get("entries", [])
        else:
            catalog["categories"][category] = []
    families_path = bundles_dir / "character_families.bundle.json"
    if families_path.exists():
        bundle = load_json(families_path)
        catalog["characterFamilies"] = bundle.get("entries", [])
    catalog["contentHash"] = stable_hash({"categories": catalog["categories"], "characterFamilies": catalog["characterFamilies"]})
    out_path = bundles_dir / "catalog.bundle.json"
    write_json(out_path, catalog)
    return {"category": "catalog", "status": "ok", "count": sum(len(v) for v in catalog["categories"].values()), "characterFamilies": len(catalog["characterFamilies"]), "contentHash": catalog["contentHash"], "output": str(out_path)}


def resolve_entries_root(cli_entries: Optional[str]) -> Path:
    if cli_entries:
        return Path(cli_entries).resolve()
    repo_root = find_repo_root(Path.cwd())
    return (repo_root / "apkfiles" / "entries").resolve()


def main() -> int:
    parser = argparse.ArgumentParser(description="Build fast runtime bundles from apkfiles/entries.")
    parser.add_argument("--entries", default=None)
    parser.add_argument("--category", choices=CATEGORIES, default=None)
    parser.add_argument("--skip-catalog", action="store_true")
    args = parser.parse_args()
    entries_root = resolve_entries_root(args.entries)
    bundles_dir = entries_root / "bundles"
    categories = [args.category] if args.category else CATEGORIES
    category_reports = [build_category(entries_root, bundles_dir, category) for category in categories]
    families_report = build_character_families(entries_root, bundles_dir) if (not args.category or args.category == "characters") else {"category": "character_families", "status": "skipped"}
    catalog_report = None
    if not args.skip_catalog and not args.category:
        catalog_report = build_catalog_bundle(entries_root, bundles_dir, category_reports, families_report)
    report = {"schemaVersion": 2, "generatedAt": int(time.time()), "entriesRoot": str(entries_root), "bundlesRoot": str(bundles_dir), "categories": category_reports, "characterFamilies": families_report, "catalog": catalog_report}
    write_json(entries_root / "reports" / "bundle_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
