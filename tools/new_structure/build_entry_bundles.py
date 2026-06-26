#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

from path_utils import find_repo_root, resolve_repo_path

CATEGORIES = ["characters", "weapons", "accessories", "bosses"]
ROOT_MARKERS = ["apkfiles", "tools"]
EXCLUDED_DIR_NAMES = {"legacy", "Legacy", "_weapon_duplicate_quarantine", "_boss_duplicate_quarantine", "_duplicate_quarantine"}
TESTLIKE_RE = re.compile(r"(test|debug|prototype|dev|internal|placeholder|sandbox|experimental)", re.I)
STATE_SUFFIX_RE = re.compile(r"^(.*?)(\d{2})$")


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


def strip_file_handle(value: Any) -> str:
    raw = str(value or "").split("/")[-1]
    raw = re.sub(r"\.json$", "", raw, flags=re.I)
    return re.sub(r"^\d+_", "", raw)


def strip_state_suffix(value: Any) -> str:
    raw = str(value or "").strip()
    m = STATE_SUFFIX_RE.match(raw)
    return m.group(1) if m else raw


def norm_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


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


def family_from_weapon_entry(entry: Dict[str, Any], path: Path) -> str:
    internal = entry.get("internal") if isinstance(entry.get("internal"), dict) else {}
    raw = entry.get("raw") if isinstance(entry.get("raw"), dict) else {}
    family = internal.get("family") or raw.get("family") or entry.get("family")
    if family:
        return str(family).strip()
    sid = source_id_from_entry(entry, strip_file_handle(path.name))
    return strip_state_suffix(sid or strip_file_handle(path.name))


def is_source_like_name(entry: Dict[str, Any], family: str) -> bool:
    name = str(entry.get("name") or "")
    sid = source_id_from_entry(entry, "")
    keys = {norm_key(name), norm_key(sid), norm_key(family), norm_key(strip_state_suffix(sid)), norm_key(strip_file_handle(entry.get("image", "")))}
    return bool(norm_key(name) and norm_key(name) in {k for k in keys if k != norm_key(name) or k in {norm_key(sid), norm_key(family), norm_key(strip_state_suffix(sid))}})


def weapon_candidate_score(entry: Dict[str, Any], family: str, handle: int, path: Path) -> int:
    sid = source_id_from_entry(entry, path.stem)
    stem = strip_file_handle(path.name)
    score = 0
    if str(entry.get("description") or "").strip():
        score += 100
    if str(entry.get("name") or "").strip() and not is_source_like_name(entry, family):
        score += 75
    if sid.endswith("01") or stem.endswith("01"):
        score += 30
    if strip_state_suffix(stem) == stem:
        score += 20
    if str(entry.get("image") or "").strip():
        score += 10
    # Lower state is usually the localized display/base card. Keep this tiny so localized text wins first.
    score -= min(handle, 9999) // 10000
    return score


def apply_order(entry: Dict[str, Any], handle: int, source_file: str, test_like: bool = False) -> Dict[str, Any]:
    entry = dict(entry)
    entry["order"] = handle
    entry["fileHandleOrder"] = handle
    entry["sourceOrder"] = handle
    entry["_bundleSourceFile"] = source_file
    if test_like:
        entry["_testLike"] = True
    return entry


def weapon_state_row(entry: Dict[str, Any], handle: int, path: Path) -> Dict[str, Any]:
    return {
        "sourceId": source_id_from_entry(entry, path.stem),
        "name": entry.get("name"),
        "title": entry.get("title"),
        "description": entry.get("description"),
        "image": entry.get("image"),
        "stars": entry.get("stars"),
        "evolvedStars": entry.get("evolvedStars"),
        "stats": entry.get("stats"),
        "refs": entry.get("refs"),
        "resolved": entry.get("resolved"),
        "order": handle,
        "file": f"entries/{path.name}",
    }


def load_weapon_entries(category_dir: Path) -> Tuple[List[Dict[str, Any]], List[str], Dict[str, Any]]:
    errors: List[str] = []
    families: Dict[str, List[Tuple[int, Path, Dict[str, Any]]]] = {}

    for path in discover_entry_files(category_dir):
        handle = file_handle(path.name)
        try:
            entry = load_json(path)
            family = family_from_weapon_entry(entry, path)
            if not family:
                family = strip_state_suffix(strip_file_handle(path.name))
            families.setdefault(family, []).append((handle, path, entry))
        except Exception as exc:
            errors.append(f"entries/{path.name}: {exc}")

    production: List[Tuple[int, Dict[str, Any]]] = []
    testlike: List[Tuple[int, Dict[str, Any]]] = []
    collapsed_state_count = 0

    for family, variants in families.items():
        variants.sort(key=lambda row: row[0])
        max_handle = max(handle for handle, _path, _entry in variants)
        is_test = bool(TESTLIKE_RE.search(family) or any(TESTLIKE_RE.search(path.name) or TESTLIKE_RE.search(source_id_from_entry(entry, path.stem)) for _handle, path, entry in variants))
        best_handle, best_path, best_entry = max(variants, key=lambda row: weapon_candidate_score(row[2], family, row[0], row[1]))
        item = apply_order(best_entry, max_handle, f"entries/{best_path.name}", is_test)
        internal = item.get("internal") if isinstance(item.get("internal"), dict) else {}
        item["internal"] = {**internal, "family": family, "familyOrderHandle": max_handle, "displaySourceFile": f"entries/{best_path.name}"}
        item["sourceId"] = source_id_from_entry(best_entry, best_path.stem)
        item["family"] = family
        item["states"] = [weapon_state_row(entry, handle, path) for handle, path, entry in variants]
        item["stateCount"] = len(variants)
        collapsed_state_count += max(0, len(variants) - 1)
        (testlike if is_test else production).append((max_handle, item))

    production.sort(key=lambda x: x[0], reverse=True)
    testlike.sort(key=lambda x: x[0], reverse=True)
    rows = [x[1] for x in production] + [x[1] for x in testlike]
    meta = {
        "mode": "weapon_family_handle_source_of_truth",
        "orderAuthority": "one visible card per weapon family; newest is highest real 4-digit family handle",
        "familyCount": len(families),
        "productionCount": len(production),
        "testLikeCount": len(testlike),
        "collapsedStateCount": collapsed_state_count,
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
    repo = find_repo_root(Path(__file__).resolve(), markers=ROOT_MARKERS)
    entries_root = resolve_repo_path(repo, args.entries_root, "apkfiles/entries")
    bundles_dir = resolve_repo_path(repo, args.bundles_root, entries_root / "bundles")
    bundles_dir.mkdir(parents=True, exist_ok=True)

    results = [build_category(entries_root, bundles_dir, category) for category in CATEGORIES]
    results.append(build_character_families(entries_root, bundles_dir))
    results.append(build_catalog_bundle(bundles_dir))

    report = {"schemaVersion": 4, "generatedAt": int(time.time()), "entriesRoot": str(entries_root), "bundlesRoot": str(bundles_dir), "categories": results}
    report_path = entries_root / "reports" / "bundle_build_report.json"
    write_json(report_path, report)
    print(json.dumps(report, ensure_ascii=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
