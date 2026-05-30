#!/usr/bin/env python3
"""
master_control_refined.py

Safe intake/refinement helper for Evertale Optimizer entry updates.

Purpose:
- Discover existing entry/index/bundle/map files without hardcoded one-off paths.
- Build strong lookup keys for each entry so updates inject into existing files first.
- Preserve canonical numeric order based on filename prefixes / fileHandleOrder / sourceOrder.
- Produce a dry-run report by default so master-control work is predictable before writing.

Usage:
  python tools/new_structure/master_control_refined.py --root .
  python tools/new_structure/master_control_refined.py --root . --write

This script intentionally avoids overwriting unrelated data. It is a control-layer helper:
use it before/after generator rebuilds to verify discovery, matching, and order behavior.
"""
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

ENTRY_ROOT_PARTS = ("apkfiles", "entries")
ENTRY_TYPES = ("characters", "weapons", "accessories", "bosses")
JSON_INDENT = 2


def read_json(path: Path) -> Optional[Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=JSON_INDENT) + "\n", encoding="utf-8")


def norm(value: Any) -> str:
    text = str(value or "").lower().replace("’", "").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "", text)


def strip_form_suffix(value: Any) -> str:
    return re.sub(r"\d+$", "", str(value or "").strip())


def numeric_prefix(value: Any) -> Optional[int]:
    m = re.match(r"^(\d+)", str(value or ""))
    return int(m.group(1)) if m else None


def numeric_any(value: Any) -> Optional[int]:
    m = re.search(r"(\d+)", str(value or ""))
    return int(m.group(1)) if m else None


def first_number(*values: Any) -> Optional[int]:
    for value in values:
        if value is None or value == "":
            continue
        try:
            n = int(value)
            return n
        except Exception:
            n = numeric_prefix(value)
            if n is not None:
                return n
    return None


@dataclass
class EntryRecord:
    category: str
    path: Path
    data: Dict[str, Any]
    source_id: str
    family: str
    file_order: int
    keys: List[str] = field(default_factory=list)

    @property
    def display(self) -> str:
        return str(self.data.get("name") or self.data.get("title") or self.source_id or self.path.name)


def discover_entry_files(root: Path) -> List[Path]:
    base = root.joinpath(*ENTRY_ROOT_PARTS)
    paths: List[Path] = []
    for category in ENTRY_TYPES:
        for folder in (base / category / "entries", base / category / "families"):
            if folder.exists():
                paths.extend(sorted(folder.glob("*.json")))
    return paths


def category_for_path(path: Path) -> str:
    parts = path.parts
    for category in ENTRY_TYPES:
        if category in parts:
            return category
    return "unknown"


def source_id_for(path: Path, data: Dict[str, Any]) -> str:
    internal = data.get("internal") if isinstance(data.get("internal"), dict) else {}
    raw = data.get("raw") if isinstance(data.get("raw"), dict) else {}
    return str(
        internal.get("sourceId")
        or internal.get("monsterId")
        or internal.get("weaponId")
        or data.get("sourceId")
        or data.get("family")
        or data.get("id")
        or data.get("name")
        or re.sub(r"^\d+_", "", path.stem)
    )


def family_for(data: Dict[str, Any], source_id: str) -> str:
    internal = data.get("internal") if isinstance(data.get("internal"), dict) else {}
    raw = data.get("raw") if isinstance(data.get("raw"), dict) else {}
    family = internal.get("family") or raw.get("family") or data.get("family") or strip_form_suffix(source_id)
    # Known explicit duo parent rule: Clarice Ballet should inject/merge under Ludmilla Ballet.
    if family == "YandereMaidBallet" or strip_form_suffix(source_id) == "YandereMaidBallet":
        return "LudmillaBallet"
    return str(family)


def build_keys(path: Path, data: Dict[str, Any], source_id: str, family: str) -> List[str]:
    raw = data.get("raw") if isinstance(data.get("raw"), dict) else {}
    internal = data.get("internal") if isinstance(data.get("internal"), dict) else {}
    values: List[Any] = [
        path.name,
        path.stem,
        re.sub(r"^\d+_", "", path.stem),
        data.get("id"),
        data.get("name"),
        data.get("title"),
        data.get("subtitle"),
        data.get("family"),
        source_id,
        strip_form_suffix(source_id),
        family,
        internal.get("sourceId"),
        internal.get("family"),
        internal.get("monsterId"),
        internal.get("weaponId"),
        raw.get("name"),
        raw.get("family"),
    ]
    keys: List[str] = []
    seen = set()
    for value in values:
        k = norm(value)
        if k and k not in seen:
            keys.append(k)
            seen.add(k)
    return keys


def record_for(path: Path, root: Path) -> Optional[EntryRecord]:
    data = read_json(path)
    if not isinstance(data, dict):
        return None
    category = category_for_path(path)
    source_id = source_id_for(path, data)
    family = family_for(data, source_id)
    order = first_number(path.name, data.get("fileHandleOrder"), data.get("sourceOrder"), data.get("order")) or -1
    keys = build_keys(path, data, source_id, family)
    return EntryRecord(category=category, path=path.relative_to(root), data=data, source_id=source_id, family=family, file_order=order, keys=keys)


def build_index(records: Iterable[EntryRecord]) -> Dict[str, List[EntryRecord]]:
    index: Dict[str, List[EntryRecord]] = {}
    for record in records:
        for key in record.keys:
            index.setdefault(key, []).append(record)
    return index


def sort_records(records: Iterable[EntryRecord]) -> List[EntryRecord]:
    return sorted(records, key=lambda r: (r.category, -r.file_order, r.family, r.source_id, str(r.path)))


def detect_collisions(index: Dict[str, List[EntryRecord]]) -> List[Tuple[str, List[EntryRecord]]]:
    collisions = []
    for key, rows in index.items():
        families = {r.family for r in rows}
        paths = {str(r.path) for r in rows}
        if len(rows) > 1 and len(paths) > 1 and len(families) > 1:
            collisions.append((key, rows))
    return sorted(collisions, key=lambda item: (len(item[1]), item[0]), reverse=True)


def report(records: List[EntryRecord], index: Dict[str, List[EntryRecord]], root: Path) -> Dict[str, Any]:
    by_category: Dict[str, int] = {}
    for r in records:
        by_category[r.category] = by_category.get(r.category, 0) + 1
    newest = [
        {"category": r.category, "order": r.file_order, "family": r.family, "sourceId": r.source_id, "path": str(r.path)}
        for r in sorted(records, key=lambda r: r.file_order, reverse=True)[:25]
    ]
    ballet = [
        {"category": r.category, "order": r.file_order, "family": r.family, "sourceId": r.source_id, "path": str(r.path)}
        for r in records
        if "ballet" in norm(r.source_id) or "ballet" in norm(r.family) or "clarice" in norm(r.display)
    ]
    collisions = detect_collisions(index)[:50]
    return {
        "schemaVersion": 1,
        "tool": "tools/new_structure/master_control_refined.py",
        "root": str(root),
        "entryCount": len(records),
        "categoryCounts": by_category,
        "lookupKeyCount": len(index),
        "newestByNumericOrder": newest,
        "balletRelatedRecords": ballet,
        "crossFamilyKeyCollisions": [
            {"key": key, "matches": [{"family": r.family, "sourceId": r.source_id, "path": str(r.path)} for r in rows[:10]]}
            for key, rows in collisions
        ],
        "masterControlRules": {
            "matchingPriority": [
                "exact sourceId/internal.sourceId",
                "family/raw.family/internal.family",
                "filename stem without numeric prefix",
                "visible name/title/subtitle",
                "normalized fallback keys"
            ],
            "injectionPolicy": "patch existing matched JSON first; create only when no sourceId/family/name key matches",
            "orderPolicy": "preserve numeric filename prefix/fileHandleOrder/sourceOrder; newest is highest numeric handle first",
            "duoParentOverrides": {"YandereMaidBallet": "LudmillaBallet"}
        }
    }


def refresh_indexes(root: Path, records: List[EntryRecord]) -> List[Path]:
    changed: List[Path] = []
    base = root.joinpath(*ENTRY_ROOT_PARTS)
    for category in ENTRY_TYPES:
        category_records = [r for r in records if r.category == category and "/entries/" in str(r.path).replace("\\", "/")]
        if not category_records:
            continue
        rows = []
        for r in sorted(category_records, key=lambda row: row.file_order):
            rel = Path(r.path)
            try:
                file_rel = rel.relative_to(base.relative_to(root) / category)
            except Exception:
                file_rel = Path("entries") / rel.name
            rows.append({
                "file": str(file_rel).replace("\\", "/"),
                "sourceId": r.source_id,
                "family": r.family,
                "fileHandleOrder": r.file_order if r.file_order >= 0 else None,
            })
        target = base / category / "index.json"
        current = read_json(target)
        next_data = {"schemaVersion": 2, "category": category, "count": len(rows), "entries": rows}
        if current != next_data:
            write_json(target, next_data)
            changed.append(target.relative_to(root))
    return changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="Repository root")
    parser.add_argument("--write", action="store_true", help="Write refreshed indexes and report")
    parser.add_argument("--report", default="tools/new_structure/master_control_refined_report.json")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    paths = discover_entry_files(root)
    records = [r for p in paths if (r := record_for(p, root))]
    records = sort_records(records)
    index = build_index(records)
    rep = report(records, index, root)

    report_path = root / args.report
    if args.write:
        changed = refresh_indexes(root, records)
        rep["changedFiles"] = [str(p) for p in changed]
        report_path.parent.mkdir(parents=True, exist_ok=True)
        write_json(report_path, rep)
        print(f"Wrote {report_path}")
        for path in changed:
            print(f"Updated {path}")
    else:
        print(json.dumps(rep, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
