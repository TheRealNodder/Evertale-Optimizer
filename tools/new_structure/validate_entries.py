#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List

ROOT_MARKERS = ["apkfiles", "tools"]
CATEGORIES = ["characters", "weapons", "accessories", "bosses"]
# Must match build_entry_bundles.py. Accessories are not strict-index-only in the current bundle builder.
STRICT_INDEX_CATEGORIES = {"weapons", "bosses"}
REQUIRED_MARKERS = [
    "run_entry_pipeline_all.marker.json",
    "build_character_image_map.marker.json",
    "sync_character_tags.marker.json",
]
EXCLUDED_PATH_PARTS = {"legacy", "Legacy", "_weapon_duplicate_quarantine", "_boss_duplicate_quarantine", "_duplicate_quarantine"}


def find_repo_root(start: Path):
    current = start.resolve()
    for folder in [current] + list(current.parents):
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    return None


def load_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def resolve_entry_path(base: Path, category_dir: Path, rel_file: str) -> Path:
    rel = str(rel_file or "").replace("\\", "/").strip()
    if rel.startswith("entries/"):
        return category_dir / rel
    category_relative = category_dir / rel
    if category_relative.exists():
        return category_relative
    return base / rel


def is_excluded_path(path: Path) -> bool:
    return path.name.startswith("_") or path.name.endswith("_report.json") or any(part in EXCLUDED_PATH_PARTS or part.startswith("_") for part in path.parts)


def source_id_from_entry(data: Dict[str, Any], fallback: str = "") -> str:
    internal = data.get("internal") if isinstance(data.get("internal"), dict) else {}
    return str(internal.get("sourceId") or data.get("sourceId") or data.get("name") or data.get("id") or fallback).strip()


def file_handle_order(file_value: Any) -> int | None:
    match = re.match(r"^(\d+)_", str(file_value or "").split("/")[-1])
    return int(match.group(1)) if match else None


def weapon_overlay_enabled(bundle: Dict[str, Any]) -> bool:
    discovery = bundle.get("discovery", {}) if isinstance(bundle.get("discovery"), dict) else {}
    overlay = discovery.get("weaponOverlay", {}) if isinstance(discovery.get("weaponOverlay"), dict) else {}
    return bool(overlay.get("enabled"))


def effectively_strict_bundle(category: str, count: int, index_count: int, discovery: Dict[str, Any], bundle: Dict[str, Any]) -> bool:
    if discovery.get("strictIndexOnly", False):
        return True
    if discovery.get("discoveredUnindexedCount", 0):
        return False
    if category == "weapons" and weapon_overlay_enabled(bundle):
        return True
    return count == index_count


def validate_bundle(base: Path, category: str, index_count: int, errors: List[str], warnings: List[str], bundle_counts: Dict[str, Any]) -> None:
    bundle_path = base / "bundles" / f"{category}.bundle.json"
    if not bundle_path.exists():
        errors.append(f"[{category}] Missing bundle: {bundle_path}")
        return
    bundle = load_json(bundle_path, {}) or {}
    entries = bundle.get("entries") if isinstance(bundle, dict) else []
    count = len(entries or []) if isinstance(entries, list) else 0
    discovery = bundle.get("discovery", {}) if isinstance(bundle.get("discovery"), dict) else {}
    bundle_counts[category] = {"schemaVersion": bundle.get("schemaVersion"), "count": count, "sourceIndexCount": bundle.get("sourceIndexCount"), "discovery": discovery}
    if category in STRICT_INDEX_CATEGORIES:
        if bundle.get("schemaVersion", 0) < 3:
            errors.append(f"[{category}] Bundle schemaVersion is stale: {bundle.get('schemaVersion')}")
        overlay_ok = category == "weapons" and weapon_overlay_enabled(bundle)
        if count != index_count and not overlay_ok:
            errors.append(f"[{category}] Strict bundle count mismatch: index={index_count}, bundle={count}")
        if discovery.get("discoveredUnindexedCount", 0):
            errors.append(f"[{category}] Strict bundle discovered unindexed entries: {discovery.get('discoveredUnindexedCount')}")
        if not effectively_strict_bundle(category, count, index_count, discovery, bundle):
            errors.append(f"[{category}] Strict bundle missing strictIndexOnly=true")
        elif not discovery.get("strictIndexOnly", False):
            warnings.append(f"[{category}] Bundle is effectively strict but strictIndexOnly metadata is not set")


def expected_catalog_count(category: str, index_expected: int, bundle_counts: Dict[str, Any]) -> int:
    bundle = bundle_counts.get(category, {}) if isinstance(bundle_counts.get(category), dict) else {}
    discovery = bundle.get("discovery", {}) if isinstance(bundle.get("discovery"), dict) else {}
    overlay = discovery.get("weaponOverlay", {}) if isinstance(discovery.get("weaponOverlay"), dict) else {}
    if category == "weapons" and overlay.get("enabled"):
        return int(bundle.get("count") or index_expected)
    return index_expected


def validate_catalog_bundle(base: Path, category_counts: Dict[str, int], errors: List[str], warnings: List[str], bundle_counts: Dict[str, Any]) -> None:
    catalog_path = base / "bundles" / "catalog.bundle.json"
    if not catalog_path.exists():
        errors.append("[catalog] Missing catalog.bundle.json")
        return
    catalog = load_json(catalog_path, {}) or {}
    if catalog.get("schemaVersion", 0) < 3:
        errors.append(f"[catalog] schemaVersion is stale: {catalog.get('schemaVersion')}")
    categories = catalog.get("categories") if isinstance(catalog, dict) else {}
    if not isinstance(categories, dict):
        errors.append("[catalog] categories is not an object")
        return
    for category, index_expected in category_counts.items():
        expected = expected_catalog_count(category, index_expected, bundle_counts)
        actual = len(categories.get(category, []) or [])
        if actual != expected:
            errors.append(f"[catalog] Category count mismatch for {category}: expected={expected}, actual={actual}")


def validate_markers(base: Path, warnings: List[str]) -> Dict[str, Any]:
    markers_dir = base / "_markers"
    marker_status = {}
    for marker in REQUIRED_MARKERS:
        path = markers_dir / marker
        data = load_json(path, None)
        marker_status[marker] = bool(data)
        if not data:
            warnings.append(f"[markers] Missing marker: {marker}")
    return marker_status


def validate() -> int:
    repo_root = find_repo_root(Path.cwd())
    if not repo_root:
        print("ERROR: Could not locate Evertale-Optimizer repo root.")
        return 1
    base = repo_root / "apkfiles" / "entries"
    errors: List[str] = []
    warnings: List[str] = []
    checked = 0
    category_counts: Dict[str, int] = {}
    bundle_counts: Dict[str, Any] = {}
    duplicate_source_ids: Dict[str, List[str]] = {}

    print("=" * 60)
    print("Evertale Optimizer Entry Validator v4")
    print("=" * 60)
    print(f"Repo Root : {repo_root}")
    print(f"Entries   : {base}")

    if not base.exists():
        print(f"ERROR: Missing entries folder: {base}")
        return 1

    for category in CATEGORIES:
        category_dir = base / category
        index_path = category_dir / "index.json"
        if not category_dir.exists():
            errors.append(f"[{category}] Missing category folder: {category_dir}")
            category_counts[category] = 0
            continue
        index_data = load_json(index_path, None)
        if not isinstance(index_data, dict):
            errors.append(f"[{category}] Missing or invalid index.json")
            category_counts[category] = 0
            continue
        entries = index_data.get("entries", [])
        if not isinstance(entries, list):
            errors.append(f"[{category}] entries is not a list")
            category_counts[category] = 0
            continue
        category_counts[category] = len(entries)
        seen_ids: Dict[str, str] = {}
        last_order = 0
        for entry in entries:
            checked += 1
            rel_file = entry.get("file")
            source_id = str(entry.get("sourceId") or entry.get("family") or "UNKNOWN")
            if not rel_file:
                errors.append(f"[{category}] Missing file field in index for sourceId={source_id}")
                continue
            entry_path = resolve_entry_path(base, category_dir, rel_file)
            if is_excluded_path(entry_path):
                errors.append(f"[{category}] Index points to excluded path: {rel_file}")
                continue
            order = int(entry.get("fileHandleOrder") or entry.get("sourceOrder") or entry.get("order") or file_handle_order(rel_file) or 0)
            if order and order < last_order:
                warnings.append(f"[{category}] Non-monotonic order near {rel_file}: {order} after {last_order}")
            last_order = max(last_order, order)
            if source_id in seen_ids:
                duplicate_source_ids.setdefault(category, []).append(source_id)
            else:
                seen_ids[source_id] = rel_file
            if not entry_path.exists():
                errors.append(f"[{category}] Missing entry file: {rel_file} -> checked {entry_path}")
                continue
            data = load_json(entry_path, None)
            if not isinstance(data, dict):
                errors.append(f"[{category}] Invalid JSON: {rel_file}")
                continue
            for field in ["name", "category", "internal"]:
                if field not in data:
                    errors.append(f"[{category}] Missing '{field}' in {rel_file}")
            actual_sid = source_id_from_entry(data, Path(rel_file).stem)
            if category in STRICT_INDEX_CATEGORIES and source_id != "UNKNOWN" and actual_sid and actual_sid != source_id:
                warnings.append(f"[{category}] sourceId mismatch index={source_id} file={actual_sid} in {rel_file}")
            for field in ["_build", "image", "refs", "resolved"]:
                if field not in data:
                    warnings.append(f"[{category}] Missing {field}: {rel_file}")
        validate_bundle(base, category, category_counts[category], errors, warnings, bundle_counts)

    validate_catalog_bundle(base, category_counts, errors, warnings, bundle_counts)
    marker_status = validate_markers(base, warnings)
    for category, rows in duplicate_source_ids.items():
        if rows:
            errors.append(f"[{category}] Duplicate sourceIds in index: {len(rows)}")

    report = {"validatorVersion": 4, "generatedAt": int(time.time()), "repoRoot": str(repo_root), "entriesRoot": str(base), "checked": checked, "categoryCounts": category_counts, "bundleCounts": bundle_counts, "markerStatus": marker_status, "duplicateSourceIds": duplicate_source_ids, "errors": errors, "warnings": warnings}
    reports_dir = base / "reports"
    write_json(reports_dir / "validation_report.json", report)
    write_json(base / "_markers" / "validate_entries.marker.json", {"schemaVersion": 1, "tool": "validate_entries", "category": "all", "status": "failed" if errors else "complete", "lastKey": "validation", "lastSourceId": "", "lastHandle": None, "lastFile": "apkfiles/entries/reports/validation_report.json", "processedCount": checked, "totalCount": checked, "updatedAt": int(time.time()), "extra": {"errors": len(errors), "warnings": len(warnings)}})

    print(f"Checked Entries : {checked}")
    print(f"Errors          : {len(errors)}")
    print(f"Warnings        : {len(warnings)}")
    print(f"Report          : {reports_dir / 'validation_report.json'}")
    if errors:
        print("Top Errors:")
        for err in errors[:20]:
            print("-", err)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(validate())
