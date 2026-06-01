#!/usr/bin/env python3
"""
Universal category renumber tool for Evertale entry folders.

Purpose:
- Renumber weapons now, and accessories/bosses later, from a plain ordered list.
- Can be run from repo root OR from tools/new_structure.
- Can auto-detect a default order list file when --order-list is omitted.
- Runs the full internal flow in one command: parse list, match entries, write report, dry-run or apply.

List format:
  InternalCodeTitle (In-game display name)
  BasicHammer ()

Default ordering:
  Bottom line = 0001_
  Numbers increase upward.

Examples:
  python tools/new_structure/renumber_category_from_order_list.py --category weapons
  python tools/new_structure/renumber_category_from_order_list.py --category weapons --apply
  python renumber_category_from_order_list.py --category weapons
  python renumber_category_from_order_list.py --category weapons --apply
"""
from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

CATEGORY_CONFIG = {
    "weapons": {
        "index": "apkfiles/entries/weapons/index.json",
        "entries_dir": "apkfiles/entries/weapons/entries",
        "canonical": "apkfiles/entries/maps/weapon_order_canonical.txt",
        "order_map": "apkfiles/entries/maps/weapon_order_map.json",
        "explorer_order_map": "apkfiles/entries/maps/explorer_weapon_order.json",
        "report": "apkfiles/entries/reports/weapon_renumber_report.json",
        "marker": "apkfiles/entries/_markers/renumber_category_weapons.marker.json",
        "default_order_lists": [
            "weapon_order.txt",
            "tools/new_structure/weapon_order.txt",
            "apkfiles/entries/maps/weapon_order_canonical.txt",
        ],
        "collapse_numeric_forms": True,
        "default_suffix": "01",
    },
    "accessories": {
        "index": "apkfiles/entries/accessories/index.json",
        "entries_dir": "apkfiles/entries/accessories/entries",
        "canonical": "apkfiles/entries/maps/accessory_order_canonical.txt",
        "order_map": "apkfiles/entries/maps/accessory_order_map.json",
        "explorer_order_map": "apkfiles/entries/maps/explorer_accessory_order.json",
        "report": "apkfiles/entries/reports/accessory_renumber_report.json",
        "marker": "apkfiles/entries/_markers/renumber_category_accessories.marker.json",
        "default_order_lists": [
            "accessory_order.txt",
            "tools/new_structure/accessory_order.txt",
            "apkfiles/entries/maps/accessory_order_canonical.txt",
        ],
        "collapse_numeric_forms": True,
        "default_suffix": "01",
    },
    "bosses": {
        "index": "apkfiles/entries/bosses/index.json",
        "entries_dir": "apkfiles/entries/bosses/entries",
        "canonical": "apkfiles/entries/maps/boss_order_canonical.txt",
        "order_map": "apkfiles/entries/maps/boss_order_map.json",
        "explorer_order_map": "apkfiles/entries/maps/explorer_boss_order.json",
        "report": "apkfiles/entries/reports/boss_renumber_report.json",
        "marker": "apkfiles/entries/_markers/renumber_category_bosses.marker.json",
        "default_order_lists": [
            "boss_order.txt",
            "tools/new_structure/boss_order.txt",
            "apkfiles/entries/maps/boss_order_canonical.txt",
        ],
        "collapse_numeric_forms": False,
        "default_suffix": "",
    },
}

ROOT_MARKERS = ("apkfiles", "tools")


def find_repo_root(start: Optional[Path] = None) -> Path:
    cur = (start or Path.cwd()).resolve()
    for path in [cur, *cur.parents]:
        if all((path / marker).exists() for marker in ROOT_MARKERS):
            return path
    raise SystemExit("ERROR: Could not locate Evertale-Optimizer repo root. Run inside the repo or tools/new_structure.")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def read_json(path: Path) -> Any:
    return json.loads(read_text(path))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def strip_form_suffix(value: Any) -> str:
    return re.sub(r"\d+$", "", str(value or "").strip())


def parse_order_line(line: str) -> Optional[Tuple[str, str]]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    match = re.match(r"^([A-Za-z0-9_]+)\s*\((.*?)\)\s*$", line)
    if not match:
        return None
    return match.group(1).strip(), match.group(2).strip()


def format_order_line(key: str, display: str) -> str:
    return f"{key} ({display})" if display else f"{key} ()"


def handle_from_file(file_value: Any) -> Optional[int]:
    match = re.match(r"^(\d+)_", str(file_value or "").split("/")[-1])
    return int(match.group(1)) if match else None


def json_source_id(data: Dict[str, Any], fallback: str) -> str:
    internal = data.get("internal") if isinstance(data.get("internal"), dict) else {}
    raw = data.get("raw") if isinstance(data.get("raw"), dict) else {}
    return str(
        data.get("sourceId")
        or internal.get("sourceId")
        or internal.get("weaponId")
        or internal.get("accessoryId")
        or internal.get("bossId")
        or raw.get("name")
        or fallback
    )


def resolve_order_list(root: Path, category: str, supplied: Optional[Path]) -> Path:
    if supplied:
        candidate = supplied if supplied.is_absolute() else (Path.cwd() / supplied)
        if candidate.exists():
            return candidate.resolve()
        candidate = root / supplied
        if candidate.exists():
            return candidate.resolve()
        raise SystemExit(f"ERROR: Order list not found: {supplied}")
    for rel in CATEGORY_CONFIG[category]["default_order_lists"]:
        candidate = root / rel
        if candidate.exists():
            return candidate.resolve()
    expected = " or ".join(CATEGORY_CONFIG[category]["default_order_lists"])
    raise SystemExit(f"ERROR: No order list found for {category}. Create one of: {expected}")


@dataclass
class DesiredRow:
    handle: int
    key: str
    display_name: str


@dataclass
class EntryMatch:
    desired: DesiredRow
    source_id: str
    old_file: str
    old_path: Path
    new_file: str
    new_path: Path
    index_row: Dict[str, Any]
    data: Dict[str, Any]


def load_desired(order_list: Path, bottom_is_oldest: bool) -> List[DesiredRow]:
    parsed: List[Tuple[str, str]] = []
    invalid: List[str] = []
    for line in read_text(order_list).splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        row = parse_order_line(stripped)
        if row:
            parsed.append(row)
        else:
            invalid.append(stripped)
    if invalid:
        raise SystemExit("ERROR: Invalid order-list lines. Expected InternalName (Display Name):\n" + "\n".join(invalid[:20]))
    ordered = list(reversed(parsed)) if bottom_is_oldest else parsed
    return [DesiredRow(handle=i, key=key, display_name=display) for i, (key, display) in enumerate(ordered, start=1)]


def build_match_maps(index: Dict[str, Any], entries_dir: Path, config: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for row in index.get("entries", []) or []:
        file_rel = str(row.get("file") or "")
        path = entries_dir.parent / file_rel if file_rel else None
        data = read_json(path) if path and path.exists() else {}
        source_id = str(row.get("sourceId") or json_source_id(data, Path(file_rel).stem))
        base = strip_form_suffix(source_id) if config.get("collapse_numeric_forms") else source_id
        keys = [source_id, base, row.get("name"), row.get("displayName"), Path(file_rel).stem]
        image = str(row.get("image") or "")
        if image:
            keys.append(re.sub(r"\.[a-z0-9]+$", "", image.split("/")[-1]))
        payload = {"row": row, "data": data, "path": path, "sourceId": source_id}
        for key in keys:
            n = norm(key)
            if n and n not in out:
                out[n] = payload
    return out


def desired_source_id(key: str, config: Dict[str, Any]) -> str:
    if config.get("collapse_numeric_forms") and not re.search(r"\d+$", key):
        return f"{key}{config.get('default_suffix', '01')}"
    return key


def write_marker(root: Path, config: Dict[str, Any], category: str, status: str, report: Dict[str, Any]) -> None:
    payload = {
        "schemaVersion": 1,
        "tool": "renumber_category_from_order_list",
        "category": category,
        "status": status,
        "lastKey": report.get("lastKey", ""),
        "lastSourceId": report.get("lastSourceId", ""),
        "lastHandle": report.get("lastHandle"),
        "lastFile": report.get("lastFile", ""),
        "processedCount": report.get("matchedCount", 0),
        "totalCount": report.get("desiredCount", 0),
        "updatedAt": int(time.time()),
        "extra": {
            "missingCount": report.get("missingCount", 0),
            "unmatchedExistingCount": report.get("unmatchedExistingCount", 0),
            "write": report.get("write", False),
            "report": config["report"],
        },
    }
    write_json(root / config["marker"], payload)


def run(category: str, order_list: Path, write: bool, bottom_is_oldest: bool) -> Dict[str, Any]:
    if category not in CATEGORY_CONFIG:
        raise SystemExit(f"Unsupported category {category}. Choose: {', '.join(CATEGORY_CONFIG)}")
    root = find_repo_root()
    config = CATEGORY_CONFIG[category]
    order_list = resolve_order_list(root, category, order_list)
    index_path = root / config["index"]
    entries_dir = root / config["entries_dir"]
    canonical_path = root / config["canonical"]
    order_map_path = root / config["order_map"]
    explorer_order_map_path = root / config["explorer_order_map"]
    report_path = root / config["report"]

    desired = load_desired(order_list, bottom_is_oldest=bottom_is_oldest)
    index = read_json(index_path)
    by_key = build_match_maps(index, entries_dir, config)
    matches: List[EntryMatch] = []
    missing: List[Dict[str, Any]] = []
    used_sources = set()

    for row in desired:
        lookup_keys = [row.key, desired_source_id(row.key, config)]
        found = None
        for key in lookup_keys:
            found = by_key.get(norm(key))
            if found:
                break
        if not found:
            missing.append({"handle": row.handle, "key": row.key, "displayName": row.display_name})
            continue
        source_id = str(found["sourceId"])
        if source_id in used_sources:
            continue
        used_sources.add(source_id)
        old_path = found["path"]
        if not old_path or not old_path.exists():
            missing.append({"handle": row.handle, "key": row.key, "displayName": row.display_name, "reason": "file-missing"})
            continue
        new_file_name = f"{row.handle:04d}_{source_id}.json"
        new_path = entries_dir / new_file_name
        matches.append(EntryMatch(row, source_id, str(found["row"].get("file") or ""), old_path, f"entries/{new_file_name}", new_path, dict(found["row"]), dict(found["data"])))

    unmatched_existing = []
    for row in index.get("entries", []) or []:
        sid = str(row.get("sourceId") or "")
        if sid and sid not in used_sources:
            unmatched_existing.append({"sourceId": sid, "file": row.get("file"), "name": row.get("name")})

    if write:
        temp_moves = []
        for match in matches:
            if match.old_path.resolve() == match.new_path.resolve():
                continue
            tmp = match.old_path.with_name(match.old_path.name + ".renumber_tmp")
            if tmp.exists():
                tmp.unlink()
            match.old_path.rename(tmp)
            temp_moves.append((tmp, match.new_path))
        for tmp, final in temp_moves:
            if final.exists():
                final.unlink()
            tmp.rename(final)

    index_entries = []
    order_rows = []
    for i, match in enumerate(matches, start=1):
        index_row = dict(match.index_row)
        index_row["order"] = i
        index_row["fileHandleOrder"] = match.desired.handle
        index_row["sourceOrder"] = match.desired.handle
        index_row["sourceId"] = match.source_id
        index_row["name"] = match.desired.display_name
        index_row["file"] = match.new_file
        index_entries.append(index_row)
        order_rows.append({
            "order": i,
            "visualOrder": i,
            "fileHandleOrder": match.desired.handle,
            "sourceOrder": match.desired.handle,
            "key": match.desired.key,
            "sourceId": match.source_id,
            "displayName": match.desired.display_name,
            "sortName": match.desired.display_name,
            "file": match.new_file,
        })

    new_index = dict(index)
    new_index["schemaVersion"] = max(int(new_index.get("schemaVersion", 1)), 3)
    new_index["category"] = category
    new_index["count"] = len(index_entries)
    new_index["orderAuthority"] = "plain ordered list; bottom line = 0001_"
    new_index["orderGeneratedAt"] = int(time.time())
    new_index["entries"] = index_entries

    order_payload = {
        "schemaVersion": 4,
        "source": "Generated by renumber_category_from_order_list.py",
        "generatedAt": int(time.time()),
        "category": category,
        "orderAuthority": "plain ordered list; bottom line = 0001_",
        "count": len(order_rows),
        "order": order_rows,
    }

    canonical_text = "\n".join(format_order_line(r.key, r.display_name) for r in desired) + "\n"
    last = matches[-1] if matches else None
    report = {
        "schemaVersion": 2,
        "generatedAt": int(time.time()),
        "category": category,
        "write": write,
        "orderList": str(order_list.relative_to(root) if order_list.is_relative_to(root) else order_list),
        "desiredCount": len(desired),
        "matchedCount": len(matches),
        "missingCount": len(missing),
        "unmatchedExistingCount": len(unmatched_existing),
        "lastKey": last.desired.key if last else "",
        "lastSourceId": last.source_id if last else "",
        "lastHandle": last.desired.handle if last else None,
        "lastFile": last.new_file if last else "",
        "missing": missing,
        "unmatchedExisting": unmatched_existing,
        "renamed": [{"from": str(m.old_path.relative_to(root)), "to": str(m.new_path.relative_to(root))} for m in matches if m.old_path != m.new_path],
    }

    if write:
        write_text(canonical_path, canonical_text)
        write_json(index_path, new_index)
        write_json(order_map_path, order_payload)
        write_json(explorer_order_map_path, order_payload)
    write_json(report_path, report)
    write_marker(root, config, category, "complete" if write else "dry-run", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Renumber weapons/accessories/bosses from an ordered text list.")
    parser.add_argument("--category", required=True, choices=sorted(CATEGORY_CONFIG))
    parser.add_argument("--order-list", type=Path, default=None, help="Optional list file. If omitted, the tool auto-detects category defaults.")
    parser.add_argument("--apply", action="store_true", help="Actually rename files and rewrite index/maps. Default is dry-run.")
    parser.add_argument("--write", action="store_true", help="Alias for --apply.")
    parser.add_argument("--dry-run", action="store_true", help="Force dry-run even if --apply was passed.")
    parser.add_argument("--top-is-oldest", action="store_true", help="Use top line as 0001_ instead of the default bottom line.")
    args = parser.parse_args()
    write = bool((args.apply or args.write) and not args.dry_run)
    report = run(args.category, args.order_list, write=write, bottom_is_oldest=not args.top_is_oldest)
    print(json.dumps({
        "status": "complete" if write else "dry-run",
        "category": report["category"],
        "desiredCount": report["desiredCount"],
        "matchedCount": report["matchedCount"],
        "missingCount": report["missingCount"],
        "unmatchedExistingCount": report["unmatchedExistingCount"],
        "report": CATEGORY_CONFIG[args.category]["report"],
        "marker": CATEGORY_CONFIG[args.category]["marker"],
    }, ensure_ascii=False, indent=2))
    if report["missingCount"]:
        print("WARNING: Some order-list entries were not matched. Review the report before applying." if not write else "WARNING: Applied with missing entries. Review the report.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
