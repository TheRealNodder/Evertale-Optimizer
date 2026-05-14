#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT_MARKERS = ["apkfiles", "tools"]
DEFAULT_AUDIT_REPORT = "apkfiles/entries/reports/deep_dependency_audit.json"
DEFAULT_OUTPUT_REPORT = "apkfiles/entries/reports/quarantine_plan_only.json"

# These files are project control/handoff files. They may not be referenced by the live web app,
# but they are intentionally retained for repo safety, migration continuity, and future handoff.
PROTECTED_ALWAYS_KEEP = {
    ".gitignore",
    "README.md",
    "PROJECT_HANDOFF.md",
    "PATCH_RULES.md",
    "OPTIMIZER_DOCTRINE.json",
    "TAGGING_GUIDE.md",
}

PROTECTED_PREFIXES = (
    ".github/",
    "tools/",
    "apkfiles/entries/reports/",
)


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root. Run this inside the Evertale-Optimizer repo.")


def load_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise SystemExit(f"ERROR: Missing audit report: {path}\nRun deep_dependency_audit.py first.")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"ERROR: Invalid JSON in {path}: {exc}") from exc


def normalize_path(value: Any) -> str:
    return str(value or "").strip().replace("\\", "/")


def is_protected(source: str) -> bool:
    if source in PROTECTED_ALWAYS_KEEP:
        return True
    return source.startswith(PROTECTED_PREFIXES)


def only_red_quarantine_candidates(report: Dict[str, Any]) -> List[Dict[str, Any]]:
    candidates = report.get("quarantineCandidates") or []
    return [
        row for row in candidates
        if row.get("migrationRole") == "RED_QUARANTINE_CANDIDATE"
    ]


def split_candidates(candidates: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    movable: List[Dict[str, Any]] = []
    protected: List[Dict[str, Any]] = []
    for row in candidates:
        source = normalize_path(row.get("path"))
        if not source or source.startswith("legacy_unused/"):
            continue
        if is_protected(source):
            protected.append({
                **row,
                "protectedReason": "Project control, handoff, tool, GitHub config, or audit report file. Keep at original path.",
            })
        else:
            movable.append(row)
    return movable, protected


def build_plan(candidates: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    plan: List[Dict[str, str]] = []
    for row in candidates:
        source = normalize_path(row.get("path"))
        if not source or source.startswith("legacy_unused/"):
            continue
        plan.append({
            "from": source,
            "to": f"legacy_unused/{source}",
            "reason": row.get("riskReason") or "RED_QUARANTINE_CANDIDATE from deep dependency audit.",
        })
    return plan


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export a small quarantine-only report from deep_dependency_audit.json."
    )
    parser.add_argument(
        "--audit-report",
        default=DEFAULT_AUDIT_REPORT,
        help=f"Path to deep audit report. Default: {DEFAULT_AUDIT_REPORT}",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT_REPORT,
        help=f"Path to write small quarantine report. Default: {DEFAULT_OUTPUT_REPORT}",
    )
    args = parser.parse_args()

    repo = find_repo_root(Path.cwd())
    audit_path = repo / args.audit_report
    output_path = repo / args.output

    report = load_json(audit_path)
    red_candidates = only_red_quarantine_candidates(report)
    movable_candidates, protected_candidates = split_candidates(red_candidates)
    plan = build_plan(movable_candidates)

    small_report = {
        "schemaVersion": 2,
        "sourceReport": args.audit_report,
        "redCandidateCountBeforeProtection": len(red_candidates),
        "protectedCandidateCount": len(protected_candidates),
        "quarantineCandidateCount": len(movable_candidates),
        "quarantinePlanCount": len(plan),
        "importantRules": [
            "Only RED_QUARANTINE_CANDIDATE files are eligible.",
            "Project handoff/control/tool/report files are protected even if the audit marks them RED.",
            "Move files to legacy_unused/<original path>; do not delete directly.",
            "Do not move GREEN, YELLOW, or ORANGE files from the audit report.",
            "After moving files, test the site and re-run deep_dependency_audit.py."
        ],
        "protectedCandidatesKeptInPlace": protected_candidates,
        "quarantinePlan": plan,
        "quarantineCandidates": movable_candidates,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(small_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": "ok",
        "sourceReport": str(audit_path),
        "output": str(output_path),
        "redCandidateCountBeforeProtection": len(red_candidates),
        "protectedCandidateCount": len(protected_candidates),
        "quarantineCandidateCount": len(movable_candidates),
        "quarantinePlanCount": len(plan),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
