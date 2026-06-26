#!/usr/bin/env python3
"""
MASTER CONTROL for the Evertale Optimizer extraction/injection pipeline.

Universal launch examples:
  python MASTER_CONTROL.py
  python MASTER_CONTROL.py --extract --force
  python tools/new_structure/MASTER_CONTROL.py
  python tools/new_structure/MASTER_CONTROL.py --extract --force

The script locates the repository root from its own location, then runs every child
process from the repo root using UTF-8-safe subprocess output handling.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

from path_utils import find_repo_root, resolve_repo_path

MASTER_SCHEMA_VERSION = 3
SAFE_INGEST_REL = "tools/new_structure/run_safe_new_data_ingest.py"
REPORT_REL = "apkfiles/entries/reports/master_control_report.json"


def subprocess_env() -> Dict[str, str]:
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env.setdefault("PYTHONUTF8", "1")
    return env


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
        "cwd": str(repo),
        "encoding": "utf-8/errors=replace",
    }
    print(f"\n[MASTER CONTROL] {label}")
    print("[MASTER CONTROL] Command:", " ".join(command))
    print("[MASTER CONTROL] CWD:", repo)

    if dry_run:
        result.update({"returnCode": 0, "durationSeconds": 0, "skipped": True})
        return result

    proc = subprocess.run(
        command,
        cwd=str(repo),
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        env=subprocess_env(),
    )
    ended = time.time()
    stdout = proc.stdout or ""
    stderr = proc.stderr or ""
    result.update({
        "returnCode": proc.returncode,
        "durationSeconds": round(ended - started, 3),
        "stdoutTail": stdout[-6000:],
        "stderrTail": stderr[-6000:],
    })
    if stdout:
        print(stdout)
    if stderr:
        print(stderr, file=sys.stderr)
    if proc.returncode != 0:
        raise RuntimeError(f"Step failed: {label} returned {proc.returncode}")
    return result


def build_safe_ingest_command(repo: Path, args: argparse.Namespace) -> List[str]:
    script = repo / SAFE_INGEST_REL
    command = [sys.executable, str(script)]
    if args.extract:
        command.append("--extract")
        command.extend(["--raw", str(resolve_repo_path(repo, args.input, "apkfiles"))])
    elif args.input:
        raise SystemExit("ERROR: --input requires --extract. Use --extract for fresh apkfiles ingest.")
    if args.force:
        command.append("--force")
    if args.full_audit:
        command.append("--full-audit")
    if args.no_resume:
        command.append("--no-resume")
    if args.dry_run:
        command.append("--dry-run")
    return command


def main() -> int:
    parser = argparse.ArgumentParser(
        description="MASTER CONTROL: run safe rebuild or extract fresh Evertale game JSON from apkfiles."
    )
    parser.add_argument("--extract", action="store_true", help="Extract fresh Monster/Weapon/Equipment/Boss JSON from apkfiles before rebuilding.")
    parser.add_argument("--input", help="Optional input folder. Defaults to ./apkfiles when --extract is used.")
    parser.add_argument("--raw", dest="input", help=argparse.SUPPRESS)
    parser.add_argument("--force", action="store_true", help="Force extraction rebuild. Requires --extract.")
    parser.add_argument("--no-resume", action="store_true", help="Ignore partial extraction markers. Requires --extract.")
    parser.add_argument("--full-audit", action="store_true", help="Compatibility flag; audit-only scripts are no longer part of the operational pipeline.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned steps without running them.")
    args = parser.parse_args()

    if args.force and not args.extract:
        raise SystemExit("ERROR: --force requires --extract.")
    if args.no_resume and not args.extract:
        raise SystemExit("ERROR: --no-resume requires --extract.")

    repo = find_repo_root(Path(__file__).resolve())
    safe_ingest = repo / SAFE_INGEST_REL
    if not safe_ingest.exists():
        raise FileNotFoundError(f"Missing safe ingest runner: {safe_ingest}")

    mode = "extract-from-apkfiles" if args.extract else ("full-audit" if args.full_audit else "fast-safe-rebuild")
    input_folder = str(resolve_repo_path(repo, args.input, "apkfiles")) if args.extract else None
    report: Dict[str, Any] = {
        "schemaVersion": MASTER_SCHEMA_VERSION,
        "generatedAt": int(time.time()),
        "repoRoot": str(repo),
        "launchedFrom": str(Path.cwd()),
        "mode": mode,
        "inputFolder": input_folder,
        "dryRun": bool(args.dry_run),
        "resume": not args.no_resume,
        "subprocessEncoding": "utf-8/errors=replace",
        "steps": [],
        "notes": [
            "Master Control can be launched from repo root, tools/new_structure, or another working directory.",
            "Child processes always run from the repo root.",
            "Child process output is decoded as UTF-8 with replacement so Windows cp1252 consoles do not crash on game text.",
            "Default mode rebuilds existing apkfiles/entries outputs safely.",
            "Use --extract when fresh Monster.json, Weapon.json, Equipment.json, or Boss.json have been placed in apkfiles.",
            "Extraction input defaults to apkfiles, not raw.",
            "Use --force with --extract to rebuild all entries and ignore unchanged-entry skips.",
            "Use --no-resume with --extract to ignore partial markers while still keeping unchanged-entry hash skips.",
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
