#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import time
from pathlib import Path

ROOT_MARKERS = ["apkfiles", "tools"]
CANONICAL_REL = "apkfiles/entries/maps/character_order_canonical.txt"
REPORT_REL = "apkfiles/entries/reports/character_order_tail_repair_report.json"

DISPLAY_ORDER = [
    ("BeautyBeastRegular", "Beauty & Beast"),
    ("BeautyRegular", "Belle"),
    ("BeastRegular", "Aigis"),
]
CANONICAL_TAIL = list(reversed(DISPLAY_ORDER))
FOLLOW_PAIRS = [("SuperLifeMinion", "SnowWhiteNew")]


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root")


def parse_line(line: str):
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    m = re.match(r"^([A-Za-z0-9_]+)\s*(?:\((.*?)\))?\s*$", line)
    if not m:
        return None
    return m.group(1).strip(), (m.group(2) or "").strip()


def format_line(row):
    key, display = row
    return f"{key} ({display})" if display else f"{key} ()"


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    repo = find_repo_root(Path.cwd())
    canonical_path = repo / CANONICAL_REL
    rows = []
    seen = set()
    removed = []
    controlled = {k for k, _ in CANONICAL_TAIL}

    for line in canonical_path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        parsed = parse_line(line)
        if not parsed:
            continue
        key, display = parsed
        if key in controlled:
            removed.append(key)
            continue
        if key in seen:
            removed.append(key)
            continue
        seen.add(key)
        rows.append((key, display))

    row_map = {k: (k, d) for k, d in rows}
    for follower, source in FOLLOW_PAIRS:
        if follower in row_map and source in row_map:
            rows = [r for r in rows if r[0] not in {follower, source}]
            rows.append(row_map[follower])
            rows.append(row_map[source])

    seen = set()
    clean = []
    for row in rows:
        if row[0] in seen:
            removed.append(row[0])
            continue
        seen.add(row[0])
        clean.append(row)
    rows = clean

    for row in CANONICAL_TAIL:
        if row[0] not in seen:
            rows.append(row)
            seen.add(row[0])

    canonical_path.write_text("\n".join(format_line(r) for r in rows) + "\n", encoding="utf-8", newline="\n")
    write_json(repo / REPORT_REL, {
        "generatedAt": int(time.time()),
        "count": len(rows),
        "removedCount": len(removed),
        "removed": removed,
        "canonicalTail": [k for k, _ in CANONICAL_TAIL],
        "displayOrderExpected": [k for k, _ in DISPLAY_ORDER],
    })
    print(json.dumps({"status": "ok", "count": len(rows), "displayOrderExpected": [k for k, _ in DISPLAY_ORDER]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
