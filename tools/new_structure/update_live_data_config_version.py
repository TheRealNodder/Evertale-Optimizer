#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any

from path_utils import find_repo_root

CONFIG_REL = Path("live-data-config.js")
CATALOG_REL = Path("apkfiles/entries/bundles/catalog.bundle.json")
REPORT_REL = Path("apkfiles/entries/reports/live_data_config_version_report.json")
VERSION_RE = re.compile(r"const\s+DATA_VERSION\s*=\s*(['\"])(.*?)\1;")


def read_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def content_hash(path: Path) -> str:
    if not path.exists():
        return "missing"
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def catalog_version_token(repo: Path) -> str:
    catalog_path = repo / CATALOG_REL
    catalog = read_json(catalog_path, {}) or {}
    generated_at = catalog.get("generatedAt") if isinstance(catalog, dict) else None
    catalog_hash = catalog.get("contentHash") if isinstance(catalog, dict) else None
    short_hash = str(catalog_hash or content_hash(catalog_path))[:12]
    stamp = str(generated_at or int(time.time()))
    return f"entries-{stamp}-{short_hash}"


def update_config(repo: Path) -> int:
    config_path = repo / CONFIG_REL
    if not config_path.exists():
        print(f"ERROR: Missing {CONFIG_REL}")
        return 1

    old_text = config_path.read_text(encoding="utf-8")
    new_version = catalog_version_token(repo)

    match = VERSION_RE.search(old_text)
    if not match:
        print("ERROR: Could not find const DATA_VERSION in live-data-config.js")
        return 1

    old_version = match.group(2)
    new_text = VERSION_RE.sub(f"const DATA_VERSION = '{new_version}';", old_text, count=1)

    if new_text != old_text:
        config_path.write_text(new_text, encoding="utf-8", newline="\n")
        status = "updated"
    else:
        status = "unchanged"

    report = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "status": status,
        "config": str(CONFIG_REL),
        "catalog": str(CATALOG_REL),
        "oldVersion": old_version,
        "newVersion": new_version,
        "reason": "Bump live data cache token so Catalog, Roster, and Optimizer load regenerated bundles instead of stale GitHub Pages/browser cached JSON.",
    }
    write_json(repo / REPORT_REL, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    repo = find_repo_root(Path(__file__).resolve())
    return update_config(repo)


if __name__ == "__main__":
    raise SystemExit(main())
