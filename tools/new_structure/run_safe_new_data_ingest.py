#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT_MARKERS = ["apkfiles", "tools"]
REPORT_REL = "apkfiles/entries/reports/safe_new_data_ingest_report.json"

# This wrapper is intentionally conservative:
# - it delegates extraction/order/tag/bundle validation to existing project tools
# - it keeps order append-only through sync_category_order_canonical.py
# - it rebuilds runtime outputs after raw entry changes
# - it does not delete or quarantine anything
# - it writes a single report for handoff/review

PIPELINE_SCRIPT = "run_entry_pipeline.py"
POST_PIPELINE_STEPS = [
    "build_optimizer_runtime_model.py",
    "split_optimizer_runtime_model.py",
    "deep_dependency_audit.py --include-name-hits",
    "export_quarantine_plan.py",
    "runtime_optimizer_trace.py",
]

ORDER_REPORTS = {
    "characters": "apkfiles/entries/reports/character_order_sync_report.json",
    "weapons": "apkfiles/entries/reports/weapon_order_sync_report.json",
    "accessories": "apkfiles/entries/reports/accessory_order_sync_report.json",
    "bosses": "apkfiles/entries/reports/boss_order_sync_report.json",
}

RUNTIME_MANIFEST = "apkfiles/entries/runtime/optimizer_runtime_manifest.json"
VALIDATION_REPORT = "apkfiles/entries/reports/validation_report.json"
ENTRY_PIPELINE_REPORT = "apkfiles/entries/reports/entry_pipeline_report.json"


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root. Run this inside Evertale-Optimizer.")


def read_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_command(repo: Path, tools_dir: Path, command: List[str], label: str, dry_run: bool = False) -> Dict[str, Any]:
    started = int(time.time())
    printable = " ".join(command)
    print("\n" + "=" * 78)
    print(f"STEP: {label}")
    print(f"COMMAND: {printable}")
    print("=" * 78)

    if dry_run:
        return {
            "label": label,
            "command": printable,
            "status": "dry_run_skipped",
            "returnCode": 0,
            "startedAt": started,
            "finishedAt": int(time.time()),
            "durationSeconds": 0,
        }

    result = subprocess.run(command, cwd=str(repo))
    finished = int(time.time())
    return {
        "label": label,
        "command": printable,
        "status": "ok" if result.returncode == 0 else "failed",
        "returnCode": result.returncode,
        "startedAt": started,
        "finishedAt": finished,
        "durationSeconds": finished - started,
    }


def summarize_order_reports(repo: Path) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for category, rel in ORDER_REPORTS.items():
        payload = read_json(repo / rel, {}) or {}
        out[category] = {
            "report": rel,
            "appendedNewEntries": int(payload.get("appendedNewEntries") or 0),
            "missingCanonicalEntries": int(payload.get("missingCanonicalEntries") or 0),
            "orderedCount": int(payload.get("orderedCount") or 0),
            "canonicalExistingCount": int(payload.get("canonicalExistingCount") or 0),
            "indexEntryCount": int(payload.get("indexEntryCount") or 0),
            "appended": payload.get("appended", [])[:50],
        }
    return out


def summarize_runtime_manifest(repo: Path) -> Dict[str, Any]:
    manifest = read_json(repo / RUNTIME_MANIFEST, {}) or {}
    chunks = manifest.get("chunks") or {}
    return {
        "manifest": RUNTIME_MANIFEST,
        "runtimeFlags": manifest.get("runtimeFlags") or {},
        "chunks": {key: {"file": row.get("file"), "count": row.get("count")} for key, row in chunks.items() if isinstance(row, dict)},
    }


def summarize_validation(repo: Path) -> Dict[str, Any]:
    payload = read_json(repo / VALIDATION_REPORT, {}) or {}
    return {
        "report": VALIDATION_REPORT,
        "status": payload.get("status"),
        "errors": payload.get("errors", [])[:100] if isinstance(payload.get("errors"), list) else payload.get("errors"),
        "warnings": payload.get("warnings", [])[:100] if isinstance(payload.get("warnings"), list) else payload.get("warnings"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run safe append-only new-data ingest, order sync, runtime rebuild, and checks.")
    parser.add_argument("--raw", default=None, help="Optional raw extracted/downloaded game data folder passed into run_entry_pipeline.py.")
    parser.add_argument("--force", action="store_true", help="Pass --force into run_entry_pipeline.py extraction step.")
    parser.add_argument("--skip-post-checks", action="store_true", help="Only run the entry pipeline; skip runtime rebuild/audits.")
    parser.add_argument("--dry-run", action="store_true", help="Print intended commands without running them.")
    args = parser.parse_args()

    repo = find_repo_root(Path.cwd())
    tools_dir = repo / "tools" / "new_structure"
    report_path = repo / REPORT_REL

    steps: List[Dict[str, Any]] = []

    pipeline_cmd = [sys.executable, str(tools_dir / PIPELINE_SCRIPT)]
    if args.raw:
        pipeline_cmd.extend(["--raw", str(Path(args.raw).resolve())])
    if args.force:
        pipeline_cmd.append("--force")

    final_code = 0
    started = int(time.time())

    first = run_command(repo, tools_dir, pipeline_cmd, "safe_entry_pipeline", args.dry_run)
    steps.append(first)
    if first["returnCode"] != 0:
        final_code = first["returnCode"] or 1

    if final_code == 0 and not args.skip_post_checks:
        for raw_step in POST_PIPELINE_STEPS:
            parts = raw_step.split()
            script = parts[0]
            extra = parts[1:]
            cmd = [sys.executable, str(tools_dir / script), *extra]
            result = run_command(repo, tools_dir, cmd, script, args.dry_run)
            steps.append(result)
            if result["returnCode"] != 0:
                final_code = result["returnCode"] or 1
                break

    order_summary = summarize_order_reports(repo) if not args.dry_run else {}
    runtime_summary = summarize_runtime_manifest(repo) if not args.dry_run else {}
    validation_summary = summarize_validation(repo) if not args.dry_run else {}
    pipeline_report = read_json(repo / ENTRY_PIPELINE_REPORT, {}) if not args.dry_run else {}

    report = {
        "schemaVersion": 1,
        "purpose": "Single safe runner for append-only new game data ingest and post-ingest checks.",
        "startedAt": started,
        "finishedAt": int(time.time()),
        "status": "ok" if final_code == 0 else "failed",
        "dryRun": args.dry_run,
        "raw": args.raw,
        "force": args.force,
        "rules": [
            "Existing canonical order is preserved.",
            "New entries are appended by sync_category_order_canonical.py.",
            "This wrapper does not delete, quarantine, or overwrite unrelated data.",
            "Runtime outputs are rebuilt after ingest so the site uses the new extracted data.",
            "Generated reports must be reviewed before committing new game data."
        ],
        "steps": steps,
        "entryPipelineReport": pipeline_report,
        "orderSummary": order_summary,
        "runtimeSummary": runtime_summary,
        "validationSummary": validation_summary,
        "nextSteps": [
            "Review this report first.",
            "Confirm appendedNewEntries counts match the new game data you intended to inject.",
            "Run local server from repo root: python -m http.server 8000.",
            "Test index.html, roster.html, and optimizer.html.",
            "Only commit/push after local pages work."
        ],
    }

    if not args.dry_run:
        write_json(report_path, report)

    print("\nSAFE NEW DATA INGEST COMPLETE")
    print(json.dumps({
        "status": report["status"],
        "report": str(report_path),
        "orderSummary": order_summary,
        "runtimeSummary": runtime_summary,
    }, ensure_ascii=False, indent=2))
    return final_code


if __name__ == "__main__":
    raise SystemExit(main())
