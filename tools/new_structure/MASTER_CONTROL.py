#!/usr/bin/env python3
"""
MASTER CONTROL for the Evertale Optimizer extraction/injection pipeline.

Purpose:
- Provide one obvious command for rebuilding the new apkfiles/entries runtime.
- Keep raw/input extraction, entry injection, runtime rebuild, and audit flow coordinated.
- Preserve the existing safe ingest behavior instead of duplicating pipeline logic.

Default fast path:
  python tools/new_structure/MASTER_CONTROL.py

Full audit path before quarantine/removal decisions:
  python tools/new_structure/MASTER_CONTROL.py --full-audit

Future raw input path:
  python tools/new_structure/MASTER_CONTROL.py --raw ./raw

Notes:
- apkfiles/entries remains the generated/output structure.
- raw/ is intended to become the untouched game-file input folder.
- This script delegates to run_safe_new_data_ingest.py as the canonical safe runner.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

MASTER_SCHEMA_VERSION = 1
SAFE_INGEST_REL = "tools/new_structure/run_safe_new_data_ingest.py"
REPORT_REL = "apkfiles/entries/reports/master_control_report.json"


def find_repo_root(start: Optional[Path] = None) -> Path:
    cur = (start or Path.cwd()).resolve()
    for path in [cur, *cur.parents]:
        if (path / ".git").exists() or (path / "apkfiles").exists():
            return path
    return cur


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def run_step(repo: Path, label: str, command: List[str], dry_run: bool = False) -> Dict[str, Any]:
    started = time.time()
    result: Dict[str, Any] = {
        "label": label,
        "command": command,
        "dryRun": dry_run,
        "startedAt": int(started),
    }
    print(f"\n[MASTER CONTROL] {label}")
    print("[MASTER CONTROL] Command:", " ".join(command))

    if dry_run:
        result.update({"returnCode": 0, "durationSeconds": 0, "skipped": True})
        return result

    proc = subprocess.run(command, cwd=str(repo), text=True, capture_output=True)
    ended = time.time()
    result.update({
        "returnCode": proc.returncode,
        "durationSeconds": round(ended - started, 3),
        "stdoutTail": proc.stdout[-6000:],
        "stderrTail": proc.stderr[-6000:],
    })
    if proc.stdout:
        print(proc.stdout)
    if proc.stderr:
        print(proc.stderr, file=sys.stderr)
    if proc.returncode != 0:
        raise RuntimeError(f"Step failed: {label} returned {proc.returncode}")
    return result


def build_safe_ingest_command(repo: Path, args: argparse.Namespace) -> List[str]:
    script = repo / SAFE_INGEST_REL
    command = [sys.executable, str(script)]
    if args.raw:
        command.extend(["--raw", str(Path(args.raw))])
    if args.full_audit:
        command.append("--full-audit")
    return command


def main() -> int:
    parser = argparse.ArgumentParser(
        description="MASTER CONTROL: run the Evertale Optimizer safe extraction/injection/runtime rebuild pipeline."
    )
    parser.add_argument("--raw", help="Optional raw game-file input folder. Future default target is ./raw.")
    parser.add_argument("--full-audit", action="store_true", help="Run full dependency/audit checks through safe ingest.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned steps without running them.")
    args = parser.parse_args()

    repo = find_repo_root()
    safe_ingest = repo / SAFE_INGEST_REL
    if not safe_ingest.exists():
        raise FileNotFoundError(f"Missing safe ingest runner: {safe_ingest}")

    report: Dict[str, Any] = {
        "schemaVersion": MASTER_SCHEMA_VERSION,
        "generatedAt": int(time.time()),
        "repoRoot": str(repo),
        "mode": "full-audit" if args.full_audit else "fast-safe-ingest",
        "rawInput": str(Path(args.raw)) if args.raw else None,
        "dryRun": bool(args.dry_run),
        "steps": [],
        "notes": [
            "MASTER_CONTROL.py is the preferred visible entry point for extraction/injection/runtime rebuilds.",
            "Delegates to run_safe_new_data_ingest.py to preserve existing safe pipeline behavior.",
            "Use --full-audit before quarantine/removal decisions.",
        ],
    }

    command = build_safe_ingest_command(repo, args)
    try:
        report["steps"].append(run_step(repo, "safe-new-data-ingest", command, dry_run=args.dry_run))
        report["ok"] = True
    except Exception as exc:
        report["ok"] = False
        report["error"] = str(exc)
        write_json(repo / REPORT_REL, report)
        print(f"[MASTER CONTROL] FAILED: {exc}", file=sys.stderr)
        return 1

    write_json(repo / REPORT_REL, report)
    print(f"\n[MASTER CONTROL] OK. Report written to {REPORT_REL}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
