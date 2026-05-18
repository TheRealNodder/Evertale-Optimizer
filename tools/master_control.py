#!/usr/bin/env python3
"""
master_control.py

Master verification/control layer for the Evertale Optimizer data pipeline.

Responsibilities:
- Runs duo mechanic scan.
- Verifies critical runtime files exist.
- Verifies roster/catalog/optimizer are wired to duo-source-collapse.
- Verifies parent/child IDs resolve to real character families.
- Produces machine-readable reports for future automation.

Usage:
  python tools/master_control.py
  python tools/master_control.py --write
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Set

from scan_duo_mechanics import scan, dump_json, strip_form_suffix

REQUIRED_FILES = [
    "apkfiles/Duo.json",
    "apkfiles/DuoDisplay.json",
    "duo-source-collapse.js",
    "data-loader.js",
    "index.html",
    "roster.html",
    "optimizer.html",
]


def load_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def collect_character_ids(root: Path) -> Set[str]:
    ids: Set[str] = set()
    entries_dir = root / "apkfiles" / "entries" / "characters" / "entries"
    for path in entries_dir.glob("*.json"):
        try:
            data = load_json(path)
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        internal = data.get("internal") if isinstance(data.get("internal"), dict) else {}
        for candidate in [
            internal.get("sourceId"),
            data.get("sourceId"),
            data.get("name"),
        ]:
            if isinstance(candidate, str) and candidate.strip():
                ids.add(candidate.strip())
                ids.add(strip_form_suffix(candidate.strip()))
    return ids


def verify_runtime_wiring(root: Path) -> Dict[str, bool]:
    checks: Dict[str, bool] = {}
    index_html = load_text(root / "index.html")
    roster_html = load_text(root / "roster.html")
    optimizer_html = load_text(root / "optimizer.html") if (root / "optimizer.html").exists() else ""

    checks["catalog_has_duo_source"] = "duo-source-collapse.js" in index_html
    checks["roster_has_duo_source"] = "duo-source-collapse.js" in roster_html
    checks["optimizer_has_duo_source"] = "duo-source-collapse.js" in optimizer_html
    return checks


def verify_duo_links(root: Path, scan_result: Dict[str, Any]) -> Dict[str, Any]:
    known_ids = collect_character_ids(root)
    broken: List[Dict[str, str]] = []

    for parent, children in scan_result.get("directSpecificLinks", {}).items():
        if parent not in known_ids and strip_form_suffix(parent) not in known_ids:
            broken.append({"type": "missing_parent", "id": parent})
        for child in children:
            if child not in known_ids and strip_form_suffix(child) not in known_ids:
                broken.append({"type": "missing_child", "parent": parent, "id": child})

    return {
        "knownCharacterIdCount": len(known_ids),
        "brokenLinkCount": len(broken),
        "brokenLinks": broken,
    }


def verify_required_files(root: Path) -> Dict[str, Any]:
    missing = []
    for rel in REQUIRED_FILES:
        if not (root / rel).exists():
            missing.append(rel)
    return {
        "requiredCount": len(REQUIRED_FILES),
        "missingCount": len(missing),
        "missing": missing,
    }


def run(root: Path) -> Dict[str, Any]:
    duo_scan = scan(root)
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "requiredFiles": verify_required_files(root),
        "runtimeWiring": verify_runtime_wiring(root),
        "duoLinks": verify_duo_links(root, duo_scan),
        "duoScan": duo_scan["scan"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run master verification for optimizer multi-entry mechanics.")
    parser.add_argument("--root", default=".", help="Repository root.")
    parser.add_argument("--write", action="store_true", help="Write report JSON files.")
    parser.add_argument("--output", default="apkfiles/entries/reports/master_control_report.json")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    report = run(root)

    if args.write:
        out = root / args.output
        dump_json(out, report)
        print(f"Wrote {out.relative_to(root)}")
    else:
        print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
