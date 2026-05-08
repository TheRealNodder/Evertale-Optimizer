#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Set

ROOT_MARKERS = ["apkfiles", "tools"]
SITE_ENTRYPOINTS = ["index.html", "roster.html", "optimizer.html"]
TEXT_EXTS = {".html", ".css", ".js", ".json", ".py", ".md", ".txt", ".yml", ".yaml"}
ARCHIVE_EXTS = {".zip", ".rar", ".7z", ".tar", ".gz"}
GENERATED_REPORTS = {"apkfiles/entries/reports"}
PROTECTED_PREFIXES = {
    "apkfiles/entries",
    "tools/new_structure",
    ".github",
}
PROTECTED_FILES = {
    "index.html",
    "roster.html",
    "optimizer.html",
    "style.css",
    "element-watermark.css",
    "catalog.js",
    "app.js",
    "optimizer.js",
    "optimizerEngine.js",
    "data-loader.js",
    "seasonal-theme.js",
    "site-menu.js",
    "favicon.ico",
}


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for folder in [current] + list(current.parents):
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root. Run from inside the Evertale-Optimizer repo.")


def rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def extract_refs_from_text(text: str) -> Set[str]:
    refs: Set[str] = set()
    patterns = [
        r'''(?:src|href)=['"]([^'"]+)['"]''',
        r'''url\(['"]?([^)'"]+)['"]?\)''',
        r'''fetch\(['"]([^'"]+)['"]''',
        r'''import\s+[^;]*?from\s+['"]([^'"]+)['"]''',
        r'''import\(['"]([^'"]+)['"]\)''',
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            value = match.group(1).split("?")[0].split("#")[0].strip()
            if value and not value.startswith(("http://", "https://", "data:", "mailto:", "#")):
                refs.add(value)
    return refs


def normalize_ref(base_file: Path, root: Path, value: str) -> str:
    value = value.replace("\\", "/").lstrip("/")
    if value.startswith("./") or value.startswith("../"):
        return (base_file.parent / value).resolve().relative_to(root.resolve()).as_posix()
    return value.lstrip("./")


def collect_references(root: Path) -> Set[str]:
    refs: Set[str] = set()
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_EXTS:
            continue
        r = rel(path, root)
        if ".git/" in r:
            continue
        try:
            text = read_text(path)
        except Exception:
            continue
        for value in extract_refs_from_text(text):
            try:
                refs.add(normalize_ref(path, root, value))
            except Exception:
                refs.add(value)
    return refs


def is_protected(path_rel: str) -> bool:
    if path_rel in PROTECTED_FILES:
        return True
    return any(path_rel == prefix or path_rel.startswith(prefix + "/") for prefix in PROTECTED_PREFIXES)


def classify_file(path: Path, root: Path, refs: Set[str]) -> Dict[str, Any]:
    path_rel = rel(path, root)
    lower = path_rel.lower()
    size = path.stat().st_size
    reasons: List[str] = []
    risk = "keep"

    if is_protected(path_rel):
        return {"path": path_rel, "size": size, "risk": "protected", "reasons": ["Protected active runtime/source path"]}

    if path.suffix.lower() in ARCHIVE_EXTS:
        risk = "high_candidate"
        reasons.append("Archive file; not loaded by browser/runtime directly")

    if any(token in lower for token in ["old", "backup", "copy", "refined", "legacy", "processedcatalogbundle"]):
        risk = "candidate" if risk == "keep" else risk
        reasons.append("Filename looks like backup/legacy/experimental artifact")

    if path.name in {"new-data-loader.js", "optimizer-hook_refined.js", "optimizerEngine_refined.js"}:
        risk = "high_candidate"
        reasons.append("Known duplicate/experimental runtime filename")

    if path_rel not in refs and path.suffix.lower() in {".js", ".css", ".html"}:
        risk = "candidate" if risk == "keep" else risk
        reasons.append("No direct src/href/import/fetch reference found")

    if path_rel in refs:
        risk = "referenced"
        reasons.append("Referenced by another text/runtime file")

    if not reasons:
        reasons.append("No cleanup signal detected")

    return {"path": path_rel, "size": size, "risk": risk, "reasons": reasons}


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit repo files and identify likely redundant cleanup candidates without deleting anything.")
    parser.add_argument("--root", default=None, help="Repo root override. Auto-detected when omitted.")
    args = parser.parse_args()

    root = Path(args.root).resolve() if args.root else find_repo_root(Path.cwd())
    refs = collect_references(root)
    rows: List[Dict[str, Any]] = []

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        path_rel = rel(path, root)
        if path_rel.startswith(".git/"):
            continue
        rows.append(classify_file(path, root, refs))

    rows.sort(key=lambda r: (r["risk"], r["path"]))
    candidates = [r for r in rows if r["risk"] in {"candidate", "high_candidate"}]
    report = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "repoRoot": str(root),
        "totalFiles": len(rows),
        "referencedCount": sum(1 for r in rows if r["risk"] == "referenced"),
        "protectedCount": sum(1 for r in rows if r["risk"] == "protected"),
        "candidateCount": len(candidates),
        "candidates": candidates,
        "allFiles": rows,
    }

    out_dir = root / "apkfiles" / "entries" / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "redundant_file_audit.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")

    print(json.dumps({
        "output": str(out_path),
        "totalFiles": report["totalFiles"],
        "candidateCount": report["candidateCount"],
        "topCandidates": candidates[:25],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
