#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path
from typing import Any

ROOT_MARKERS = ("apkfiles", "tools")
PLAN_REL = "apkfiles/entries/reports/python_tool_legacy_move_plan.json"
REPORT_REL = "apkfiles/entries/reports/python_tool_legacy_move_apply_report.json"


def find_repo_root(start: Path | None = None) -> Path:
    cur = (start or Path.cwd()).resolve()
    for p in [cur, *cur.parents]:
        if all((p / marker).exists() for marker in ROOT_MARKERS):
            return p
    raise SystemExit("Could not locate repo root")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def move_file(src: Path, dst: Path, dry_run: bool) -> dict[str, Any]:
    row = {"from": str(src), "to": str(dst), "status": "planned" if dry_run else "moved"}
    if not src.exists():
        row["status"] = "missing"
        return row
    if dst.exists():
        row["status"] = "blocked_destination_exists"
        return row
    if not dry_run:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
    return row


def main() -> int:
    ap = argparse.ArgumentParser(description="Apply reviewed Python legacy move plan.")
    ap.add_argument("--apply", action="store_true", help="Actually move files. Default is dry run.")
    ap.add_argument("--include-review", action="store_true", help="Also move UNREFERENCED_REVIEW files. Default only moves explicit LEGACY_CANDIDATE rows.")
    args = ap.parse_args()
    repo = find_repo_root()
    plan = read_json(repo / PLAN_REL)
    dry_run = not args.apply
    moved = []
    skipped = []
    for row in plan.get("moves", []):
        status = row.get("status")
        if status != "LEGACY_CANDIDATE" and not args.include_review:
            skipped.append({"path": row.get("path"), "status": status, "reason": "not explicit legacy candidate; rerun with --include-review after checking"})
            continue
        src = repo / row["path"]
        dst = repo / row["legacyDestination"]
        moved.append(move_file(src, dst, dry_run))
    report = {"schemaVersion": 1, "generatedAt": int(time.time()), "dryRun": dry_run, "moved": moved, "skipped": skipped}
    write_json(repo / REPORT_REL, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
