#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Set

from path_utils import find_repo_root, resolve_repo_path

ROOT_MARKERS = ["apkfiles", "tools"]
DEFAULT_REPORT = "apkfiles/entries/reports/runtime_optimizer_trace.json"

OPTIMIZER_FILES = [
    "optimizer.html",
    "optimizer.js",
    "optimizerEngine.js",
    "optimizer_doctrine.js",
    "optimizer-hook.js",
    "optimizerEngineV2.js",
    "abilityScoreEngine.js",
    "optimizerRuntimeLoader.js",
    "optimizerRuntimeBootstrap.js",
    "data-loader.js",
]

LEGACY_FILES = {
    "optimizerEngine.js",
    "optimizer_doctrine.js",
    "optimizer-hook.js",
}

RUNTIME_FILES = {
    "optimizerEngineV2.js",
    "abilityScoreEngine.js",
    "optimizerRuntimeLoader.js",
    "optimizerRuntimeBootstrap.js",
}

GLOBAL_ASSIGNMENT_RE = re.compile(r"window\.([A-Za-z_$][\w$]*)\s*=", re.M)
GLOBAL_READ_RE = re.compile(r"window\.([A-Za-z_$][\w$]*)", re.M)
FUNCTION_RE = re.compile(r"(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:function\s*\(|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>))", re.M)
CLASS_RE = re.compile(r"class\s+([A-Za-z_$][\w$]*)\b", re.M)
SCRIPT_RE = re.compile(r"<script[^>]+src=[\"']([^\"']+)[\"']", re.I)
FETCH_RE = re.compile(r"fetch\(\s*[`\"']([^`\"']+)[`\"']", re.I)
CALL_RE_TEMPLATE = r"(?<![\w$]){name}\s*\("


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8-sig", errors="ignore")
    except FileNotFoundError:
        return ""


def normalize_ref(ref: str) -> str:
    ref = str(ref or "").strip().replace("\\", "/")
    ref = ref.split("?", 1)[0].split("#", 1)[0]
    while ref.startswith("./"):
        ref = ref[2:]
    return ref


def extract_functions(text: str) -> List[str]:
    names: Set[str] = set()
    for match in FUNCTION_RE.findall(text):
        for group in match:
            if group:
                names.add(group)
    return sorted(names)


def extract_classes(text: str) -> List[str]:
    return sorted(set(CLASS_RE.findall(text)))


def extract_script_order(html: str) -> List[str]:
    return [normalize_ref(match) for match in SCRIPT_RE.findall(html)]


def extract_fetches(text: str) -> List[str]:
    return sorted(set(normalize_ref(match) for match in FETCH_RE.findall(text)))


def function_call_count(text: str, name: str) -> int:
    if not name:
        return 0
    return len(re.findall(CALL_RE_TEMPLATE.format(name=re.escape(name)), text))


def scan_file(repo: Path, rel_path: str) -> Dict[str, Any]:
    full = repo / rel_path
    text = read_text(full)
    assigned_globals = sorted(set(GLOBAL_ASSIGNMENT_RE.findall(text)))
    read_globals = sorted(set(GLOBAL_READ_RE.findall(text)))
    return {
        "path": rel_path,
        "exists": full.exists(),
        "sizeBytes": full.stat().st_size if full.exists() else 0,
        "lineCount": len(text.splitlines()) if text else 0,
        "category": "legacy" if rel_path in LEGACY_FILES else "runtime" if rel_path in RUNTIME_FILES else "ui_or_loader",
        "functions": extract_functions(text),
        "classes": extract_classes(text),
        "assignedGlobals": assigned_globals,
        "readGlobals": read_globals,
        "fetches": extract_fetches(text),
        "scriptOrder": extract_script_order(text) if rel_path.endswith(".html") else [],
    }


def build_symbol_index(scans: List[Dict[str, Any]]) -> Dict[str, Any]:
    function_defs: Dict[str, List[str]] = defaultdict(list)
    class_defs: Dict[str, List[str]] = defaultdict(list)
    global_assignments: Dict[str, List[str]] = defaultdict(list)
    global_reads: Dict[str, List[str]] = defaultdict(list)

    for scan in scans:
        path = scan["path"]
        for name in scan.get("functions", []):
            function_defs[name].append(path)
        for name in scan.get("classes", []):
            class_defs[name].append(path)
        for name in scan.get("assignedGlobals", []):
            global_assignments[name].append(path)
        for name in scan.get("readGlobals", []):
            global_reads[name].append(path)

    return {
        "functionDefinitions": {k: sorted(v) for k, v in sorted(function_defs.items())},
        "classDefinitions": {k: sorted(v) for k, v in sorted(class_defs.items())},
        "globalAssignments": {k: sorted(v) for k, v in sorted(global_assignments.items())},
        "globalReads": {k: sorted(v) for k, v in sorted(global_reads.items())},
    }


def detect_legacy_global_dependencies(scans: List[Dict[str, Any]], index: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    global_assignments = index.get("globalAssignments", {})
    global_reads = index.get("globalReads", {})

    for name, assigners in global_assignments.items():
        legacy_assigners = [p for p in assigners if p in LEGACY_FILES]
        runtime_assigners = [p for p in assigners if p in RUNTIME_FILES]
        readers = global_reads.get(name, [])
        if legacy_assigners or runtime_assigners:
            rows.append({
                "global": name,
                "legacyAssigners": legacy_assigners,
                "runtimeAssigners": runtime_assigners,
                "readers": readers,
                "hasRuntimeReplacement": bool(runtime_assigners),
                "risk": "legacy_global_still_active" if legacy_assigners and not runtime_assigners else "runtime_replaces_or_wraps_legacy" if legacy_assigners and runtime_assigners else "runtime_owned_global",
            })
    return sorted(rows, key=lambda row: (row["risk"], row["global"]))


def detect_function_usage(repo: Path, scans: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    combined_text_by_file = {scan["path"]: read_text(repo / scan["path"]) for scan in scans if scan.get("exists")}
    all_text = "\n".join(combined_text_by_file.values())
    rows: List[Dict[str, Any]] = []

    for scan in scans:
        path = scan["path"]
        category = scan.get("category")
        for name in scan.get("functions", []):
            total_calls = function_call_count(all_text, name)
            self_calls = function_call_count(combined_text_by_file.get(path, ""), name)
            external_calls = max(0, total_calls - self_calls)
            rows.append({
                "function": name,
                "definedIn": path,
                "category": category,
                "totalCallMentions": total_calls,
                "externalCallMentions": external_calls,
                "candidateStatus": "legacy_function_possible_replacement_review" if category == "legacy" and external_calls > 0 else "legacy_function_no_external_call_detected" if category == "legacy" else "runtime_or_ui_function",
            })
    return sorted(rows, key=lambda row: (row["candidateStatus"], row["definedIn"], row["function"]))


def detect_script_chain(scans: List[Dict[str, Any]]) -> Dict[str, Any]:
    html_scan = next((scan for scan in scans if scan["path"] == "optimizer.html"), None)
    order = html_scan.get("scriptOrder", []) if html_scan else []
    relevant = [path for path in order if path in OPTIMIZER_FILES or path.endswith(".js")]
    legacy_in_chain = [path for path in relevant if path in LEGACY_FILES]
    runtime_in_chain = [path for path in relevant if path in RUNTIME_FILES]
    return {
        "optimizerHtmlScriptOrder": relevant,
        "legacyFilesInScriptChain": legacy_in_chain,
        "runtimeFilesInScriptChain": runtime_in_chain,
        "isHybrid": bool(legacy_in_chain and runtime_in_chain),
    }


def build_blockers(scans: List[Dict[str, Any]], script_chain: Dict[str, Any], legacy_globals: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    blockers: List[Dict[str, str]] = []
    for path in script_chain.get("legacyFilesInScriptChain", []):
        blockers.append({
            "type": "legacy_script_loaded_by_optimizer_html",
            "path": path,
            "reason": "optimizer.html still loads this legacy script directly. It cannot be quarantined until runtime V2 fully replaces or no longer needs it.",
        })
    for row in legacy_globals:
        if row.get("legacyAssigners") and not row.get("runtimeAssigners"):
            blockers.append({
                "type": "legacy_global_without_runtime_replacement",
                "path": ", ".join(row.get("legacyAssigners", [])),
                "reason": f"window.{row.get('global')} is assigned by legacy code and no runtime assignment was detected.",
            })
    return blockers


def main() -> int:
    parser = argparse.ArgumentParser(description="Trace optimizer hybrid/runtime JS dependencies.")
    parser.add_argument(
        "--output",
        default=DEFAULT_REPORT,
        help=f"Report path. Default: {DEFAULT_REPORT}",
    )
    args = parser.parse_args()

    repo = find_repo_root(Path(__file__).resolve())
    scans = [scan_file(repo, rel_path) for rel_path in OPTIMIZER_FILES]
    index = build_symbol_index(scans)
    script_chain = detect_script_chain(scans)
    legacy_globals = detect_legacy_global_dependencies(scans, index)
    function_usage = detect_function_usage(repo, scans)
    blockers = build_blockers(scans, script_chain, legacy_globals)

    missing_files = [scan["path"] for scan in scans if not scan.get("exists")]

    report = {
        "schemaVersion": 1,
        "purpose": "Trace remaining optimizer hybrid dependencies before migrating to runtime-only optimizer flow.",
        "optimizerFilesScanned": OPTIMIZER_FILES,
        "missingFiles": missing_files,
        "scriptChain": script_chain,
        "isHybridOptimizerStack": script_chain.get("isHybrid", False),
        "blockerCount": len(blockers),
        "blockers": blockers,
        "legacyGlobalDependencies": legacy_globals,
        "functionUsage": function_usage,
        "symbolIndex": index,
        "fileScans": scans,
        "nextSteps": [
            "Review blocker list first.",
            "Do not remove optimizerEngine.js, optimizer_doctrine.js, or optimizer-hook.js while they appear in optimizer.html script chain.",
            "Map legacy globals/functions to runtime replacements before changing optimizer.html.",
            "After any patch, test index.html, roster.html, and optimizer.html locally.",
        ],
    }

    out = resolve_repo_path(repo, args.output, DEFAULT_REPORT)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": "ok",
        "output": str(out),
        "missingFiles": missing_files,
        "isHybridOptimizerStack": report["isHybridOptimizerStack"],
        "blockerCount": len(blockers),
        "legacyScriptsInChain": script_chain.get("legacyFilesInScriptChain", []),
        "runtimeScriptsInChain": script_chain.get("runtimeFilesInScriptChain", []),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
