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
# Bosses stay index-strict because boss duplicate/quarantine naming is more volatile.
# Weapons/accessories are intentionally discovery-enabled so test/live catalogs can show the complete extracted set.
STRICT_INDEX_CATEGORIES = {"bosses"}
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
    meta = {"indexedCount": len(seen_files), "strictIndexOnly": category in STRICT_INDEX_CATEGORIES, "resolvedRenamedCount": len(resolved_renamed), "resolvedRenamedFiles": resolved_renamed[:500], "discoveredUnindexedCount": len(discovered), "discoveredUnindexedFiles": discovered[:500], "skippedUnindexedCount": len(skipped_unindexed), "skippedUnindexedFiles": skipped_unindexed[:500], "duplicateSourceIdCount": len(duplicates), "duplicateSourceIds": duplicates}
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
    rows = []
    errors = []
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
    catalog = {"schemaVersion": 4, "generatedAt": int(time.time()), "categories": categories, "characterFamilies": character_families, "missingBundles": missing, "categoryCounts": {category: len(categories.get(category, [])) for category in CATEGORIES}, "characterFamilyCount": len(character_families), "contentHash": stable_hash({"categories": categories, "characterFamilies": character_families})}
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

    results = []
    for category in CATEGORIES:
        results.append(build_category(entries_root, bundles_dir, category))
    results.append(build_character_families(entries_root, bundles_dir))
    results.append(build_catalog_bundle(bundles_dir))

    report = {"schemaVersion": 4, "generatedAt": int(time.time()), "entriesRoot": str(entries_root), "bundlesRoot": str(bundles_dir), "strictIndexCategories": sorted(STRICT_INDEX_CATEGORIES), "categories": results}
    report_path = entries_root / "reports" / "bundle_build_report.json"
    write_json(report_path, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
