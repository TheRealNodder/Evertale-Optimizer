#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Set

ROOT_MARKERS = ["apkfiles", "tools"]
REPORT_REL = "apkfiles/entries/reports/deep_dependency_audit.json"
TEXT_EXTS = {
    ".html", ".js", ".css", ".json", ".py", ".md", ".txt", ".yml", ".yaml"
}
IGNORE_DIRS = {
    ".git", ".github", "node_modules", "__pycache__", ".pytest_cache",
    "legacy_unused", "legacy_delete_candidates", "archive", "archives"
}
ENTRYPOINTS = [
    "index.html", "roster.html", "optimizer.html",
    "catalog.js", "roster.js", "optimizer.js",
    "data-loader.js", "site-menu.js", "seasonal-theme.js",
]
GENERATED_HINTS = [
    "apkfiles/entries/bundles/",
    "apkfiles/entries/runtime/",
    "apkfiles/entries/reports/",
]
PROTECTED_HINTS = [
    "apkfiles/entries/characters/",
    "apkfiles/entries/weapons/",
    "apkfiles/entries/accessories/",
    "apkfiles/entries/bosses/",
    "apkfiles/entries/maps/",
    "tools/new_structure/",
]

PATTERNS = [
    re.compile(r"<script[^>]+src=[\"']([^\"']+)[\"']", re.I),
    re.compile(r"<link[^>]+href=[\"']([^\"']+)[\"']", re.I),
    re.compile(r"fetch\(\s*[`\"']([^`\"']+)[`\"']", re.I),
    re.compile(r"(?:src|href)\s*=\s*[`\"']([^`\"']+)[`\"']", re.I),
    re.compile(r"(?:import|from)\s+[\"']([^\"']+)[\"']", re.I),
    re.compile(r"open\(\s*[rbuf]*[\"']([^\"']+)[\"']", re.I),
    re.compile(r"Path\(\s*[\"']([^\"']+)[\"']\s*\)", re.I),
    re.compile(r"[\"']([^\"']+\.(?:js|css|html|json|png|jpg|jpeg|webp|svg|py))[\"']", re.I),
]


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root")


def rel(path: Path, repo: Path) -> str:
    return path.relative_to(repo).as_posix()


def should_skip(path: Path, repo: Path) -> bool:
    parts = set(path.relative_to(repo).parts)
    return bool(parts & IGNORE_DIRS)


def iter_files(repo: Path) -> Iterable[Path]:
    for path in repo.rglob("*"):
        if path.is_file() and not should_skip(path, repo):
            yield path


def is_text_candidate(path: Path) -> bool:
    return path.suffix.lower() in TEXT_EXTS


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8-sig", errors="ignore")
    except Exception:
        return ""


def clean_ref(ref: str) -> str:
    ref = str(ref or "").strip()
    ref = ref.split("#", 1)[0].split("?", 1)[0]
    ref = ref.replace("\\", "/")
    while ref.startswith("./"):
        ref = ref[2:]
    return ref


def resolve_ref(source: Path, ref_value: str, repo: Path) -> str:
    ref_value = clean_ref(ref_value)
    if not ref_value:
        return ""
    if ref_value.startswith(("http://", "https://", "data:", "mailto:", "tel:")):
        return ""
    if ref_value.startswith("/"):
        candidate = repo / ref_value.lstrip("/")
    else:
        candidate = (source.parent / ref_value).resolve()
    try:
        return candidate.relative_to(repo).as_posix()
    except Exception:
        return ref_value


def extract_refs(path: Path, repo: Path) -> List[str]:
    text = read_text(path)
    refs: List[str] = []
    for pattern in PATTERNS:
        for match in pattern.findall(text):
            if isinstance(match, tuple):
                match = match[0]
            resolved = resolve_ref(path, match, repo)
            if resolved:
                refs.append(resolved)
    return sorted(set(refs))


def direct_name_hits(path: Path, all_names: Dict[str, List[str]], repo: Path) -> Set[str]:
    text = read_text(path)
    hits: Set[str] = set()
    if not text:
        return hits
    # Limit direct-name matching to useful file names to avoid excessive false positives.
    for name, paths in all_names.items():
        if len(name) < 8:
            continue
        if name in text:
            hits.update(paths)
    return hits


def classify_file(path_rel: str, referenced: Set[str], reverse_refs: Dict[str, List[str]]) -> str:
    if path_rel in referenced or path_rel in ENTRYPOINTS:
        return "actively_used"
    if any(path_rel.startswith(h) for h in PROTECTED_HINTS):
        return "protected_source"
    if any(path_rel.startswith(h) for h in GENERATED_HINTS):
        return "generated_rebuildable_or_runtime"
    if reverse_refs.get(path_rel):
        return "referenced_indirectly"
    return "unused_candidate_review_before_delete"


def risk_reason(path_rel: str, classification: str) -> str:
    if classification == "actively_used":
        return "Referenced by an entrypoint, script/link/fetch/import, or known live page. Do not move."
    if classification == "protected_source":
        return "Source data or tool path. Do not delete unless replaced by generated runtime and verified."
    if classification == "generated_rebuildable_or_runtime":
        return "Generated/runtime artifact. May be rebuildable, but may still be needed by live site."
    if classification == "referenced_indirectly":
        return "Referenced by text/name match. Verify manually before moving."
    return "No direct or indirect reference found by audit. Move to quarantine first, not delete immediately."


def main() -> int:
    parser = argparse.ArgumentParser(description="Deep dependency audit for safe legacy cleanup/migration.")
    parser.add_argument("--include-name-hits", action="store_true", help="Also scan text for exact filename mentions; slower but deeper.")
    args = parser.parse_args()

    repo = find_repo_root(Path.cwd())
    files = sorted(iter_files(repo), key=lambda p: rel(p, repo))
    file_rels = [rel(p, repo) for p in files]
    existing = set(file_rels)

    refs_by_file: Dict[str, List[str]] = {}
    reverse_refs: Dict[str, List[str]] = defaultdict(list)

    for path in files:
        if not is_text_candidate(path):
            continue
        src_rel = rel(path, repo)
        refs = extract_refs(path, repo)
        refs_by_file[src_rel] = refs
        for ref_path in refs:
            if ref_path in existing:
                reverse_refs[ref_path].append(src_rel)

    all_names: Dict[str, List[str]] = defaultdict(list)
    for path_rel in file_rels:
        all_names[Path(path_rel).name].append(path_rel)

    name_hit_refs: Dict[str, List[str]] = defaultdict(list)
    if args.include_name_hits:
        for path in files:
            if not is_text_candidate(path):
                continue
            src_rel = rel(path, repo)
            for hit in direct_name_hits(path, all_names, repo):
                if hit != src_rel:
                    name_hit_refs[hit].append(src_rel)
                    reverse_refs[hit].append(src_rel)

    reachable: Set[str] = set()
    queue: List[str] = []
    for entry in ENTRYPOINTS:
        if entry in existing:
            reachable.add(entry)
            queue.append(entry)

    while queue:
        current = queue.pop(0)
        for nxt in refs_by_file.get(current, []):
            if nxt in existing and nxt not in reachable:
                reachable.add(nxt)
                queue.append(nxt)

    rows: List[Dict[str, Any]] = []
    for path_rel in file_rels:
        ref_sources = sorted(set(reverse_refs.get(path_rel, [])))
        classification = classify_file(path_rel, reachable, reverse_refs)
        rows.append({
            "path": path_rel,
            "extension": Path(path_rel).suffix.lower(),
            "classification": classification,
            "riskReason": risk_reason(path_rel, classification),
            "referencedBy": ref_sources[:50],
            "referencedByCount": len(ref_sources),
            "reachableFromLiveEntrypoint": path_rel in reachable,
            "sizeBytes": (repo / path_rel).stat().st_size if (repo / path_rel).exists() else 0,
        })

    summary = defaultdict(int)
    for row in rows:
        summary[row["classification"]] += 1

    safe_move_candidates = [
        row for row in rows
        if row["classification"] == "unused_candidate_review_before_delete"
        and not row["path"].startswith(("apkfiles/", "tools/"))
    ]

    quarantine_plan = [
        {
            "from": row["path"],
            "to": f"legacy_unused/{row['path']}",
            "reason": row["riskReason"],
        }
        for row in safe_move_candidates
    ]

    report = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "repoRoot": str(repo),
        "entrypoints": ENTRYPOINTS,
        "includeNameHits": args.include_name_hits,
        "summary": dict(summary),
        "totalFiles": len(rows),
        "reachableCount": len(reachable),
        "safeMoveCandidateCount": len(safe_move_candidates),
        "files": rows,
        "refsByFile": refs_by_file,
        "quarantinePlan": quarantine_plan,
        "instructions": [
            "Do not delete files directly from this report.",
            "First move safe candidates to legacy_unused/ and test the live site.",
            "Only delete after a successful deploy and a second audit confirms no references."
        ]
    }

    out = repo / REPORT_REL
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": "ok",
        "totalFiles": len(rows),
        "reachableCount": len(reachable),
        "summary": dict(summary),
        "safeMoveCandidateCount": len(safe_move_candidates),
        "report": str(out),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
