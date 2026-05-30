#!/usr/bin/env python3
"""
organize_by_handle.py

Canonical organization tool for Evertale Optimizer entry files.

Rule:
  Entry filenames use this structure:
    0000_Name01.json

  The leading numeric handle is the ordering authority.
    highest number = newest
    lowest number  = oldest

Examples:
  0737_YandereMaidBallet02.json is newer than 0736_YandereMaidBallet01.json.
  0001_SomeOldUnit01.json is older than 0737_YandereMaidBallet02.json.

What this tool does:
- Scans apkfiles/entries/<category>/entries/*.json
- Extracts the leading filename handle
- Rebuilds category index.json files in handle order
- Optionally rebuilds simple order maps used by catalog sorting
- Does not change entry JSON contents

Usage:
  python tools/new_structure/organize_by_handle.py --root .
  python tools/new_structure/organize_by_handle.py --root . --write
  python tools/new_structure/organize_by_handle.py --root . --write --oldest-first

Default sort is newest-first because the website catalog default is Newest Added.
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

ENTRY_TYPES = ("characters", "weapons", "accessories", "bosses")
JSON_INDENT = 2


def read_json(path: Path) -> Optional[Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=JSON_INDENT) + "\n", encoding="utf-8")


def handle_from_filename(path: Path) -> Optional[int]:
    match = re.match(r"^(\d+)_", path.name)
    return int(match.group(1)) if match else None


def strip_numeric_prefix(stem: str) -> str:
    return re.sub(r"^\d+_", "", stem)


def strip_form_suffix(value: Any) -> str:
    return re.sub(r"\d+$", "", str(value or "").strip())


def norm(value: Any) -> str:
    text = str(value or "").lower().replace("’", "").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "", text)


def source_id_for(path: Path, data: Dict[str, Any]) -> str:
    internal = data.get("internal") if isinstance(data.get("internal"), dict) else {}
    raw = data.get("raw") if isinstance(data.get("raw"), dict) else {}
    return str(
        internal.get("sourceId")
        or internal.get("monsterId")
        or internal.get("weaponId")
        or data.get("sourceId")
        or data.get("id")
        or data.get("family")
        or raw.get("name")
        or strip_numeric_prefix(path.stem)
    )


def family_for(data: Dict[str, Any], source_id: str) -> str:
    internal = data.get("internal") if isinstance(data.get("internal"), dict) else {}
    raw = data.get("raw") if isinstance(data.get("raw"), dict) else {}
    return str(internal.get("family") or raw.get("family") or data.get("family") or strip_form_suffix(source_id))


def display_name_for(data: Dict[str, Any], source_id: str) -> str:
    return str(data.get("name") or data.get("displayName") or data.get("title") or source_id)


@dataclass(frozen=True)
class EntryHandle:
    category: str
    path: Path
    handle: int
    source_id: str
    family: str
    display_name: str

    @property
    def file(self) -> str:
        return f"entries/{self.path.name}"


def discover(root: Path, category: str) -> List[EntryHandle]:
    folder = root / "apkfiles" / "entries" / category / "entries"
    rows: List[EntryHandle] = []
    if not folder.exists():
        return rows
    for path in sorted(folder.glob("*.json")):
        handle = handle_from_filename(path)
        if handle is None:
            continue
        data = read_json(path)
        if not isinstance(data, dict):
            continue
        source_id = source_id_for(path, data)
        rows.append(
            EntryHandle(
                category=category,
                path=path,
                handle=handle,
                source_id=source_id,
                family=family_for(data, source_id),
                display_name=display_name_for(data, source_id),
            )
        )
    return rows


def sort_entries(rows: Iterable[EntryHandle], newest_first: bool = True) -> List[EntryHandle]:
    return sorted(rows, key=lambda r: (r.handle, r.source_id), reverse=newest_first)


def index_payload(category: str, rows: List[EntryHandle], newest_first: bool) -> Dict[str, Any]:
    return {
        "schemaVersion": 3,
        "category": category,
        "orderAuthority": "leading numeric filename handle in 0000_Name01.json",
        "orderDirection": "newest-first: highest handle first" if newest_first else "oldest-first: lowest handle first",
        "count": len(rows),
        "entries": [
            {
                "file": row.file,
                "sourceId": row.source_id,
                "family": row.family,
                "fileHandleOrder": row.handle,
            }
            for row in rows
        ],
    }


def order_map_payload(category: str, rows: List[EntryHandle], newest_first: bool) -> Dict[str, Any]:
    return {
        "schemaVersion": 4,
        "category": category,
        "source": "Generated by tools/new_structure/organize_by_handle.py",
        "orderAuthority": "leading numeric filename handle in 0000_Name01.json",
        "orderDirection": "newest-first: highest handle first" if newest_first else "oldest-first: lowest handle first",
        "count": len(rows),
        "order": [
            {
                "order": idx + 1,
                "visualOrder": idx + 1,
                "fileHandleOrder": row.handle,
                "sourceOrder": row.handle,
                "key": row.family,
                "sourceId": row.source_id,
                "displayName": row.display_name,
                "sortName": row.display_name,
                "file": row.file,
            }
            for idx, row in enumerate(rows)
        ],
    }


def changed_write(path: Path, payload: Dict[str, Any], write: bool) -> bool:
    current = read_json(path)
    if current == payload:
        return False
    if write:
        write_json(path, payload)
    return True


def run(root: Path, write: bool, newest_first: bool) -> Dict[str, Any]:
    changed: List[str] = []
    summary: Dict[str, Any] = {
        "schemaVersion": 1,
        "tool": "tools/new_structure/organize_by_handle.py",
        "orderRule": "0000_Name01.json leading numeric handle is canonical; highest number is newest; lowest number is oldest",
        "mode": "newest-first" if newest_first else "oldest-first",
        "write": write,
        "categories": {},
        "changedFiles": changed,
    }

    for category in ENTRY_TYPES:
        rows = sort_entries(discover(root, category), newest_first=newest_first)
        if not rows:
            summary["categories"][category] = {"count": 0}
            continue

        base = root / "apkfiles" / "entries"
        index_path = base / category / "index.json"
        map_path = base / "maps" / f"explorer_{category[:-1] if category.endswith('s') else category}_order.json"

        idx_payload = index_payload(category, rows, newest_first)
        map_payload = order_map_payload(category, rows, newest_first)

        if changed_write(index_path, idx_payload, write):
            changed.append(str(index_path.relative_to(root)))
        if changed_write(map_path, map_payload, write):
            changed.append(str(map_path.relative_to(root)))

        summary["categories"][category] = {
            "count": len(rows),
            "newest": {"handle": rows[0].handle, "sourceId": rows[0].source_id, "file": rows[0].file},
            "oldest": {"handle": rows[-1].handle, "sourceId": rows[-1].source_id, "file": rows[-1].file},
        }

    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="Repository root")
    parser.add_argument("--write", action="store_true", help="Write organized index/order files")
    parser.add_argument("--oldest-first", action="store_true", help="Use lowest handle first instead of newest-first")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    summary = run(root=root, write=args.write, newest_first=not args.oldest_first)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
