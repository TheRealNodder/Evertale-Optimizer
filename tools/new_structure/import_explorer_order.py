#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import re
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT_MARKERS = ["apkfiles", "tools"]
DEFAULT_URLS = [
    "https://evertaletoolbox2.runasp.net/Explorer",
    "https://evertaletoolbox.runasp.net/Explorer",
]
REPORT_REL = "apkfiles/entries/reports/explorer_order_import_report.json"

CATEGORY_FILES = {
    "characters": "apkfiles/entries/maps/explorer_character_order.json",
    "weapons": "apkfiles/entries/maps/explorer_weapon_order.json",
    "accessories": "apkfiles/entries/maps/explorer_accessory_order.json",
    "bosses": "apkfiles/entries/maps/explorer_boss_order.json",
}


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root. Run this inside Evertale-Optimizer.")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "EvertaleOptimizerOrderImporter/1.0"})
    with urllib.request.urlopen(req, timeout=45) as res:
        raw = res.read()
    return raw.decode("utf-8", errors="replace")


def visible_lines(markup: str) -> List[str]:
    text = re.sub(r"<script\b.*?</script>", "\n", markup, flags=re.I | re.S)
    text = re.sub(r"<style\b.*?</style>", "\n", text, flags=re.I | re.S)
    text = re.sub(r"<(?:li|br|p|div|tr|td|th|h[1-6]|option)\b[^>]*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    out = []
    for line in text.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if line:
            out.append(line)
    return out


def clean_entry_line(line: str) -> str:
    line = re.sub(r"^\*\s*", "", line).strip()
    line = re.sub(r"^(?:Image\s*)+", "", line).strip()
    line = re.sub(r"^\d+\s+", "", line).strip()
    return line


def parse_entry(line: str) -> Tuple[str, str] | None:
    line = clean_entry_line(line)
    match = re.match(r"^([A-Za-z0-9_]+)\s*\((.*?)\)\s*$", line)
    if not match:
        return None
    key = match.group(1).strip()
    display = match.group(2).strip()
    if not key:
        return None
    return key, display


def classify_entry(key: str, active_section: str) -> str | None:
    key_l = key.lower()
    if "boss" in key_l:
        return "bosses"
    if active_section == "weapon":
        return "weapons"
    if active_section == "accessory":
        return "accessories"
    if active_section == "boss":
        return "bosses"
    if active_section == "character":
        return "characters"
    return None


def extract_orders_from_lines(lines: List[str], source_url: str) -> Dict[str, List[Dict[str, Any]]]:
    buckets: Dict[str, List[Dict[str, Any]]] = {k: [] for k in CATEGORY_FILES}
    seen = {k: set() for k in CATEGORY_FILES}
    active = ""

    for idx, raw in enumerate(lines, start=1):
        low = raw.strip().lower()
        if low in {"character", "characters"}:
            active = "character"
            continue
        if low in {"weapon", "weapons", "weapon:"}:
            active = "weapon"
            continue
        if low in {"accessory", "accessories", "accessory:"}:
            active = "accessory"
            continue
        if low in {"boss", "bosses", "boss:"}:
            active = "boss"
            continue
        if low in {"rarity:", "elements:", "all", "home", "english", "en"}:
            continue

        parsed = parse_entry(raw)
        if not parsed:
            continue
        key, display = parsed
        category = classify_entry(key, active)
        if not category:
            continue
        nkey = norm(key)
        if nkey in seen[category]:
            continue
        seen[category].add(nkey)
        buckets[category].append({
            "order": len(buckets[category]) + 1,
            "key": key,
            "displayName": display,
            "sourceUrl": source_url,
            "sourceLine": idx,
        })
    return buckets


def merge_orders(source_orders: List[Dict[str, List[Dict[str, Any]]]]) -> Dict[str, List[Dict[str, Any]]]:
    merged = {k: [] for k in CATEGORY_FILES}
    seen = {k: set() for k in CATEGORY_FILES}
    for buckets in source_orders:
        for category, rows in buckets.items():
            for row in rows:
                nkey = norm(row.get("key"))
                if not nkey or nkey in seen[category]:
                    continue
                seen[category].add(nkey)
                new_row = dict(row)
                new_row["order"] = len(merged[category]) + 1
                merged[category].append(new_row)
    return merged


def main() -> int:
    parser = argparse.ArgumentParser(description="Import numeric display order from Evertale Toolbox Explorer pages.")
    parser.add_argument("--url", action="append", dest="urls", help="Explorer URL. Can be provided multiple times.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    repo = find_repo_root(Path.cwd())
    urls = args.urls or DEFAULT_URLS
    per_source = []
    source_reports = []

    for url in urls:
        markup = fetch_text(url)
        lines = visible_lines(markup)
        buckets = extract_orders_from_lines(lines, url)
        per_source.append(buckets)
        source_reports.append({
            "url": url,
            "visibleLineCount": len(lines),
            "counts": {category: len(rows) for category, rows in buckets.items()},
            "firstEntries": {category: rows[:10] for category, rows in buckets.items()},
        })

    merged = merge_orders(per_source)
    generated_at = int(time.time())

    outputs = {}
    for category, rel in CATEGORY_FILES.items():
        payload = {
            "schemaVersion": 1,
            "source": "Evertale Toolbox Explorer visible order",
            "generatedAt": generated_at,
            "category": category,
            "count": len(merged[category]),
            "orderDirection": "1 = newest/top of Explorer list",
            "order": merged[category],
        }
        outputs[category] = {"path": rel, "count": len(merged[category]), "firstEntries": merged[category][:10]}
        if not args.dry_run:
            write_json(repo / rel, payload)

    report = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "dryRun": args.dry_run,
        "urls": urls,
        "sourceReports": source_reports,
        "outputs": outputs,
        "rules": [
            "Explorer order is numeric and category-specific.",
            "Order 1 means newest/top of the Explorer list.",
            "Existing project entries are not deleted or overwritten by this importer.",
            "This creates separate explorer_*_order.json files used as display-order authority."
        ],
    }
    if not args.dry_run:
        write_json(repo / REPORT_REL, report)

    print(json.dumps({"status": "ok", "dryRun": args.dry_run, "outputs": outputs, "report": REPORT_REL}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
