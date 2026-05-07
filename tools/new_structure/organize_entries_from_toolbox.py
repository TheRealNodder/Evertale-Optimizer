#!/usr/bin/env python3
"""
Organize entry indexes using the order shown by Evertale Toolbox Explorer.

Universal behavior:
- Can run from repo root, tools/new_structure, apkfiles, or any repo subfolder.
- Auto-detects repo root and apkfiles/entries.
- Pulls order from https://evertaletoolbox.runasp.net/Explorer by default.
- Can use a saved Explorer text/html file with --source-file if the site is down.
- Writes stable order maps into apkfiles/entries/maps/.
- Rewrites category index.json order by default without moving entry files.

Run from anywhere inside the repo:
  python tools/new_structure/organize_entries_from_toolbox.py

Dry run:
  python tools/new_structure/organize_entries_from_toolbox.py --dry-run

Offline source:
  python tools/new_structure/organize_entries_from_toolbox.py --source-file Explorer.html

Outputs:
  apkfiles/entries/maps/character_order_map.json
  apkfiles/entries/maps/weapon_order_map.json
  apkfiles/entries/maps/boss_order_map.json
  apkfiles/entries/reports/toolbox_order_report.json
"""
from __future__ import annotations

import argparse
import html
import json
import re
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

EXPLORER_URL = "https://evertaletoolbox.runasp.net/Explorer"
CATEGORIES = ["characters", "weapons", "bosses"]
CATEGORY_TO_MAP = {
    "characters": "character_order_map.json",
    "weapons": "weapon_order_map.json",
    "bosses": "boss_order_map.json",
}


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def find_repo_root(start: Optional[Path] = None) -> Path:
    cur = (start or Path.cwd()).resolve()
    for path in [cur, *cur.parents]:
        if (path / ".git").exists() or (path / "apkfiles").exists():
            return path
    return cur


def resolve_path(path_text: Optional[str], repo_root: Path, default_rel: str) -> Path:
    raw = Path(path_text) if path_text else Path(default_rel)
    if raw.is_absolute():
        return raw.resolve()
    cwd_candidate = (Path.cwd() / raw).resolve()
    if cwd_candidate.exists():
        return cwd_candidate
    return (repo_root / raw).resolve()


def find_entries(repo_root: Path, explicit: Optional[str]) -> Path:
    if explicit:
        return resolve_path(explicit, repo_root, explicit)
    candidates = [repo_root / "apkfiles" / "entries", Path.cwd() / "apkfiles" / "entries", Path.cwd() / "entries"]
    for path in candidates:
        if path.exists() and path.is_dir():
            return path.resolve()
    return (repo_root / "apkfiles" / "entries").resolve()


def fetch_explorer(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 EvertaleOptimizerOrderBot/1.0"})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read().decode("utf-8", errors="replace")


def visible_text(raw: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", "\n", raw, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = html.unescape(text)
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", "\n", text)
    return text


def parse_explorer_rows(raw: str) -> List[Tuple[str, str]]:
    text = visible_text(raw)
    rows: List[Tuple[str, str]] = []
    seen = set()
    pattern = re.compile(r"^\s*([A-Za-z][A-Za-z0-9_]*?)(?:01|02|03|04|05)?\s*\(([^\n()]+)\)\s*$")
    for line in text.splitlines():
        line = line.strip()
        if not line or line in {"English", "日本語", "Character", "Boss", "Weapon", "Accessory"}:
            continue
        match = pattern.match(line)
        if not match:
            continue
        key = match.group(1).strip()
        display = match.group(2).strip()
        pair = (key, display)
        if pair in seen:
            continue
        seen.add(pair)
        rows.append(pair)
    return rows


def load_index(entries_root: Path, category: str) -> Dict[str, Any]:
    path = entries_root / category / "index.json"
    if not path.exists():
        return {"entries": []}
    return json.loads(read_text(path))


def norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def strip_form_suffix(value: str) -> str:
    return re.sub(r"\d+$", "", value or "")


def category_match_key(category: str, row: Dict[str, Any]) -> List[str]:
    source = str(row.get("sourceId") or "")
    family = strip_form_suffix(source)
    name = str(row.get("name") or "")
    keys = [source, family, name]
    if category == "bosses":
        keys += [source.replace("Boss", ""), family.replace("Boss", "")]
    return [norm(k) for k in keys if norm(k)]


def build_existing_key_map(index: Dict[str, Any], category: str) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for row in index.get("entries", []) or []:
        for key in category_match_key(category, row):
            out.setdefault(key, row)
    return out


def classify_toolbox_rows(toolbox_rows: List[Tuple[str, str]], indexes: Dict[str, Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    existing = {cat: build_existing_key_map(indexes[cat], cat) for cat in CATEGORIES}
    output = {cat: [] for cat in CATEGORIES}
    used = {cat: set() for cat in CATEGORIES}

    for source_key, display in toolbox_rows:
        candidates = [norm(source_key), norm(strip_form_suffix(source_key)), norm(display)]
        for category in CATEGORIES:
            matched_row = None
            matched_key = None
            for candidate in candidates:
                if candidate in existing[category]:
                    matched_row = existing[category][candidate]
                    matched_key = candidate
                    break
            if not matched_row:
                continue
            source_id = str(matched_row.get("sourceId") or source_key)
            if source_id in used[category]:
                continue
            used[category].add(source_id)
            output[category].append({
                "key": strip_form_suffix(source_id) if category == "characters" else source_id,
                "sourceId": source_id,
                "displayName": display,
                "matchedBy": matched_key,
                "file": matched_row.get("file"),
            })
            break
    return output


def append_unmatched(category: str, index: Dict[str, Any], ordered: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = {str(row.get("sourceId") or row.get("key") or "") for row in ordered}
    for row in index.get("entries", []) or []:
        source_id = str(row.get("sourceId") or "")
        if not source_id or source_id in seen:
            continue
        ordered.append({
            "key": strip_form_suffix(source_id) if category == "characters" else source_id,
            "sourceId": source_id,
            "displayName": row.get("name") or source_id,
            "matchedBy": "unmatched-original-index-tail",
            "file": row.get("file"),
        })
        seen.add(source_id)
    return ordered


def rewrite_index(entries_root: Path, category: str, index: Dict[str, Any], ordered: List[Dict[str, Any]], dry_run: bool) -> Dict[str, Any]:
    by_source = {str(row.get("sourceId") or ""): dict(row) for row in index.get("entries", []) or []}
    rewritten = []
    for i, order_row in enumerate(ordered, start=1):
        source_id = str(order_row.get("sourceId") or "")
        original = by_source.get(source_id)
        if not original:
            continue
        item = dict(original)
        item["order"] = i
        if order_row.get("displayName"):
            item["name"] = order_row["displayName"]
        rewritten.append(item)
    new_index = dict(index)
    new_index["entries"] = rewritten
    new_index["count"] = len(rewritten)
    new_index["orderSource"] = "evertaletoolbox.runasp.net/Explorer"
    new_index["orderGeneratedAt"] = int(time.time())
    if not dry_run:
        write_json(entries_root / category / "index.json", new_index)
    return new_index


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--entries", default=None, help="Path to apkfiles/entries. Auto-detected when omitted.")
    parser.add_argument("--source-url", default=EXPLORER_URL)
    parser.add_argument("--source-file", default=None, help="Optional saved Explorer HTML/text file.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-rewrite-index", action="store_true", help="Only write maps/report; do not rewrite category index.json files.")
    args = parser.parse_args()

    repo_root = find_repo_root()
    entries_root = find_entries(repo_root, args.entries)
    raw = read_text(resolve_path(args.source_file, repo_root, args.source_file)) if args.source_file else fetch_explorer(args.source_url)
    toolbox_rows = parse_explorer_rows(raw)
    indexes = {cat: load_index(entries_root, cat) for cat in CATEGORIES}
    classified = classify_toolbox_rows(toolbox_rows, indexes)

    maps_dir = entries_root / "maps"
    report_categories: Dict[str, Any] = {}
    for category in CATEGORIES:
        ordered = append_unmatched(category, indexes[category], classified[category])
        map_rows = []
        seen_map_keys = set()
        for i, row in enumerate(ordered, start=1):
            key = row["key"]
            if key in seen_map_keys:
                continue
            seen_map_keys.add(key)
            map_rows.append({
                "order": i,
                "key": key,
                "sourceId": row.get("sourceId"),
                "displayName": row.get("displayName"),
                "file": row.get("file"),
                "matchedBy": row.get("matchedBy"),
            })
        if not args.dry_run:
            write_json(maps_dir / CATEGORY_TO_MAP[category], {
                "schemaVersion": 1,
                "source": args.source_url if not args.source_file else str(args.source_file),
                "generatedAt": int(time.time()),
                "category": category,
                "count": len(map_rows),
                "order": map_rows,
            })
        if not args.no_rewrite_index:
            rewrite_index(entries_root, category, indexes[category], ordered, args.dry_run)
        report_categories[category] = {
            "indexCount": len(indexes[category].get("entries", []) or []),
            "matchedFromToolbox": len(classified[category]),
            "finalOrderedCount": len(map_rows),
            "unmatchedTailCount": max(0, len(map_rows) - len(classified[category])),
            "mapFile": str(maps_dir / CATEGORY_TO_MAP[category]),
            "indexRewritten": not args.no_rewrite_index and not args.dry_run,
        }

    report = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "repoRoot": str(repo_root),
        "entriesRoot": str(entries_root),
        "source": args.source_url if not args.source_file else str(args.source_file),
        "toolboxRowsParsed": len(toolbox_rows),
        "dryRun": bool(args.dry_run),
        "categories": report_categories,
    }
    if not args.dry_run:
        write_json(entries_root / "reports" / "toolbox_order_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
