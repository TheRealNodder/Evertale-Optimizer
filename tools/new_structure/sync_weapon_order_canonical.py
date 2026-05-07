#!/usr/bin/env python3
"""
Sync weapons to the append-only canonical order list.

Purpose:
- The file apkfiles/entries/maps/weapon_order_canonical.txt is the source of truth.
- Existing lines stay in place.
- New weapon entries found in apkfiles/entries/weapons/index.json are appended to the bottom.
- The script writes apkfiles/entries/maps/weapon_order_map.json.
- The script rewrites apkfiles/entries/weapons/index.json to follow the canonical order.
- It does not move or rewrite individual weapon entry files.

Run from anywhere inside the repo:
  python tools/new_structure/sync_weapon_order_canonical.py

Dry run:
  python tools/new_structure/sync_weapon_order_canonical.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

CANONICAL_REL = "apkfiles/entries/maps/weapon_order_canonical.txt"
WEAPON_INDEX_REL = "apkfiles/entries/weapons/index.json"
ORDER_MAP_REL = "apkfiles/entries/maps/weapon_order_map.json"
REPORT_REL = "apkfiles/entries/reports/weapon_order_sync_report.json"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def find_repo_root(start: Optional[Path] = None) -> Path:
    cur = (start or Path.cwd()).resolve()
    for path in [cur, *cur.parents]:
        if (path / ".git").exists() or (path / "apkfiles").exists():
            return path
    return cur


def norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def strip_form_suffix(value: str) -> str:
    return re.sub(r"\d+$", "", value or "")


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


def load_index(path: Path) -> Dict[str, Any]:
    return json.loads(read_text(path)) if path.exists() else {"entries": []}


def row_keys(row: Dict[str, Any]) -> List[str]:
    source_id = str(row.get("sourceId") or "")
    family = strip_form_suffix(source_id)
    name = str(row.get("name") or "")
    image = str(row.get("image") or "")
    image_base = re.sub(r"\.[a-z0-9]+$", "", image.split(/[?#]/)[0].split("/")[-1]) if image else ""
    return [k for k in [source_id, family, name, image_base] if k]


def build_index_maps(index: Dict[str, Any]) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    by_norm: Dict[str, Dict[str, Any]] = {}
    by_source: Dict[str, Dict[str, Any]] = {}
    for row in index.get("entries", []) or []:
        source_id = str(row.get("sourceId") or "")
        if source_id:
            by_source[source_id] = dict(row)
        for key in row_keys(row):
            by_norm.setdefault(norm(key), dict(row))
    return by_norm, by_source


def sync(canonical_path: Path, index_path: Path, order_map_path: Path, report_path: Path, dry_run: bool) -> Dict[str, Any]:
    canonical = load_canonical(canonical_path)
    index = load_index(index_path)
    by_norm, by_source = build_index_maps(index)

    ordered: List[Dict[str, Any]] = []
    seen_sources = set()
    missing_canonical: List[Dict[str, str]] = []

    for row in canonical:
        matched = by_norm.get(norm(row["key"]))
        if not matched:
            missing_canonical.append(row)
            continue
        source_id = str(matched.get("sourceId") or row["key"])
        if source_id in seen_sources:
            continue
        seen_sources.add(source_id)
        ordered.append({
            "key": row["key"],
            "sourceId": source_id,
            "displayName": row["displayName"] or matched.get("name") or source_id,
            "file": matched.get("file"),
            "matchedBy": "canonical",
            "indexRow": matched,
        })

    appended: List[Dict[str, str]] = []
    for source_id, row in by_source.items():
        if source_id in seen_sources:
            continue
        key = strip_form_suffix(source_id)
        display = str(row.get("name") or "")
        seen_sources.add(source_id)
        appended.append({"key": key, "displayName": display})
        ordered.append({
            "key": key,
            "sourceId": source_id,
            "displayName": display,
            "file": row.get("file"),
            "matchedBy": "appended-new-entry",
            "indexRow": row,
        })

    new_canonical = canonical + appended
    order_map_rows = []
    rewritten_entries = []
    for i, row in enumerate(ordered, start=1):
        order_map_rows.append({
            "order": i,
            "key": row["key"],
            "sourceId": row["sourceId"],
            "displayName": row["displayName"],
            "file": row.get("file"),
            "matchedBy": row.get("matchedBy"),
        })
        index_row = dict(row["indexRow"])
        index_row["order"] = i
        rewritten_entries.append(index_row)

    new_index = dict(index)
    new_index["entries"] = rewritten_entries
    new_index["count"] = len(rewritten_entries)
    new_index["orderSource"] = "apkfiles/entries/maps/weapon_order_canonical.txt"
    new_index["orderGeneratedAt"] = int(time.time())

    report = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "dryRun": dry_run,
        "canonicalFile": str(canonical_path),
        "weaponIndex": str(index_path),
        "orderMap": str(order_map_path),
        "canonicalExistingCount": len(canonical),
        "indexEntryCount": len(index.get("entries", []) or []),
        "orderedCount": len(ordered),
        "appendedNewEntries": len(appended),
        "missingCanonicalEntries": len(missing_canonical),
        "appended": appended,
        "missingCanonical": missing_canonical,
    }

    if not dry_run:
        write_text(canonical_path, "\n".join(format_order_line(r["key"], r["displayName"]) for r in new_canonical) + "\n")
        write_json(order_map_path, {
            "schemaVersion": 1,
            "source": "append-only canonical weapon order",
            "generatedAt": int(time.time()),
            "category": "weapons",
            "count": len(order_map_rows),
            "order": order_map_rows,
        })
        write_json(index_path, new_index)
        write_json(report_path, report)

    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    repo = find_repo_root()
    report = sync(repo / CANONICAL_REL, repo / WEAPON_INDEX_REL, repo / ORDER_MAP_REL, repo / REPORT_REL, args.dry_run)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
