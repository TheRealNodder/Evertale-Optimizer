#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

DEFAULT_COMMIT = "43a779461b9493b6522ed09cd545a131559388b9"
DEFAULT_SOURCE = "data/weapons.json"
DEFAULT_OUTPUT = "apkfiles/entries/overlays/weapons_overlay.json"
DEFAULT_REPORT = "apkfiles/entries/reports/weapon_overlay_restore_report.json"


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for path in [cur, *cur.parents]:
        if (path / ".git").exists() and (path / "apkfiles").exists():
            return path
    raise SystemExit("ERROR: Could not find repo root with .git and apkfiles.")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Restore the known-good legacy weapon overlay from Git history.")
    parser.add_argument("--commit", default=DEFAULT_COMMIT, help="Commit that contains the known-good data/weapons.json.")
    parser.add_argument("--source", default=DEFAULT_SOURCE, help="Path inside the historical commit.")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Overlay output path.")
    args = parser.parse_args()

    repo = find_repo_root(Path.cwd())
    git_ref = f"{args.commit}:{args.source}"
    out_path = repo / args.output
    report_path = repo / DEFAULT_REPORT

    result = subprocess.run(["git", "show", git_ref], cwd=str(repo), text=True, capture_output=True)
    if result.returncode != 0 or not result.stdout.strip():
        report = {
            "schemaVersion": 1,
            "status": "failed",
            "generatedAt": int(time.time()),
            "gitRef": git_ref,
            "output": str(out_path),
            "stderr": result.stderr[-4000:],
            "hint": "Run git fetch --all, then retry. The source commit must exist in local Git history."
        }
        write_json(report_path, report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    try:
        payload = json.loads(result.stdout)
    except Exception as exc:
        report = {
            "schemaVersion": 1,
            "status": "failed",
            "generatedAt": int(time.time()),
            "gitRef": git_ref,
            "output": str(out_path),
            "error": f"Historical weapons JSON could not be parsed: {exc}",
        }
        write_json(report_path, report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    weapons = payload.get("weapons", []) if isinstance(payload, dict) else []
    overlay = {
        "schemaVersion": 1,
        "source": "git-history-overlay",
        "sourceCommit": args.commit,
        "sourcePath": args.source,
        "generatedAt": int(time.time()),
        "count": len(weapons),
        "weapons": weapons,
    }
    write_json(out_path, overlay)
    report = {
        "schemaVersion": 1,
        "status": "ok",
        "generatedAt": int(time.time()),
        "gitRef": git_ref,
        "output": str(out_path),
        "count": len(weapons),
        "nextStep": "Run python tools\\new_structure\\MASTER_CONTROL.py to rebuild bundles with the overlay."
    }
    write_json(report_path, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
