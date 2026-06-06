#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT_MARKERS = ["apkfiles", "tools"]
CATEGORIES = ["characters", "weapons", "accessories", "bosses"]
ORDER_LOCKED_CATEGORIES = {"weapons", "accessories", "bosses"}
EXCLUDED_PATH_PARTS = {"legacy", "Legacy", "_weapon_duplicate_quarantine", "_boss_duplicate_quarantine", "_duplicate_quarantine"}

CATEGORY_CONFIG = {
    "characters": {"index": "apkfiles/entries/characters/families/index.json", "canonical": "apkfiles/entries/maps/character_order_canonical.txt", "order_map": "apkfiles/entries/maps/character_order_map.json", "report": "apkfiles/entries/reports/character_order_sync_report.json", "key_field": "family", "display_fields": ["name", "displayName", "title"], "fallback_key_field": "sourceId", "collapse_numeric_forms": False},
    "weapons": {"index": "apkfiles/entries/weapons/index.json", "canonical": "apkfiles/entries/maps/weapon_order_canonical.txt", "order_map": "apkfiles/entries/maps/weapon_order_map.json", "report": "apkfiles/entries/reports/weapon_order_sync_report.json", "key_field": "sourceId", "display_fields": ["name", "displayName"], "fallback_key_field": "name", "collapse_numeric_forms": True},
    "accessories": {"index": "apkfiles/entries/accessories/index.json", "canonical": "apkfiles/entries/maps/accessory_order_canonical.txt", "order_map": "apkfiles/entries/maps/accessory_order_map.json", "report": "apkfiles/entries/reports/accessory_order_sync_report.json", "key_field": "sourceId", "display_fields": ["name", "displayName"], "fallback_key_field": "name", "collapse_numeric_forms": False},
    "bosses": {"index": "apkfiles/entries/bosses/index.json", "canonical": "apkfiles/entries/maps/boss_order_canonical.txt", "order_map": "apkfiles/entries/maps/boss_order_map.json", "report": "apkfiles/entries/reports/boss_order_sync_report.json", "key_field": "sourceId", "display_fields": ["name", "displayName"], "fallback_key_field": "name", "collapse_numeric_forms": False},
}


def find_repo_root(start: Optional[Path] = None) -> Path:
    cur = (start or Path.cwd()).resolve()
    for path in [cur, *cur.parents]:
        if all((path / marker).exists() for marker in ROOT_MARKERS):
            return path
    raise SystemExit("ERROR: Could not locate Evertale-Optimizer repo root. Run from inside the repo.")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def load_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(read_text(path))
    except FileNotFoundError:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def strip_file_handle(value: Any) -> str:
    return re.sub(r"^\d+_", "", Path(str(value or "")).stem)


def strip_form_suffix(value: Any) -> str:
    return re.sub(r"\d+$", "", str(value or ""))


def file_handle_order(file_value: Any) -> Optional[int]:
    match = re.match(r"^(\d+)_", str(file_value or "").split("/")[-1])
    return int(match.group(1)) if match else None


def parse_order_line(line: str) -> Optional[Tuple[str, str]]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    match = re.match(r"^([A-Za-z0-9_]+)\s*(?:\((.*?)\))?\s*$", line)
    if not match:
        return None
    return match.group(1).strip(), (match.group(2) or "").strip()


def format_order_line(key: str, display: str) -> str:
    return f"{key} ({display})" if display else f"{key} ()"


def load_canonical(path: Path) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    seen = set()
    if not path.exists():
        return rows
    for line in read_text(path).splitlines():
        parsed = parse_order_line(line)
        if not parsed:
            continue
        key, display = parsed
        nkey = norm(key)
        if not nkey or nkey in seen:
            continue
        seen.add(nkey)
        rows.append({"key": key, "displayName": display})
    return rows


def row_key(row: Dict[str, Any], config: Dict[str, Any]) -> str:
    value = row.get(config["key_field"]) or row.get(config.get("fallback_key_field", ""))
    if not value and row.get("file"):
        value = strip_file_handle(row.get("file"))
    value = str(value or "").strip()
    return strip_form_suffix(value) if config.get("collapse_numeric_forms") else value


def row_source_id(row: Dict[str, Any], config: Dict[str, Any], key: str) -> str:
    value = str(row.get("sourceId") or row.get("family") or key).strip()
    return strip_form_suffix(value) if config.get("collapse_numeric_forms") else value


def row_display(row: Dict[str, Any], config: Dict[str, Any], key: str) -> str:
    for field in config["display_fields"]:
        value = str(row.get(field) or "").strip()
        if value:
            return value
    return key


def row_keys(row: Dict[str, Any], config: Dict[str, Any]) -> List[str]:
    source_id = str(row.get("sourceId") or "")
    family = str(row.get("family") or "")
    name = str(row.get("name") or "")
    title = str(row.get("title") or "")
    file_key = strip_file_handle(row.get("file")) if row.get("file") else ""
    key = row_key(row, config)
    return [k for k in [key, source_id, family, name, title, file_key] if k]


def excluded_index_row(row: Dict[str, Any]) -> bool:
    file_value = str(row.get("file") or "")
    if not file_value:
        return False
    path = Path(file_value)
    if path.name.startswith("_") or path.name.endswith("_report.json"):
        return True
    return any(part in EXCLUDED_PATH_PARTS or part.startswith("_") for part in path.parts)


def index_sort_key(row: Dict[str, Any]) -> int:
    for key in ("fileHandleOrder", "sourceOrder", "order", "visualOrder"):
        try:
            value = int(row.get(key))
            if value > 0:
                return value
        except Exception:
            pass
    return file_handle_order(row.get("file")) or 999999


def build_index_maps(index: Dict[str, Any], config: Dict[str, Any]) -> Tuple[Dict[str, Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    by_norm: Dict[str, Dict[str, Any]] = {}
    rows: List[Dict[str, Any]] = []
    excluded: List[Dict[str, Any]] = []
    for row in sorted(index.get("entries", []) or [], key=index_sort_key):
        if not isinstance(row, dict):
            continue
        if excluded_index_row(row):
            excluded.append(row)
            continue
        row_copy = dict(row)
        key = row_key(row_copy, config)
        row_copy["_canonicalKey"] = key
        row_copy["_sourceId"] = row_source_id(row_copy, config, key)
        row_copy["_displayName"] = row_display(row_copy, config, key)
        rows.append(row_copy)
        for possible_key in row_keys(row_copy, config):
            by_norm.setdefault(norm(possible_key), row_copy)
    return by_norm, rows, excluded


def sync_category(repo: Path, category: str, dry_run: bool) -> Dict[str, Any]:
    config = CATEGORY_CONFIG[category]
    index_path = repo / config["index"]
    canonical_path = repo / config["canonical"]
    order_map_path = repo / config["order_map"]
    report_path = repo / config["report"]
    index = load_json(index_path, {"entries": []}) or {"entries": []}
    canonical = load_canonical(canonical_path)
    by_norm, index_rows, excluded_rows = build_index_maps(index, config)
    order_locked = category in ORDER_LOCKED_CATEGORIES and bool(canonical)

    seeded = False
    if not canonical:
        seeded = True
        seen_seed = set()
        for row in index_rows:
            key = row.get("_canonicalKey") or row.get("_sourceId")
            nkey = norm(key)
            if not key or nkey in seen_seed:
                continue
            seen_seed.add(nkey)
            canonical.append({"key": key, "displayName": row.get("_displayName") or key})

    ordered: List[Dict[str, Any]] = []
    seen_row_ids = set()
    seen_canonical_keys = set()
    missing_canonical: List[Dict[str, str]] = []

    for canon in canonical:
        canon_key_norm = norm(canon["key"])
        matched = by_norm.get(canon_key_norm)
        if not matched:
            missing_canonical.append(canon)
            seen_canonical_keys.add(canon_key_norm)
            continue
        row_id = matched.get("_sourceId") or matched.get("_canonicalKey")
        row_key_norm = norm(matched.get("_canonicalKey") or canon["key"])
        if row_id in seen_row_ids or row_key_norm in seen_canonical_keys:
            continue
        seen_row_ids.add(row_id)
        seen_canonical_keys.add(canon_key_norm)
        seen_canonical_keys.add(row_key_norm)
        ordered.append({"key": canon["key"], "sourceId": row_id, "displayName": canon["displayName"] or matched.get("_displayName") or row_id, "file": matched.get("file"), "matchedBy": "canonical", "indexRow": matched})

    appended: List[Dict[str, str]] = []
    blocked_append: List[Dict[str, str]] = []
    for row in index_rows:
        row_id = row.get("_sourceId") or row.get("_canonicalKey")
        key = row.get("_canonicalKey") or row_id
        key_norm = norm(key)
        if not row_id or row_id in seen_row_ids or key_norm in seen_canonical_keys:
            continue
        display = row.get("_displayName") or key
        if order_locked:
            blocked_append.append({"key": key, "displayName": display, "sourceId": row_id, "file": row.get("file", "")})
            continue
        seen_row_ids.add(row_id)
        seen_canonical_keys.add(key_norm)
        appended.append({"key": key, "displayName": display})
        ordered.append({"key": key, "sourceId": row_id, "displayName": display, "file": row.get("file"), "matchedBy": "appended-new-entry", "indexRow": row})

    new_canonical = canonical + appended
    order_rows = []
    rewritten_entries = []
    for order, row in enumerate(ordered, start=1):
        clean_index_row = {k: v for k, v in row["indexRow"].items() if not k.startswith("_")}
        clean_index_row["order"] = order
        clean_index_row["sourceOrder"] = order
        clean_index_row["fileHandleOrder"] = file_handle_order(clean_index_row.get("file")) or order
        rewritten_entries.append(clean_index_row)
        order_rows.append({"order": order, "sourceOrder": order, "fileHandleOrder": clean_index_row["fileHandleOrder"], "key": row["key"], "sourceId": row["sourceId"], "displayName": row["displayName"], "file": row.get("file"), "matchedBy": row.get("matchedBy")})

    new_index = dict(index)
    new_index["schemaVersion"] = max(int(new_index.get("schemaVersion", 1)), 3)
    new_index["entries"] = rewritten_entries
    new_index["count"] = len(rewritten_entries)
    new_index["orderSource"] = str(Path(config["canonical"]).as_posix())
    new_index["orderLocked"] = order_locked
    new_index["orderGeneratedAt"] = int(time.time())

    report = {"schemaVersion": 2, "generatedAt": int(time.time()), "dryRun": dry_run, "category": category, "orderLocked": order_locked, "seededCanonicalFromCurrentIndex": seeded, "canonicalFile": str(canonical_path), "indexFile": str(index_path), "orderMap": str(order_map_path), "canonicalExistingCount": len(canonical), "indexEntryCount": len(index_rows), "excludedIndexRows": len(excluded_rows), "orderedCount": len(ordered), "appendedNewEntries": len(appended), "blockedAppends": len(blocked_append), "missingCanonicalEntries": len(missing_canonical), "appended": appended, "blockedAppendRows": blocked_append, "missingCanonical": missing_canonical}

    if not dry_run:
        write_text(canonical_path, "\n".join(format_order_line(r["key"], r["displayName"]) for r in new_canonical) + "\n")
        write_json(order_map_path, {"schemaVersion": 2, "source": f"locked canonical {category} order" if order_locked else f"append-only canonical {category} order", "generatedAt": int(time.time()), "category": category, "count": len(order_rows), "order": order_rows})
        write_json(index_path, new_index)
        write_json(report_path, report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync canonical order files for all entry categories.")
    parser.add_argument("--category", choices=CATEGORIES, default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    repo = find_repo_root()
    cats = [args.category] if args.category else CATEGORIES
    reports = [sync_category(repo, category, args.dry_run) for category in cats]
    summary = {"schemaVersion": 2, "generatedAt": int(time.time()), "dryRun": args.dry_run, "categories": reports}
    if not args.dry_run:
        write_json(repo / "apkfiles/entries/reports/category_order_sync_report.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
