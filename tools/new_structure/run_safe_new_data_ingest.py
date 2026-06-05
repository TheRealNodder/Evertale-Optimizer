#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

ROOT_MARKERS = ["apkfiles", "tools"]
REPORT_REL = "apkfiles/entries/reports/safe_new_data_ingest_report.json"
PIPELINE_SCRIPT = "run_entry_pipeline.py"

FAST_POST_PIPELINE_STEPS = [
    "build_optimizer_runtime_model.py",
    "split_optimizer_runtime_model.py",
    "runtime_optimizer_trace.py",
]

FULL_AUDIT_STEPS = [
    "deep_dependency_audit.py --include-name-hits",
    "export_quarantine_plan.py",
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


def run_command(repo: Path, command: List[str], label: str, dry_run: bool = False) -> Dict[str, Any]:
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


def step_command(tools_dir: Path, raw_step: str) -> List[str]:
    parts = raw_step.split()
    return [sys.executable, str(tools_dir / parts[0]), *parts[1:]]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run safe append-only new-data ingest, runtime rebuild, and fast checks.")
    parser.add_argument("--raw", default=None, help="Input folder containing Monster.json, Weapon.json, Equipment.json, Boss.json. Defaults to ./apkfiles when --extract is used.")
    parser.add_argument("--extract", action="store_true", help="Run extraction from apkfiles/raw game JSON before rebuilding bundles.")
    parser.add_argument("--force", action="store_true", help="Pass --force into run_entry_pipeline.py extraction step.")
    parser.add_argument("--skip-post-checks", action="store_true", help="Only run the entry pipeline; skip runtime rebuild/checks.")
    parser.add_argument("--full-audit", action="store_true", help="Also run slow deep_dependency_audit.py and export_quarantine_plan.py.")
    parser.add_argument("--dry-run", action="store_true", help="Print intended commands without running them.")
    args = parser.parse_args()

    repo = find_repo_root(Path.cwd())
    tools_dir = repo / "tools" / "new_structure"
    report_path = repo / REPORT_REL

    input_folder = Path(args.raw).resolve() if args.raw else (repo / "apkfiles")
    should_extract = bool(args.extract or args.raw or args.force)

    steps: List[Dict[str, Any]] = []
    pipeline_cmd = [sys.executable, str(tools_dir / PIPELINE_SCRIPT)]
    if should_extract:
        pipeline_cmd.append("--extract")
        pipeline_cmd.extend(["--raw", str(input_folder)])
    if args.force:
        pipeline_cmd.append("--force")

    final_code = 0
    started = int(time.time())

    first = run_command(repo, pipeline_cmd, "safe_entry_pipeline", args.dry_run)
    steps.append(first)
    if first["returnCode"] != 0:
        final_code = first["returnCode"] or 1

    if final_code == 0 and not args.skip_post_checks:
        post_steps = list(FAST_POST_PIPELINE_STEPS)
        if args.full_audit:
            post_steps.extend(FULL_AUDIT_STEPS)
        for raw_step in post_steps:
            result = run_command(repo, step_command(tools_dir, raw_step), raw_step.split()[0], args.dry_run)
            steps.append(result)
            if result["returnCode"] != 0:
                final_code = result["returnCode"] or 1
                break

    report = {
        "schemaVersion": 3,
        "purpose": "Single safe runner for append-only new game data ingest and post-ingest checks.",
        "startedAt": started,
        "finishedAt": int(time.time()),
        "status": "ok" if final_code == 0 else "failed",
        "dryRun": args.dry_run,
        "mode": "extract" if should_extract else "safe_rebuild",
        "inputFolder": str(input_folder) if should_extract else None,
        "force": args.force,
        "fullAudit": args.full_audit,
        "rules": [
            "Existing canonical order is preserved.",
            "New entries are appended by sync_category_order_canonical.py.",
            "This wrapper does not delete, quarantine, or overwrite unrelated data.",
            "Runtime outputs are rebuilt after ingest so the site uses the new extracted data.",
            "Deep dependency audit is intentionally opt-in via --full-audit because it is slow.",
            "Fresh game JSON files are expected in apkfiles by default when extraction is requested."
        ],
        "steps": steps,
        "entryPipelineReport": read_json(repo / ENTRY_PIPELINE_REPORT, {}) if not args.dry_run else {},
        "orderSummary": summarize_order_reports(repo) if not args.dry_run else {},
        "runtimeSummary": summarize_runtime_manifest(repo) if not args.dry_run else {},
        "validationSummary": summarize_validation(repo) if not args.dry_run else {},
        "nextSteps": [
            "Review this report first.",
            "Run local server from repo root: python -m http.server 8000.",
            "Test index.html, roster.html, optimizer.html, and test-catalog-v2.html.",
            "Run with --full-audit only before quarantine/removal decisions.",
            "Only commit/push after local pages work."
        ],
    }

    if not args.dry_run:
        write_json(report_path, report)

    print("\nSAFE NEW DATA INGEST COMPLETE")
    print(json.dumps({
        "status": report["status"],
        "mode": report["mode"],
        "inputFolder": report["inputFolder"],
        "report": str(report_path),
        "fullAudit": args.full_audit,
        "runtimeSummary": report["runtimeSummary"],
    }, ensure_ascii=False, indent=2))
    return final_code


if __name__ == "__main__":
    raise SystemExit(main())
