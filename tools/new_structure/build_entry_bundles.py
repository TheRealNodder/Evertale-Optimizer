#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

CATEGORIES = ["characters", "weapons", "accessories", "bosses"]
ROOT_MARKERS = ["apkfiles"]
STRICT_INDEX_CATEGORIES = {"weapons", "accessories", "bosses"}
EXCLUDED_DIR_NAMES = {"legacy", "Legacy", "_weapon_duplicate_quarantine", "_boss_duplicate_quarantine", "_duplicate_quarantine"}


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


def index_row_order(row: Dict[str, Any]) -> int:
    for key in ("fileHandleOrder", "sourceOrder", "order", "visualOrder"):
        try:
            value = int(row.get(key))
            if value > 0:
                return value
        except Exception:
            pass
    match = re.match(r"^(\d+)_", str(row.get("file", "")).split("/")[-1])
    return int(match.group(1)) if match else 999999


def read_index_entries(category_dir: Path) -> List[Dict[str, Any]]:
    index_path = category_dir / "index.json"
    if not index_path.exists():
        return []
    index = load_json(index_path)
    rows = list(index.get("entries", [])) if isinstance(index, dict) else []
    return sorted(rows, key=index_row_order)


def resolve_entry_path(category_dir: Path, rel_file: str) -> Path:
    rel_file = normalize_rel_path(rel_file)
    if rel_file.startswith("entries/"):
        return category_dir / rel_file
    return category_dir / "entries" / rel_file


def source_id_from_entry(entry: Dict[str, Any], fallback: str = "") -> str:
    internal = entry.get("internal") if isinstance(entry.get("internal"), dict) else {}
    return str(internal.get("sourceId") or entry.get("sourceId") or entry.get("name") or entry.get("id") or fallback).strip()


def is_excluded_entry_file(path: Path) -> bool:
    if path.name.startswith("_") or path.name.endswith("_report.json") or path.name.endswith(".renumber_tmp"):
        return True
    return any(part in EXCLUDED_DIR_NAMES or part.startswith("_") for part in path.parts)


def discover_entry_files(category_dir: Path) -> List[Path]:
    entries_dir = category_dir / "entries"
    if not entries_dir.exists():
        return []
    return sorted(p for p in entries_dir.glob("*.json") if p.is_file() and not is_excluded_entry_file(p))


def load_entries_with_discovery(category_dir: Path, category: str) -> tuple[List[Dict[str, Any]], List[str], Dict[str, Any]]:
    """Build bundle rows.

    Strict categories use only index.json. This prevents quarantined/legacy/unindexed weapon,
    accessory, or boss JSON files from overriding the intended order.

    Characters retain discovery because character extraction can still introduce newly generated
    family/source rows, but excluded folders/files are still ignored.
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
        if is_excluded_entry_file(entry_path):
            errors.append(f"excluded indexed file skipped: {rel_file}")
            continue
        try:
            entry = load_json(entry_path)
            sid = source_id_from_entry(entry, entry_path.stem)
            if sid:
                seen_ids.add(sid)
            rows.append(entry)
        except Exception as exc:
            errors.append(f"{rel_file}: {exc}")

    discovered: List[str] = []
    skipped_unindexed: List[str] = []
    if category not in STRICT_INDEX_CATEGORIES:
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
                rows.append(entry)
                discovered.append(entry_path.name)
            except Exception as exc:
                errors.append(f"entries/{entry_path.name}: {exc}")
    else:
        for entry_path in discover_entry_files(category_dir):
            if entry_path.name not in seen_files:
                skipped_unindexed.append(entry_path.name)

    meta = {
        "indexedCount": len(seen_files),
        "strictIndexOnly": category in STRICT_INDEX_CATEGORIES,
        "discoveredUnindexedCount": len(discovered),
        "discoveredUnindexedFiles": discovered,
        "skippedUnindexedCount": len(skipped_unindexed),
        "skippedUnindexedFiles": skipped_unindexed[:500],
    }
    return rows, errors, meta


def build_category(entries_root: Path, bundles_dir: Path, category: str) -> Dict[str, Any]:
    category_dir = entries_root / category
    index_path = category_dir / "index.json"
    if not index_path.exists():
        return {"category": category, "status": "missing_index", "count": 0}
    index_rows = read_index_entries(category_dir)
    source_index_count = len(index_rows)
    rows, errors, discovery = load_entries_with_discovery(category_dir, category)
    bundle = {
        "schemaVersion": 3,
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
    return {"category": category, "status": "ok", "sourceIndexCount": source_index_count, "count": len(rows), "errors": len(errors), "discoveredUnindexedCount": discovery["discoveredUnindexedCount"], "skippedUnindexedCount": discovery["skippedUnindexedCount"], "contentHash": bundle["contentHash"], "output": str(out_path)}


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
    for index_row in sorted(index_rows, key=index_row_order):
        rel_file = normalize_rel_path(index_row.get("file", ""))
        if not rel_file:
            continue
        entry_path = resolve_family_path(family_dir, rel_file)
        try:
            rows.append(load_json(entry_path))
        except Exception as exc:
            errors.append(f"{rel_file}: {exc}")
    bundle = {
        "schemaVersion": 3,
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
    catalog: Dict[str, Any] = {"schemaVersion": 3, "generatedAt": int(time.time()), "categories": {}, "characterFamilies": [], "report": {"categories": category_reports, "characterFamilies": families_report}}
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
    # Important: always rebuild catalog.bundle.json unless explicitly skipped.
    # data-loader.js prefers catalog.bundle.json, so rebuilding only --category weapons
    # without refreshing catalog.bundle.json leaves the live site on stale data.
    if not args.skip_catalog:
        catalog_report = build_catalog_bundle(entries_root, bundles_dir, category_reports, families_report)
    report = {"schemaVersion": 3, "generatedAt": int(time.time()), "entriesRoot": str(entries_root), "bundlesRoot": str(bundles_dir), "categories": category_reports, "characterFamilies": families_report, "catalog": catalog_report}
    write_json(entries_root / "reports" / "bundle_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
