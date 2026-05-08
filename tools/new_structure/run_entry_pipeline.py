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
PIPELINE_VERSION = 1

DEFAULT_STEPS = [
    "bookmark_before",
    "extract_entries",
    "extract_localization",
    "sync_weapon_order",
    "organize_entries",
    "build_character_image_map",
    "build_bundles",
    "validate",
    "bookmark_after",
]

SCRIPT_MAP = {
    "bookmark_before": "update_entry_bookmark.py",
    "bookmark_after": "update_entry_bookmark.py",
    "extract_entries": "run_universal_apk_builder.py",
    "extract_localization": "extract_localizable_groups.py",
    "sync_weapon_order": "sync_weapon_order_canonical.py",
    "organize_entries": "organize_entries_from_toolbox.py",
    "build_character_image_map": "build_character_image_map.py",
    "build_bundles": "build_entry_bundles.py",
    "validate": "validate_entries.py",
}


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for folder in [current] + list(current.parents):
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate Evertale-Optimizer repo root. Run from anywhere inside the repo.")


def load_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return fallback
    except Exception:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")


def run_step(repo_root: Path, tools_dir: Path, step: str, args: argparse.Namespace) -> Dict[str, Any]:
    script_name = SCRIPT_MAP[step]
    script_path = tools_dir / script_name
    started = int(time.time())

    if not script_path.exists():
        return {
            "step": step,
            "script": str(script_path),
            "status": "missing_script",
            "returnCode": None,
            "startedAt": started,
            "finishedAt": int(time.time()),
        }

    command = [sys.executable, str(script_path)]

    if step == "extract_entries":
        if args.raw:
            command.extend(["--base", str(Path(args.raw).resolve())])
        if args.force:
            command.append("--force")
        if args.category:
            command.extend(["--category", args.category])
        if args.limit is not None:
            command.extend(["--limit", str(args.limit)])
        if args.start_after:
            command.extend(["--start-after", args.start_after])
    elif step in {"bookmark_before", "bookmark_after", "build_character_image_map", "build_bundles", "validate"}:
        # These scripts auto-detect the repo/entries root. Keep args minimal for cross-PC compatibility.
        pass
    elif step == "organize_entries":
        if args.dry_run:
            command.append("--dry-run")
    elif step == "sync_weapon_order":
        pass
    elif step == "extract_localization":
        if args.raw:
            command.extend(["--input", str(Path(args.raw).resolve())])

    print("\n" + "=" * 72)
    print(f"STEP: {step}")
    print("COMMAND:", " ".join(f'\"{x}\"' if ' ' in x else x for x in command))
    print("=" * 72)

    if args.plan:
        return {
            "step": step,
            "script": str(script_path),
            "status": "planned",
            "command": command,
            "returnCode": None,
            "startedAt": started,
            "finishedAt": int(time.time()),
        }

    result = subprocess.run(command, cwd=str(repo_root))
    finished = int(time.time())
    status = "ok" if result.returncode == 0 else "failed"
    return {
        "step": step,
        "script": str(script_path),
        "status": status,
        "command": command,
        "returnCode": result.returncode,
        "startedAt": started,
        "finishedAt": finished,
        "durationSeconds": finished - started,
    }


def parse_steps(value: Optional[str]) -> List[str]:
    if not value:
        return list(DEFAULT_STEPS)
    selected = [x.strip() for x in value.split(",") if x.strip()]
    unknown = [x for x in selected if x not in SCRIPT_MAP]
    if unknown:
        raise SystemExit(f"ERROR: Unknown step(s): {', '.join(unknown)}\nKnown steps: {', '.join(SCRIPT_MAP)}")
    return selected


def main() -> int:
    parser = argparse.ArgumentParser(description="Universal Evertale entry pipeline with bookmark support.")
    parser.add_argument("--raw", default=None, help="Optional folder containing raw APK JSON files. Auto-detected by the builder when omitted.")
    parser.add_argument("--steps", default=None, help="Comma-separated step list. Default runs full pipeline.")
    parser.add_argument("--skip", default=None, help="Comma-separated steps to skip.")
    parser.add_argument("--category", choices=["characters", "weapons", "accessories", "bosses"], default=None)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--start-after", default=None)
    parser.add_argument("--force", action="store_true", help="Force rebuild entry extraction step.")
    parser.add_argument("--dry-run", action="store_true", help="Pass dry-run to organizer where supported.")
    parser.add_argument("--plan", action="store_true", help="Print planned commands without running them.")
    parser.add_argument("--continue-on-error", action="store_true", help="Continue remaining steps after a failed step.")
    args = parser.parse_args()

    repo_root = find_repo_root(Path.cwd())
    tools_dir = repo_root / "tools" / "new_structure"
    entries_root = repo_root / "apkfiles" / "entries"
    reports_dir = entries_root / "reports"

    steps = parse_steps(args.steps)
    skip = {x.strip() for x in (args.skip or "").split(",") if x.strip()}
    steps = [s for s in steps if s not in skip]

    print("Evertale Universal Entry Pipeline")
    print("Repo Root:", repo_root)
    print("Entries  :", entries_root)
    print("Steps    :", ", ".join(steps))

    report: Dict[str, Any] = {
        "pipelineVersion": PIPELINE_VERSION,
        "startedAt": int(time.time()),
        "repoRoot": str(repo_root),
        "entriesRoot": str(entries_root),
        "stepsRequested": steps,
        "steps": [],
    }

    final_code = 0
    for step in steps:
        result = run_step(repo_root, tools_dir, step, args)
        report["steps"].append(result)
        write_json(reports_dir / "entry_pipeline_report.json", report)
        if result["status"] == "failed":
            final_code = result.get("returnCode") or 1
            if not args.continue_on_error:
                break
        elif result["status"] == "missing_script":
            final_code = 1
            if not args.continue_on_error:
                break

    report["finishedAt"] = int(time.time())
    report["status"] = "ok" if final_code == 0 else "failed"
    write_json(reports_dir / "entry_pipeline_report.json", report)

    print("\n" + "=" * 72)
    print("Pipeline complete:", report["status"])
    print("Report:", reports_dir / "entry_pipeline_report.json")
    print("=" * 72)
    return final_code


if __name__ == "__main__":
    raise SystemExit(main())
