#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any, Dict, List

CATEGORIES = ["characters", "weapons", "accessories", "bosses"]


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8", newline="\n")


def build_category(entries_root: Path, bundles_dir: Path, category: str) -> Dict[str, Any]:
    category_dir = entries_root / category
    index_path = category_dir / "index.json"
    if not index_path.exists():
        return {"category": category, "status": "missing_index", "count": 0}

    index = load_json(index_path)
    rows: List[Dict[str, Any]] = []
    errors: List[str] = []

    for index_row in index.get("entries", []):
        rel_file = str(index_row.get("file", "")).replace("\\", "/")
        if not rel_file:
            continue
        entry_path = category_dir / rel_file
        try:
            entry = load_json(entry_path)
            rows.append(entry)
        except Exception as exc:
            errors.append(f"{rel_file}: {exc}")

    bundle = {
        "schemaVersion": 1,
        "category": category,
        "generatedAt": int(time.time()),
        "sourceIndexCount": len(index.get("entries", [])),
        "count": len(rows),
        "errors": errors,
        "entries": rows,
    }

    out_path = bundles_dir / f"{category}.bundle.json"
    write_json(out_path, bundle)

    return {
        "category": category,
        "status": "ok",
        "sourceIndexCount": len(index.get("entries", [])),
        "count": len(rows),
        "errors": len(errors),
        "output": str(out_path),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--entries", default="apkfiles/entries")
    parser.add_argument("--category", choices=CATEGORIES, default=None)
    args = parser.parse_args()

    entries_root = Path(args.entries).resolve()
    bundles_dir = entries_root / "bundles"
    categories = [args.category] if args.category else CATEGORIES

    report = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "entriesRoot": str(entries_root),
        "bundlesRoot": str(bundles_dir),
        "categories": [build_category(entries_root, bundles_dir, category) for category in categories],
    }

    write_json(entries_root / "reports" / "bundle_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
