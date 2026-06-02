#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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


def strip_handle(value: str) -> str:
    return re.sub(r"^\d+_", "", str(value or "")).replace(".json", "")


def suffix_aliases(value: str) -> List[str]:
    raw = str(value or "").strip()
    if not raw:
        return []
    vals = {raw, strip_handle(raw)}
    for v in list(vals):
        if v.endswith("01"):
            vals.add(v[:-2])
        else:
            vals.add(v + "01")
    return [v for v in vals if v]


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


def find_renamed_entry_path(category_dir: Path, index_row: Dict[str, Any], rel_file: str) -> Optional[Path]:
    entries_dir = category_dir / "entries"
    if not entries_dir.exists():
        return None
    seed_values = [
        index_row.get("sourceId"),
        index_row.get("key"),
        index_row.get("id"),
        strip_handle(Path(str(rel_file or "")).stem),
    ]
    seen = set()
    for value in seed_values:
        for alias in suffix_aliases(str(value or "")):
            if alias in seen:
                continue
            seen.add(alias)
            exact = entries_dir / f"{alias}.json"
            if exact.exists():
                return exact
            matches = sorted(entries_dir.glob(f"*_{alias}.json"))
            matches = [p for p in matches if p.is_file() and not is_excluded_entry_file(p)]
            if len(matches) == 1:
                return matches[0]
    return None


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


def find_duplicate_source_ids(rows: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    seen: Dict[str, List[str]] = {}
    for entry in rows:
        sid = source_id_from_entry(entry, "")
        if sid:
            seen.setdefault(sid, []).append(str(entry.get("_bundleSourceFile", "")))
    return {sid: files for sid, files in seen.items() if len(files) > 1}


def load_entries_with_discovery(category_dir: Path, category: str) -> Tuple[List[Dict[str, Any]], List[str], Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    errors: List[str] = []
    seen_files: set[str] = set()
    seen_ids: set[str] = set()
    resolved_renamed: List[Dict[str, str]] = []

    for index_row in read_index_entries(category_dir):
        rel_file = normalize_rel_path(index_row.get("file", ""))
        if not rel_file:
            continue
        entry_path = resolve_entry_path(category_dir, rel_file)
        if not entry_path.exists():
            renamed_path = find_renamed_entry_path(category_dir, index_row, rel_file)
            if renamed_path:
                resolved_renamed.append({"indexedFile": rel_file, "resolvedFile": f"entries/{renamed_path.name}"})
                entry_path = renamed_path
        seen_files.add(entry_path.name)
        if is_excluded_entry_file(entry_path):
            errors.append(f"excluded indexed file skipped: {rel_file}")
            continue
        try:
            entry = load_json(entry_path)
            sid = source_id_from_entry(entry, entry_path.stem)
            if sid:
                seen_ids.add(sid)
            entry["_bundleSourceFile"] = rel_file if entry_path.name == Path(rel_file).name else f"entries/{entry_path.name}"
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
                entry["_bundleSourceFile"] = f"entries/{entry_path.name}"
                rows.append(entry)
                discovered.append(entry_path.name)
            except Exception as exc:
                errors.append(f"entries/{entry_path.name}: {exc}")
    else:
        for entry_path in discover_entry_files(category_dir):
            if entry_path.name not in seen_files:
                skipped_unindexed.append(entry_path.name)

    duplicates = find_duplicate_source_ids(rows)
    meta = {"indexedCount": len(seen_files), "strictIndexOnly": category in STRICT_INDEX_CATEGORIES, "resolvedRenamedCount": len(resolved_renamed), "resolvedRenamedFiles": resolved_renamed[:500], "discoveredUnindexedCount": len(discovered), "discoveredUnindexedFiles": discovered, "skippedUnindexedCount": len(skipped_unindexed), "skippedUnindexedFiles": skipped_unindexed[:500], "duplicateSourceIdCount": len(duplicates), "duplicateSourceIds": duplicates}
    return rows, errors, meta


def strip_bundle_internal_markers(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    clean = []
    for row in rows:
        clean.append({k: v for k, v in row.items() if not k.startswith("_bundle")})
    return clean


def build_category(entries_root: Path, bundles_dir: Path, category: str) -> Dict[str, Any]:
    category_dir = entries_root / category
    index_path = category_dir / "index.json"
    if not index_path.exists():
        return {"category": category, "status": "missing_index", "count": 0}
    source_index_count = len(read_index_entries(category_dir))
    rows, errors, discovery = load_entries_with_discovery(category_dir, category)
    clean_rows = strip_bundle_internal_markers(rows)
    if category in STRICT_INDEX_CATEGORIES and len(clean_rows) != source_index_count:
        errors.append(f"strict_count_mismatch index={source_index_count} bundle={len(clean_rows)}")
    if discovery.get("duplicateSourceIdCount"):
        errors.append(f"duplicate_source_ids={discovery.get('duplicateSourceIdCount')}")
    bundle = {"schemaVersion": 4, "category": category, "generatedAt": int(time.time()), "sourceIndexCount": source_index_count, "discovery": discovery, "count": len(clean_rows), "errors": errors, "contentHash": stable_hash(clean_rows), "entries": clean_rows}
    out_path = bundles_dir / f"{category}.bundle.json"
    write_json(out_path, bundle)
    return {"category": category, "status": "ok" if not errors else "warning", "sourceIndexCount": source_index_count, "count": len(clean_rows), "errors": len(errors), "resolvedRenamedCount": discovery.get("resolvedRenamedCount", 0), "discoveredUnindexedCount": discovery["discoveredUnindexedCount"], "skippedUnindexedCount": discovery["skippedUnindexedCount"], "duplicateSourceIdCount": discovery["duplicateSourceIdCount"], "contentHash": bundle["contentHash"], "output": str(out_path)}


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
    bundle = {"schemaVersion": 4, "category": "character_families", "generatedAt": int(time.time()), "sourceIndexCount": len(index_rows), "count": len(rows), "errors": errors, "contentHash": stable_hash(rows), "entries": rows}
    out_path = bundles_dir / "character_families.bundle.json"
    write_json(out_path, bundle)
    return {"category": "character_families", "status": "ok" if not errors else "warning", "sourceIndexCount": len(index_rows), "count": len(rows), "errors": len(errors), "contentHash": bundle["contentHash"], "output": str(out_path)}


def build_catalog_bundle(entries_root: Path, bundles_dir: Path, category_reports: List[Dict[str, Any]], families_report: Dict[str, Any]) -> Dict[str, Any]:
    catalog: Dict[str, Any] = {"schemaVersion": 4, "generatedAt": int(time.time()), "categories": {}, "characterFamilies": [], "report": {"categories": category_reports, "characterFamilies": families_report}}
    missing_bundles = []
    for category in CATEGORIES:
        bundle_path = bundles_dir / f"{category}.bundle.json"
        if bundle_path.exists():
            bundle = load_json(bundle_path)
            catalog["categories"][category] = bundle.get("entries", [])
        else:
            catalog["categories"][category] = []
            missing_bundles.append(category)
    families_path = bundles_dir / "character_families.bundle.json"
    if families_path.exists():
        bundle = load_json(families_path)
        catalog["characterFamilies"] = bundle.get("entries", [])
    catalog["missingBundles"] = missing_bundles
    catalog["categoryCounts"] = {k: len(v) for k, v in catalog["categories"].items()}
    catalog["contentHash"] = stable_hash({"categories": catalog["categories"], "characterFamilies": catalog["characterFamilies"]})
    out_path = bundles_dir / "catalog.bundle.json"
    write_json(out_path, catalog)
    return {"category": "catalog", "status": "ok" if not missing_bundles else "warning", "count": sum(len(v) for v in catalog["categories"].values()), "characterFamilies": len(catalog["characterFamilies"]), "missingBundles": missing_bundles, "categoryCounts": catalog["categoryCounts"], "contentHash": catalog["contentHash"], "output": str(out_path)}


def write_marker(entries_root: Path, report: Dict[str, Any]) -> None:
    write_json(entries_root / "_markers" / "build_entry_bundles.marker.json", {"schemaVersion": 1, "tool": "build_entry_bundles", "category": "all", "status": "complete", "lastKey": "bundles", "lastSourceId": "", "lastHandle": None, "lastFile": "apkfiles/entries/reports/bundle_report.json", "processedCount": sum(c.get("count", 0) for c in report.get("categories", [])), "totalCount": sum(c.get("sourceIndexCount", 0) for c in report.get("categories", [])), "updatedAt": int(time.time()), "extra": {"report": "apkfiles/entries/reports/bundle_report.json", "schemaVersion": report.get("schemaVersion"), "catalogHash": (report.get("catalog") or {}).get("contentHash")}})


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
    if not args.skip_catalog:
        catalog_report = build_catalog_bundle(entries_root, bundles_dir, category_reports, families_report)
    report = {"schemaVersion": 4, "generatedAt": int(time.time()), "entriesRoot": str(entries_root), "bundlesRoot": str(bundles_dir), "categories": category_reports, "characterFamilies": families_report, "catalog": catalog_report}
    write_json(entries_root / "reports" / "bundle_report.json", report)
    write_marker(entries_root, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
