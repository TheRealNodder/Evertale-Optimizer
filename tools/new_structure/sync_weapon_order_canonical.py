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


def primary_source_id(value: str) -> str:
    base = strip_form_suffix(value)
    return f"{base}01" if base else value


def file_handle_order(file_value: Any) -> int:
    match = re.match(r"^(\d+)_", str(file_value or "").split("/")[-1])
    return int(match.group(1)) if match else 999999


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
    image_clean = re.split(r"[?#]", image, maxsplit=1)[0] if image else ""
    image_base = re.sub(r"\.[a-z0-9]+$", "", image_clean.split("/")[-1]) if image_clean else ""
    return [k for k in [source_id, family, name, image_base] if k]


def build_index_maps(index: Dict[str, Any]) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    by_norm: Dict[str, Dict[str, Any]] = {}
    by_source: Dict[str, Dict[str, Any]] = {}
    for row in index.get("entries", []) or []:
        source_id = str(row.get("sourceId") or "")
        family_id = strip_form_suffix(source_id)
        row_copy = dict(row)
        if family_id:
            by_source.setdefault(family_id, row_copy)
        for key in row_keys(row) + [family_id]:
            by_norm.setdefault(norm(strip_form_suffix(key)), row_copy)
            by_norm.setdefault(norm(key), row_copy)
    return by_norm, by_source


def sync(canonical_path: Path, index_path: Path, order_map_path: Path, report_path: Path, dry_run: bool) -> Dict[str, Any]:
    index = load_index(index_path)
    by_norm, by_source = build_index_maps(index)

    # Weapon chronology is the file-handle prefix.  0001_* is oldest; larger
    # prefixes are newer.  Rebuild the canonical list and order map from that
    # numeric prefix instead of trusting stale canonical/sourceOrder values.
    rows = []
    seen_sources = set()
    for source_id, row in by_source.items():
        if source_id in seen_sources:
            continue
        seen_sources.add(source_id)
        key = strip_form_suffix(source_id)
        display = str(row.get("name") or row.get("displayName") or key)
        rows.append({
            "key": key,
            "sourceId": source_id,
            "displayName": display,
            "file": row.get("file"),
            "matchedBy": "file-handle",
            "indexRow": row,
            "handleOrder": file_handle_order(row.get("file")),
        })

    rows.sort(key=lambda row: (int(row["handleOrder"]), str(row["key"]).lower()))

    order_map_rows = []
    rewritten_entries = []
    new_canonical = []
    for row in rows:
        handle_order = int(row["handleOrder"]) if int(row["handleOrder"]) != 999999 else len(order_map_rows) + 1
        new_canonical.append({"key": row["key"], "displayName": row["displayName"]})
        order_map_rows.append({
            "order": handle_order,
            "sourceOrder": handle_order,
            "fileHandleOrder": handle_order,
            "key": row["key"],
            "sourceId": row["sourceId"],
            "displayName": row["displayName"],
            "file": row.get("file"),
            "matchedBy": row.get("matchedBy"),
        })
        index_row = dict(row["indexRow"])
        index_row["order"] = handle_order
        index_row["sourceOrder"] = handle_order
        index_row["fileHandleOrder"] = handle_order
        rewritten_entries.append(index_row)

    new_index = dict(index)
    new_index["schemaVersion"] = max(int(new_index.get("schemaVersion", 1)), 3)
    new_index["entries"] = rewritten_entries
    new_index["count"] = len(rewritten_entries)
    new_index["orderSource"] = "file-handle-prefix"
    new_index["orderGeneratedAt"] = int(time.time())

    report = {
        "schemaVersion": 2,
        "generatedAt": int(time.time()),
        "dryRun": dry_run,
        "canonicalFile": str(canonical_path),
        "weaponIndex": str(index_path),
        "orderMap": str(order_map_path),
        "indexEntryCount": len(index.get("entries", []) or []),
        "orderedCount": len(rows),
        "orderAuthority": "file-handle-prefix: 0001 oldest, highest prefix newest; canonical/index stored oldest-to-newest",
    }

    if not dry_run:
        write_text(canonical_path, "\n".join(format_order_line(r["key"], r["displayName"]) for r in new_canonical) + "\n")
        write_json(order_map_path, {
            "schemaVersion": 3,
            "source": "file-handle weapon order; 0001 oldest, highest prefix newest",
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
