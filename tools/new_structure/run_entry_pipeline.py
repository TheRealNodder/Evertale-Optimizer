#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict

ROOT_MARKERS = ["apkfiles", "tools"]
PIPELINE_VERSION = 5

DEFAULT_STEPS = [
    "bookmark_before",
    "extract_entries",
    "extract_localization",
    "sync_category_order",
    "repair_character_order_tail",
    "sync_category_order",
    "build_character_image_map",
    "sync_character_tags",
    "build_bundles",
    "validate",
    "bookmark_after",
]

SCRIPT_MAP = {
    "bookmark_before": "update_entry_bookmark.py",
    "bookmark_after": "update_entry_bookmark.py",
    "extract_entries": "run_universal_apk_builder.py",
    "extract_localization": "extract_localizable_groups.py",
    "sync_category_order": "sync_category_order_canonical.py",
    "repair_character_order_tail": "repair_character_order_tail.py",
    "build_character_image_map": "build_character_image_map.py",
    "sync_character_tags": "sync_character_tags.py",
    "build_bundles": "build_entry_bundles.py",
    "validate": "validate_entries.py",
}


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for folder in [current] + list(current.parents):
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate Evertale-Optimizer repo root.")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def write_marker(repo_root: Path, status: str, step: str, processed_count: int, total_count: int, extra: Dict[str, Any] | None = None) -> None:
    path = repo_root / "apkfiles" / "entries" / "_markers" / "run_entry_pipeline_all.marker.json"
    payload = {
        "schemaVersion": 1,
        "tool": "run_entry_pipeline",
        "category": "all",
        "status": status,
        "lastKey": step,
        "lastSourceId": "",
        "lastHandle": None,
        "lastFile": "",
        "processedCount": processed_count,
        "totalCount": total_count,
        "updatedAt": int(time.time()),
        "extra": extra or {},
    }
    write_json(path, payload)


def run_step(repo_root: Path, tools_dir: Path, step: str, args: argparse.Namespace) -> Dict[str, Any]:
    script_path = tools_dir / SCRIPT_MAP[step]
    started = int(time.time())
    command = [sys.executable, str(script_path)]

    if step == "extract_entries":
        if args.raw:
            command.extend(["--base", str(Path(args.raw).resolve())])
        if args.force:
            command.append("--force")

    print("\n" + "=" * 72)
    print(f"STEP: {step}")
    print("COMMAND:", " ".join(command))
    print("=" * 72)

    result = subprocess.run(command, cwd=str(repo_root))
    finished = int(time.time())
    return {
        "step": step,
        "script": str(script_path),
        "status": "ok" if result.returncode == 0 else "failed",
        "returnCode": result.returncode,
        "startedAt": started,
        "finishedAt": finished,
        "durationSeconds": finished - started,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Universal Evertale entry pipeline.")
    parser.add_argument("--raw", default=None)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    repo_root = find_repo_root(Path.cwd())
    tools_dir = repo_root / "tools" / "new_structure"
    reports_dir = repo_root / "apkfiles" / "entries" / "reports"

    report: Dict[str, Any] = {
        "pipelineVersion": PIPELINE_VERSION,
        "startedAt": int(time.time()),
        "steps": [],
    }

    final_code = 0
    write_marker(repo_root, "started", "start", 0, len(DEFAULT_STEPS), {"raw": args.raw, "force": args.force})
    for idx, step in enumerate(DEFAULT_STEPS, start=1):
        write_marker(repo_root, "partial", step, idx - 1, len(DEFAULT_STEPS), {"currentStep": step})
        result = run_step(repo_root, tools_dir, step, args)
        report["steps"].append(result)
        write_marker(repo_root, result["status"], step, idx, len(DEFAULT_STEPS), {"returnCode": result["returnCode"]})
        if result["status"] == "failed":
            final_code = result["returnCode"] or 1
            break

    report["finishedAt"] = int(time.time())
    report["status"] = "ok" if final_code == 0 else "failed"
    write_json(reports_dir / "entry_pipeline_report.json", report)
    write_marker(repo_root, report["status"], report["steps"][-1]["step"] if report["steps"] else "none", len(report["steps"]), len(DEFAULT_STEPS), {"report": "apkfiles/entries/reports/entry_pipeline_report.json"})
    print("Pipeline complete:", report["status"])
    return final_code


if __name__ == "__main__":
    raise SystemExit(main())
