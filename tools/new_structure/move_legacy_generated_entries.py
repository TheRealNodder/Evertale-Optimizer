#!/usr/bin/env python3
"""
Move the obsolete apkfiles/generated_entries tree into legacy_unused.

Why:
- apkfiles/entries is now the canonical generated/runtime structure.
- apkfiles/generated_entries is the older generated-output location.
- Moving the old tree out of apkfiles keeps apkfiles focused on raw inputs + active entries output.

Run from repo root:
  python tools/new_structure/move_legacy_generated_entries.py

Dry run:
  python tools/new_structure/move_legacy_generated_entries.py --dry-run

After running, review with:
  git status
  git diff --stat

Then commit/push if the move looks correct.
"""
from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path
from typing import Any, Dict, Optional

SOURCE_REL = Path("apkfiles/generated_entries")
TARGET_REL = Path("legacy_unused/generated_entries_snapshot")
REPORT_REL = Path("apkfiles/entries/reports/generated_entries_cleanup_report.json")


def find_repo_root(start: Optional[Path] = None) -> Path:
    cur = (start or Path.cwd()).resolve()
    for path in [cur, *cur.parents]:
        if (path / ".git").exists() or (path / "apkfiles").exists():
            return path
    return cur


def count_files(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(1 for p in path.rglob("*") if p.is_file())


def dir_size_bytes(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(p.stat().st_size for p in path.rglob("*") if p.is_file())


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Report what would move without changing files.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing target snapshot if present.")
    args = parser.parse_args()

    repo = find_repo_root()
    source = repo / SOURCE_REL
    target = repo / TARGET_REL
    report_path = repo / REPORT_REL

    report: Dict[str, Any] = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "dryRun": bool(args.dry_run),
        "source": str(source),
        "target": str(target),
        "sourceExists": source.exists(),
        "targetExistsBefore": target.exists(),
        "sourceFileCount": count_files(source),
        "sourceSizeBytes": dir_size_bytes(source),
        "action": "move-generated_entries-to-legacy_unused",
    }

    if not source.exists():
        report["ok"] = True
        report["message"] = "Source does not exist; nothing to move."
        write_json(report_path, report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0

    if target.exists() and not args.overwrite:
        report["ok"] = False
        report["error"] = "Target already exists. Re-run with --overwrite if replacement is intended."
        write_json(report_path, report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    if not args.dry_run:
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and args.overwrite:
            shutil.rmtree(target)
        shutil.move(str(source), str(target))

    report.update({
        "ok": True,
        "targetExistsAfter": target.exists() if not args.dry_run else target.exists(),
        "targetFileCountAfter": count_files(target) if not args.dry_run else 0,
        "message": "Moved apkfiles/generated_entries to legacy_unused/generated_entries_snapshot." if not args.dry_run else "Dry run only; no files moved.",
    })
    write_json(report_path, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
