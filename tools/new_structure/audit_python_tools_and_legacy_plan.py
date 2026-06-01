#!/usr/bin/env python3
from __future__ import annotations

import ast
import json
import re
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Any, Dict, List, Set

ROOT_MARKERS = ("apkfiles", "tools")
REPORT_JSON = "apkfiles/entries/reports/python_tool_audit_report.json"
REPORT_MD = "apkfiles/entries/reports/python_tool_audit_report.md"
LEGACY_PLAN = "apkfiles/entries/reports/python_tool_legacy_move_plan.json"
LEGACY_DIR = "tools/legacy"

PRIMARY_ENTRYPOINTS = {
    "tools/new_structure/MASTER_CONTROL.py",
    "tools/new_structure/run_safe_new_data_ingest.py",
    "tools/new_structure/run_entry_pipeline.py",
    "tools/master_control.py",
}

NEVER_MOVE = {
    "tools/new_structure/entry_checkpoint.py",
    "tools/new_structure/master_control_tools.json",
}

KNOWN_MANUAL_KEEP_KEYWORDS = (
    "audit", "quarantine", "trace", "extract", "import", "organize", "renumber", "repair", "validate", "build", "sync", "runtime", "optimizer", "scan"
)


def find_repo_root(start: Path | None = None) -> Path:
    cur = (start or Path.cwd()).resolve()
    for p in [cur, *cur.parents]:
        if all((p / marker).exists() for marker in ROOT_MARKERS):
            return p
    raise SystemExit("Could not locate repo root")


def rel(path: Path, root: Path) -> str:
    return str(path.relative_to(root)).replace("\\", "/")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def py_files(root: Path) -> List[Path]:
    return sorted((root / "tools").rglob("*.py"))


def tool_files(root: Path) -> List[Path]:
    exts = {".py", ".js", ".bat", ".ps1", ".json", ".md"}
    return sorted(p for p in (root / "tools").rglob("*") if p.is_file() and p.suffix.lower() in exts)


def ast_imports(path: Path) -> Set[str]:
    out: Set[str] = set()
    try:
        tree = ast.parse(read_text(path))
    except Exception:
        return out
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                out.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                out.add(node.module.split(".")[0])
    return out


def referenced_script_names(root: Path) -> Dict[str, Set[str]]:
    refs: Dict[str, Set[str]] = defaultdict(set)
    names = {p.name: rel(p, root) for p in py_files(root)}
    for src in tool_files(root):
        text = read_text(src)
        src_rel = rel(src, root)
        for name, target_rel in names.items():
            if name in text and src_rel != target_rel:
                refs[target_rel].add(src_rel)
    return refs


def import_references(root: Path) -> Dict[str, Set[str]]:
    module_to_path = {p.stem: rel(p, root) for p in py_files(root)}
    refs: Dict[str, Set[str]] = defaultdict(set)
    for src in py_files(root):
        src_rel = rel(src, root)
        for module in ast_imports(src):
            target = module_to_path.get(module)
            if target and target != src_rel:
                refs[target].add(src_rel)
    return refs


def parse_registry(root: Path) -> Dict[str, Any]:
    path = root / "tools/new_structure/master_control_tools.json"
    if not path.exists():
        return {"active": [], "legacyCandidates": []}
    try:
        return json.loads(read_text(path))
    except Exception:
        return {"active": [], "legacyCandidates": []}


def dependency_closure(start: Set[str], refs_by_source: Dict[str, Set[str]]) -> Set[str]:
    # refs_by_source maps source -> targets it mentions/imports/calls
    seen = set(start)
    q = deque(start)
    while q:
        cur = q.popleft()
        for nxt in refs_by_source.get(cur, set()):
            if nxt not in seen:
                seen.add(nxt)
                q.append(nxt)
    return seen


def build_source_to_targets(root: Path) -> Dict[str, Set[str]]:
    py = py_files(root)
    by_name = {p.name: rel(p, root) for p in py}
    by_stem = {p.stem: rel(p, root) for p in py}
    out: Dict[str, Set[str]] = defaultdict(set)
    for src in tool_files(root):
        srel = rel(src, root)
        text = read_text(src)
        for name, target in by_name.items():
            if target != srel and name in text:
                out[srel].add(target)
        if src.suffix == ".py":
            for module in ast_imports(src):
                target = by_stem.get(module)
                if target and target != srel:
                    out[srel].add(target)
    return out


def classify(root: Path) -> Dict[str, Any]:
    registry = parse_registry(root)
    all_py = [rel(p, root) for p in py_files(root)]
    all_tool_files = [rel(p, root) for p in tool_files(root)]
    script_refs = referenced_script_names(root)
    import_refs = import_references(root)
    incoming: Dict[str, Set[str]] = defaultdict(set)
    for target, srcs in script_refs.items():
        incoming[target].update(srcs)
    for target, srcs in import_refs.items():
        incoming[target].update(srcs)
    source_to_targets = build_source_to_targets(root)

    registry_active = {row.get("path") for row in registry.get("active", []) if isinstance(row, dict) and row.get("path")}
    root_set = set(PRIMARY_ENTRYPOINTS) | registry_active
    active_closure = dependency_closure(root_set, source_to_targets)
    legacy_registry = {row.get("path"): row.get("reason", "listed as legacy candidate") for row in registry.get("legacyCandidates", []) if isinstance(row, dict) and row.get("path")}

    rows = []
    for path in all_py:
        name = Path(path).name
        inc = sorted(incoming.get(path, []))
        outgoing = sorted(source_to_targets.get(path, []))
        status = "REVIEW"
        reason = "Not in active closure; review manually before moving."
        move_to_legacy = False
        safe_to_delete = False
        if path in root_set:
            status = "ACTIVE_ENTRYPOINT"
            reason = "Primary runner or registered active tool."
        elif path in active_closure:
            status = "ACTIVE_DEPENDENCY"
            reason = "Referenced by an active entrypoint/tool chain."
        elif path in legacy_registry:
            status = "LEGACY_CANDIDATE"
            reason = legacy_registry[path]
            move_to_legacy = True
        elif "__pycache__" in path or path.endswith(".pyc"):
            status = "CACHE_OR_BYTECODE"
            reason = "Generated cache file; safe to remove, not move."
            safe_to_delete = True
        elif inc:
            status = "REFERENCED_MANUAL_OR_SUPPORT"
            reason = "Referenced somewhere, but not in the active Master Control closure."
        elif any(k in name.lower() for k in KNOWN_MANUAL_KEEP_KEYWORDS):
            status = "UNREFERENCED_MANUAL_TOOL"
            reason = "Standalone utility/audit/build tool; keep until explicitly replaced."
        else:
            status = "UNREFERENCED_REVIEW"
            reason = "No detected references; move only after manual confirmation."
            move_to_legacy = True
        if path in NEVER_MOVE:
            move_to_legacy = False
            reason += " Protected by NEVER_MOVE."
        rows.append({
            "path": path,
            "status": status,
            "reason": reason,
            "incomingReferences": inc,
            "outgoingReferences": outgoing,
            "moveToLegacyRecommended": move_to_legacy,
            "safeToDeleteRecommended": safe_to_delete,
            "legacyDestination": f"{LEGACY_DIR}/{path}" if move_to_legacy else None,
        })
    return {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "purpose": "Audit Python/tools files, detect active Master Control dependency closure, and produce a safe legacy move plan.",
        "counts": {
            "pythonFiles": len(all_py),
            "toolFilesScanned": len(all_tool_files),
            "activeEntrypoints": len(root_set),
            "activeClosureFiles": len(active_closure),
        },
        "primaryEntrypoints": sorted(PRIMARY_ENTRYPOINTS),
        "registryActive": sorted(registry_active),
        "rows": rows,
        "summaryByStatus": dict(sorted({s: sum(1 for r in rows if r["status"] == s) for s in {r["status"] for r in rows}}.items())),
        "legacyMovePlan": [r for r in rows if r["moveToLegacyRecommended"]],
        "deletePlan": [r for r in rows if r["safeToDeleteRecommended"]],
        "rules": [
            "Do not delete active entrypoints or active dependencies.",
            "Move only LEGACY_CANDIDATE or UNREFERENCED_REVIEW files after manual review.",
            "Keep standalone audit/build/repair tools unless their replacement is verified.",
            "Generated __pycache__ files can be deleted without moving to legacy.",
        ],
    }


def markdown(report: Dict[str, Any]) -> str:
    rows = report["rows"]
    lines = []
    lines.append("# Python / Tool Audit and Legacy Move Plan")
    lines.append("")
    lines.append(f"Generated: `{report['generatedAt']}`")
    lines.append("")
    lines.append("## Counts")
    for k, v in report["counts"].items():
        lines.append(f"- {k}: {v}")
    lines.append("")
    lines.append("## Summary by Status")
    for k, v in report["summaryByStatus"].items():
        lines.append(f"- {k}: {v}")
    lines.append("")
    lines.append("## Recommended Legacy Moves")
    moves = report["legacyMovePlan"]
    if not moves:
        lines.append("No automatic moves recommended.")
    else:
        for r in moves:
            lines.append(f"- `{r['path']}` → `{r['legacyDestination']}` — {r['reason']}")
    lines.append("")
    lines.append("## Safe Deletes")
    dels = report["deletePlan"]
    if not dels:
        lines.append("No delete-only files found.")
    else:
        for r in dels:
            lines.append(f"- `{r['path']}` — {r['reason']}")
    lines.append("")
    lines.append("## Full Python File Classification")
    lines.append("| Status | Path | Incoming refs | Reason |")
    lines.append("|---|---|---:|---|")
    for r in rows:
        lines.append(f"| {r['status']} | `{r['path']}` | {len(r['incomingReferences'])} | {r['reason'].replace('|','/')} |")
    lines.append("")
    lines.append("## Rules")
    for rule in report["rules"]:
        lines.append(f"- {rule}")
    return "\n".join(lines) + "\n"


def main() -> int:
    root = find_repo_root()
    report = classify(root)
    write_json(root / REPORT_JSON, report)
    write_text(root / REPORT_MD, markdown(report))
    write_json(root / LEGACY_PLAN, {
        "schemaVersion": 1,
        "generatedAt": report["generatedAt"],
        "legacyDir": LEGACY_DIR,
        "moves": report["legacyMovePlan"],
        "deletes": report["deletePlan"],
        "note": "Review before applying. This script does not move files; it only audits and plans.",
    })
    print(f"Wrote {REPORT_JSON}")
    print(f"Wrote {REPORT_MD}")
    print(f"Wrote {LEGACY_PLAN}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
