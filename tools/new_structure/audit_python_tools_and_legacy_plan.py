#!/usr/bin/env python3
"""
Universal Python tool audit + legacy mover.

This single file replaces the older two-step process. It can be run from:
  - repo root
  - tools/
  - tools/new_structure/

Default behavior:
  1. Audit every Python file in the repo.
  2. Build dependency references from master-control entrypoints.
  3. Generate audit reports.
  4. Generate a legacy move plan.
  5. Run the move plan internally as a DRY RUN.

Apply behavior:
  python tools/new_structure/audit_python_tools_and_legacy_plan.py --apply

Reports:
  apkfiles/entries/reports/python_tool_audit_report.json
  apkfiles/entries/reports/python_tool_audit_report.md
  apkfiles/entries/reports/python_tool_legacy_move_plan.json
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import shutil
import time
from collections import deque
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

ROOT_MARKERS = ("apkfiles", "tools")
REPORT_JSON = Path("apkfiles/entries/reports/python_tool_audit_report.json")
REPORT_MD = Path("apkfiles/entries/reports/python_tool_audit_report.md")
LEGACY_PLAN = Path("apkfiles/entries/reports/python_tool_legacy_move_plan.json")
LEGACY_DIR = Path("tools/legacy")
MARKER_DIR = Path("apkfiles/entries/_markers")
TOOL_NAME = "audit_python_tools_and_legacy_plan"

DEFAULT_ENTRYPOINTS = {
    "tools/new_structure/MASTER_CONTROL.py",
    "tools/new_structure/run_safe_new_data_ingest.py",
    "tools/new_structure/run_entry_pipeline.py",
    "tools/new_structure/run_universal_apk_builder.py",
    "tools/new_structure/build_apk_entry_folders.py",
    "tools/new_structure/build_entry_bundles.py",
    "tools/new_structure/validate_entries.py",
    "tools/new_structure/master_control_refined.py",
    "tools/new_structure/organize_by_handle.py",
    "tools/new_structure/renumber_category_from_order_list.py",
    "tools/new_structure/sync_category_order_canonical.py",
    "tools/new_structure/sync_weapon_order_canonical.py",
}

NEVER_MOVE_NAMES = {
    "audit_python_tools_and_legacy_plan.py",
    "entry_checkpoint.py",
    "__init__.py",
}

NEVER_MOVE_PATHS = {
    "tools/new_structure/entry_checkpoint.py",
    "tools/new_structure/master_control_tools.json",
}

SAFE_LEGACY_CANDIDATE_NAMES = {
    # These were already identified as likely redundant. The audit still checks
    # references before allowing a move.
    "renumber_entry_files.py",
    "move_legacy_generated_entries.py",
}

IGNORE_DIR_PARTS = {
    ".git",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    "node_modules",
    ".venv",
    "venv",
    "env",
    "dist",
    "build",
}


def find_repo_root(start: Optional[Path] = None) -> Path:
    """Find repo root whether launched from root, tools/, or tools/new_structure/."""
    candidates: List[Path] = []
    if start:
        candidates.append(start.resolve())
    candidates.append(Path.cwd().resolve())
    candidates.append(Path(__file__).resolve().parent)
    for base in candidates:
        for path in [base, *base.parents]:
            if all((path / marker).exists() for marker in ROOT_MARKERS):
                return path
    raise SystemExit("ERROR: Could not locate repo root. Run inside the Evertale-Optimizer repo.")


def rel(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def write_marker(root: Path, status: str, *, processed: int, total: int, extra: Optional[Dict[str, Any]] = None) -> None:
    marker = root / MARKER_DIR / f"{TOOL_NAME}_all.marker.json"
    payload = {
        "schemaVersion": 1,
        "tool": TOOL_NAME,
        "category": "all",
        "status": status,
        "lastKey": "python_tool_audit",
        "lastSourceId": "",
        "lastHandle": None,
        "lastFile": "",
        "processedCount": processed,
        "totalCount": total,
        "updatedAt": int(time.time()),
        "extra": extra or {},
    }
    write_json(marker, payload)


def should_ignore(path: Path) -> bool:
    return any(part in IGNORE_DIR_PARTS for part in path.parts)


def collect_python_files(root: Path) -> List[Path]:
    files = []
    for path in root.rglob("*.py"):
        if should_ignore(path.relative_to(root)):
            continue
        if LEGACY_DIR.as_posix() in path.relative_to(root).as_posix():
            continue
        files.append(path)
    return sorted(files, key=lambda p: rel(p, root))


def module_name_for(path: Path, root: Path) -> str:
    rp = path.relative_to(root).with_suffix("")
    return ".".join(rp.parts)


def parse_imports(path: Path) -> Set[str]:
    imports: Set[str] = set()
    text = read_text(path)
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return imports
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.add(node.module)
    return imports


def referenced_py_files(path: Path, root: Path, all_by_name: Dict[str, List[Path]]) -> Set[Path]:
    """Find Python files referenced by string literals or obvious script calls."""
    text = read_text(path)
    found: Set[Path] = set()

    # Direct path references: "foo.py", "tools/new_structure/foo.py"
    for match in re.findall(r"([A-Za-z0-9_./\\-]+\.py)", text):
        clean = match.replace("\\", "/").strip("./")
        candidates: List[Path] = []
        direct = root / clean
        if direct.exists():
            candidates.append(direct)
        candidates.extend(all_by_name.get(Path(clean).name, []))
        for candidate in candidates:
            if candidate.exists() and candidate.suffix == ".py":
                found.add(candidate)

    return found


def build_dependency_graph(root: Path, py_files: List[Path]) -> Tuple[Dict[str, List[str]], Set[str], Dict[str, Any]]:
    by_name: Dict[str, List[Path]] = {}
    by_module: Dict[str, Path] = {}
    for path in py_files:
        by_name.setdefault(path.name, []).append(path)
        by_module[module_name_for(path, root)] = path
        # Also allow short module names.
        by_module[path.stem] = path

    graph: Dict[str, List[str]] = {}
    parse_notes: Dict[str, Any] = {}

    for path in py_files:
        current = rel(path, root)
        deps: Set[str] = set()

        for dep_path in referenced_py_files(path, root, by_name):
            deps.add(rel(dep_path, root))

        for mod in parse_imports(path):
            if mod in by_module:
                deps.add(rel(by_module[mod], root))
            # Try final segment for local scripts imported by short name.
            short = mod.split(".")[-1]
            if short in by_module:
                deps.add(rel(by_module[short], root))

        graph[current] = sorted(deps)

    active: Set[str] = set()
    queue = deque(ep for ep in DEFAULT_ENTRYPOINTS if (root / ep).exists())
    while queue:
        item = queue.popleft()
        if item in active:
            continue
        active.add(item)
        for dep in graph.get(item, []):
            if dep not in active:
                queue.append(dep)

    return graph, active, parse_notes


def classify_file(path_rel: str, active: Set[str], graph: Dict[str, List[str]]) -> str:
    name = Path(path_rel).name
    if path_rel in active:
        return "ACTIVE"
    if path_rel in NEVER_MOVE_PATHS or name in NEVER_MOVE_NAMES:
        return "PROTECTED"
    if path_rel.startswith("tools/legacy/"):
        return "ALREADY_LEGACY"
    referenced_by = [src for src, deps in graph.items() if path_rel in deps]
    if referenced_by:
        return "INDIRECTLY_REFERENCED"
    if name in SAFE_LEGACY_CANDIDATE_NAMES:
        return "LEGACY_CANDIDATE"
    # Do not aggressively move unknown tools. Mark for manual review.
    if path_rel.startswith("tools/"):
        return "MANUAL_REVIEW"
    return "NON_TOOL_PYTHON"


def build_move_plan(root: Path, records: List[Dict[str, Any]]) -> Dict[str, Any]:
    moves = []
    for rec in records:
        if rec["classification"] != "LEGACY_CANDIDATE":
            continue
        src = Path(rec["path"])
        dst = LEGACY_DIR / src.relative_to("tools")
        moves.append({
            "from": src.as_posix(),
            "to": dst.as_posix(),
            "reason": "Unreferenced legacy candidate identified by audit.",
            "status": "planned",
        })
    return {
        "schemaVersion": 2,
        "generatedAt": int(time.time()),
        "tool": TOOL_NAME,
        "legacyDir": LEGACY_DIR.as_posix(),
        "count": len(moves),
        "moves": moves,
    }


def apply_plan(root: Path, plan: Dict[str, Any], *, apply: bool) -> Dict[str, Any]:
    results = []
    for move in plan.get("moves", []):
        src = root / move["from"]
        dst = root / move["to"]
        row = dict(move)
        if not src.exists():
            row["status"] = "missing-source"
        elif dst.exists():
            row["status"] = "blocked-target-exists"
        elif apply:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))
            row["status"] = "moved"
        else:
            row["status"] = "dry-run"
        results.append(row)

    return {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "tool": TOOL_NAME,
        "apply": apply,
        "count": len(results),
        "results": results,
    }


def markdown_report(report: Dict[str, Any], plan: Dict[str, Any], move_result: Dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# Python Tool Audit Report",
        "",
        f"Generated: `{report['generatedAt']}`",
        "",
        "## Summary",
        "",
        f"- Python files scanned: **{summary['pythonFilesScanned']}**",
        f"- Active dependency files: **{summary['activeDependencyFiles']}**",
        f"- Legacy candidates: **{summary['legacyCandidates']}**",
        f"- Manual review files: **{summary['manualReviewFiles']}**",
        f"- Move mode: **{'APPLY' if move_result.get('apply') else 'DRY RUN'}**",
        "",
        "## Planned Legacy Moves",
        "",
    ]
    if not plan.get("moves"):
        lines.append("No safe legacy moves found.")
    else:
        for row in plan["moves"]:
            lines.append(f"- `{row['from']}` → `{row['to']}`")
    lines.extend([
        "",
        "## Move Results",
        "",
    ])
    for row in move_result.get("results", []):
        lines.append(f"- `{row['from']}` → `{row['to']}`: **{row['status']}**")
    lines.extend([
        "",
        "## Files",
        "",
    ])
    for rec in report["files"]:
        lines.append(f"- `{rec['path']}` — **{rec['classification']}**")
    lines.append("")
    return "\n".join(lines)


def run(apply_moves: bool = False, audit_only: bool = False) -> int:
    root = find_repo_root()
    write_marker(root, "started", processed=0, total=1, extra={"cwd": str(Path.cwd()), "script": str(Path(__file__).resolve())})

    py_files = collect_python_files(root)
    graph, active, parse_notes = build_dependency_graph(root, py_files)

    records: List[Dict[str, Any]] = []
    counts: Dict[str, int] = {}
    for path in py_files:
        rp = rel(path, root)
        refs = sorted(src for src, deps in graph.items() if rp in deps)
        classification = classify_file(rp, active, graph)
        counts[classification] = counts.get(classification, 0) + 1
        records.append({
            "path": rp,
            "classification": classification,
            "referencedBy": refs,
            "references": graph.get(rp, []),
        })

    plan = build_move_plan(root, records)
    move_result = {"schemaVersion": 1, "generatedAt": int(time.time()), "tool": TOOL_NAME, "apply": False, "count": 0, "results": []}
    if not audit_only:
        move_result = apply_plan(root, plan, apply=apply_moves)

    report = {
        "schemaVersion": 3,
        "generatedAt": int(time.time()),
        "tool": TOOL_NAME,
        "repoRoot": str(root),
        "summary": {
            "pythonFilesScanned": len(py_files),
            "activeDependencyFiles": len(active),
            "legacyCandidates": sum(1 for r in records if r["classification"] == "LEGACY_CANDIDATE"),
            "manualReviewFiles": sum(1 for r in records if r["classification"] == "MANUAL_REVIEW"),
            "classifications": counts,
        },
        "entrypoints": sorted(ep for ep in DEFAULT_ENTRYPOINTS if (root / ep).exists()),
        "files": records,
        "dependencyGraph": graph,
        "moveResult": move_result,
    }

    write_json(root / REPORT_JSON, report)
    write_json(root / LEGACY_PLAN, plan)
    write_text(root / REPORT_MD, markdown_report(report, plan, move_result))

    write_marker(
        root,
        "complete",
        processed=len(py_files),
        total=len(py_files),
        extra={
            "report": REPORT_JSON.as_posix(),
            "plan": LEGACY_PLAN.as_posix(),
            "apply": apply_moves,
            "legacyMoves": len(plan.get("moves", [])),
        },
    )

    print("Python tool audit complete.")
    print(f"Repo root: {root}")
    print(f"Python files scanned: {len(py_files)}")
    print(f"Active dependency files: {len(active)}")
    print(f"Legacy candidates: {report['summary']['legacyCandidates']}")
    print(f"Manual review files: {report['summary']['manualReviewFiles']}")
    print(f"Move mode: {'APPLY' if apply_moves else ('AUDIT ONLY' if audit_only else 'DRY RUN')}")
    print(f"Report: {REPORT_MD.as_posix()}")
    if plan.get("moves"):
        print("Legacy move results:")
        for row in move_result.get("results", []):
            print(f"  {row['status']}: {row['from']} -> {row['to']}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Python tools and optionally move safe legacy candidates.")
    parser.add_argument("--apply", action="store_true", help="Actually move safe legacy candidates into tools/legacy/.")
    parser.add_argument("--audit-only", action="store_true", help="Generate reports only; do not even run dry-run move results.")
    args = parser.parse_args()

    if args.apply and args.audit_only:
        raise SystemExit("ERROR: choose either --apply or --audit-only, not both.")

    return run(apply_moves=args.apply, audit_only=args.audit_only)


if __name__ == "__main__":
    raise SystemExit(main())
