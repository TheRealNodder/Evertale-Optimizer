#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT_MARKERS = ["apkfiles", "tools"]
CATEGORIES = ["weapons", "accessories", "bosses"]

CONFIG = {
    "weapons": {
        "folder": "apkfiles/entries/weapons/entries",
        "index": "apkfiles/entries/weapons/index.json",
        "width": 4,
    },
    "accessories": {
        "folder": "apkfiles/entries/accessories/entries",
        "index": "apkfiles/entries/accessories/index.json",
        "width": 4,
    },
    "bosses": {
        "folder": "apkfiles/entries/bosses/entries",
        "index": "apkfiles/entries/bosses/index.json",
        "width": 4,
    },
}


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root")


def load_json(path: Path, fallback: Any):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return fallback


def write_json(path: Path, data: Any):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def strip_prefix(name: str) -> str:
    return re.sub(r"^\d+_", "", name)


def sort_key(row: Dict[str, Any], fallback_index: int) -> Tuple[int, str, int]:
    order = row.get("order")
    try:
        order_num = int(order)
    except Exception:
        order_num = fallback_index + 1
    file_name = Path(str(row.get("file") or "")).name
    base = strip_prefix(file_name)
    return order_num, base.lower(), fallback_index


def renumber_category(repo: Path, category: str, dry_run: bool = False) -> Dict[str, Any]:
    cfg = CONFIG[category]
    folder = repo / cfg["folder"]
    index_path = repo / cfg["index"]
    index = load_json(index_path, {"entries": []}) or {"entries": []}
    rows = [row for row in index.get("entries", []) if isinstance(row, dict)]
    rows_sorted = sorted(enumerate(rows), key=lambda pair: sort_key(pair[1], pair[0]))

    changes: List[Dict[str, Any]] = []
    updated_entries: List[Dict[str, Any]] = []
    used_names = set()

    for new_num, (_old_pos, row) in enumerate(rows_sorted, start=1):
        old_file = str(row.get("file") or "").replace("\\", "/").lstrip("./")
        old_name = Path(old_file).name
        base_name = strip_prefix(old_name)
        new_name = f"{new_num:0{cfg['width']}d}_{base_name}"
        if new_name in used_names:
            stem = Path(base_name).stem
            suffix = Path(base_name).suffix
            new_name = f"{new_num:0{cfg['width']}d}_{stem}_{new_num}{suffix}"
        used_names.add(new_name)

        old_path = folder / old_name
        new_path = folder / new_name

        updated = dict(row)
        updated["file"] = f"entries/{new_name}"
        updated["order"] = new_num
        updated_entries.append(updated)

        if old_name != new_name:
            changes.append({
                "from": str(old_path.relative_to(repo)),
                "to": str(new_path.relative_to(repo)),
            })
            if not dry_run:
                if old_path.exists():
                    new_path.parent.mkdir(parents=True, exist_ok=True)
                    if new_path.exists():
                        new_path.unlink()
                    shutil.move(str(old_path), str(new_path))

    if not dry_run:
        index["entries"] = updated_entries
        index["count"] = len(updated_entries)
        index["renumberedAt"] = int(time.time())
        write_json(index_path, index)

    return {
        "category": category,
        "count": len(updated_entries),
        "renamedCount": len(changes),
        "changes": changes,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Renumber non-character entry files with 0001_ style prefixes and update indexes.")
    parser.add_argument("--category", choices=CATEGORIES, default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    repo = find_repo_root(Path.cwd())
    categories = [args.category] if args.category else CATEGORIES
    reports = [renumber_category(repo, category, args.dry_run) for category in categories]

    report = {
        "generatedAt": int(time.time()),
        "dryRun": args.dry_run,
        "categories": reports,
    }
    if not args.dry_run:
        write_json(repo / "apkfiles/entries/reports/entry_file_renumber_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
