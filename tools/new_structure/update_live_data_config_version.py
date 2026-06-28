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
PAGE_RELS = (Path("index.html"), Path("roster.html"), Path("optimizer.html"))
BASE_VERSION_RE = re.compile(r"const\s+DATA_VERSION_BASE\s*=\s*(['\"])(.*?)\1;")
RUNTIME_REVISION_RE = re.compile(r"const\s+RUNTIME_CACHE_REVISION\s*=\s*(['\"])(.*?)\1;")
VERSION_RE = re.compile(r"const\s+DATA_VERSION\s*=\s*(['\"])(.*?)\1;")
PAGE_VERSION_RE = re.compile(r"(?P<prefix>live-data-config\.js\?v=)[^\"']+")


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
    new_base_version = catalog_version_token(repo)

    base_match = BASE_VERSION_RE.search(old_text)
    legacy_match = VERSION_RE.search(old_text)
    if not base_match and not legacy_match:
        print("ERROR: Could not find DATA_VERSION_BASE or literal DATA_VERSION in live-data-config.js")
        return 1

    runtime_match = RUNTIME_REVISION_RE.search(old_text)
    runtime_revision = runtime_match.group(2).strip() if runtime_match else ""
    new_version = f"{new_base_version}-{runtime_revision}" if runtime_revision else new_base_version
    old_base_version = (base_match or legacy_match).group(2)

    if base_match:
        new_text = BASE_VERSION_RE.sub(f"const DATA_VERSION_BASE = '{new_base_version}';", old_text, count=1)
    else:
        new_text = VERSION_RE.sub(f"const DATA_VERSION = '{new_base_version}';", old_text, count=1)

    page_updates = []
    for page_rel in PAGE_RELS:
        page_path = repo / page_rel
        if not page_path.exists():
            print(f"ERROR: Missing {page_rel}")
            return 1
        page_text = page_path.read_text(encoding="utf-8")
        if not PAGE_VERSION_RE.search(page_text):
            print(f"ERROR: {page_rel} has no versioned live-data-config.js script reference")
            return 1
        next_page_text = PAGE_VERSION_RE.sub(lambda m: f"{m.group('prefix')}{new_version}", page_text)
        page_updates.append((page_rel, page_path, page_text, next_page_text))

    changed_files = []
    if new_text != old_text:
        config_path.write_text(new_text, encoding="utf-8", newline="\n")
        changed_files.append(str(CONFIG_REL))
    for page_rel, page_path, page_text, next_page_text in page_updates:
        if next_page_text != page_text:
            page_path.write_text(next_page_text, encoding="utf-8", newline="\n")
            changed_files.append(str(page_rel))
    status = "updated" if changed_files else "unchanged"

    report = {
        "schemaVersion": 2,
        "generatedAt": int(time.time()),
        "status": status,
        "config": str(CONFIG_REL),
        "catalog": str(CATALOG_REL),
        "oldBaseVersion": old_base_version,
        "newBaseVersion": new_base_version,
        "runtimeRevision": runtime_revision,
        "newVersion": new_version,
        "pageReferences": [str(path) for path in PAGE_RELS],
        "changedFiles": changed_files,
        "reason": "Keep generated data and runtime cache revisions together, and update every page URL so GitHub Pages/browser caches request the new config.",
    }
    write_json(repo / REPORT_REL, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    repo = find_repo_root(Path(__file__).resolve())
    return update_config(repo)


if __name__ == "__main__":
    raise SystemExit(main())
