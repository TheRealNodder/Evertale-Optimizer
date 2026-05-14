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
    "catalog.js", "roster.js", "app.js", "optimizer.js",
    "data-loader.js", "site-menu.js", "seasonal-theme.js",
]

# Files that intentionally keep the current hybrid live site working.
HYBRID_REQUIRED_FILES = {
    "optimizerEngine.js",
    "optimizer_doctrine.js",
    "optimizer-hook.js",
    "optimizerRuntimeLoader.js",
    "optimizerRuntimeBootstrap.js",
    "optimizerEngineV2.js",
    "abilityScoreEngine.js",
    "data-loader.js",
}

# Files/chunks expected to be part of the new raw-game/runtime site.
NEW_RUNTIME_REQUIRED_FILES = {
    "apkfiles/entries/runtime/optimizer_runtime_manifest.json",
    "apkfiles/entries/runtime/optimizer_runtime_model.json",
    "apkfiles/entries/runtime/optimizer_runtime_characters.json",
    "apkfiles/entries/runtime/optimizer_runtime_character_entries.json",
    "apkfiles/entries/runtime/optimizer_runtime_weapons.json",
    "apkfiles/entries/runtime/optimizer_runtime_accessories.json",
    "apkfiles/entries/runtime/optimizer_runtime_bosses.json",
    "apkfiles/entries/runtime/optimizer_runtime_tags.json",
    "apkfiles/entries/runtime/optimizer_runtime_knowledge.json",
    "apkfiles/entries/runtime/optimizer_ability_graph.json",
}

LEGACY_DATA_FILES = {
    "data/characters.json",
    "data/character_tags.json",
    "data/character_tags_additions.json",
    "data/character_actives.json",
    "data/character_passives.json",
}

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
    "apkfiles/entries/localization/",
    "tools/new_structure/",
]
RAW_GAME_SOURCE_HINTS = [
    "apkfiles/entries/characters/",
    "apkfiles/entries/weapons/",
    "apkfiles/entries/accessories/",
    "apkfiles/entries/bosses/",
    "apkfiles/entries/maps/",
    "apkfiles/entries/localization/",
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


def migration_role(path_rel: str, classification: str, reachable: Set[str], reverse_refs: Dict[str, List[str]]) -> str:
    if path_rel in NEW_RUNTIME_REQUIRED_FILES:
        return "GREEN_NEW_RUNTIME_REQUIRED"
    if any(path_rel.startswith(h) for h in RAW_GAME_SOURCE_HINTS):
        return "GREEN_RAW_GAME_SOURCE_KEEP"
    if path_rel.startswith("apkfiles/entries/bundles/"):
        return "GREEN_SITE_BUNDLE_KEEP"
    if path_rel.startswith("apkfiles/entries/runtime/"):
        return "GREEN_RUNTIME_ARTIFACT_KEEP"
    if path_rel.startswith("tools/new_structure/"):
        return "GREEN_PIPELINE_TOOL_KEEP"
    if path_rel in HYBRID_REQUIRED_FILES:
        return "YELLOW_HYBRID_REQUIRED_KEEP_FOR_NOW"
    if path_rel in LEGACY_DATA_FILES:
        return "YELLOW_LEGACY_DATA_SOURCE_KEEP_UNTIL_RUNTIME_FULLY_REPLACES"
    if classification == "actively_used":
        return "YELLOW_LIVE_DEPENDENCY_KEEP_FOR_NOW"
    if classification == "referenced_indirectly":
        return "ORANGE_REFERENCED_INDIRECTLY_REVIEW"
    if classification == "unused_candidate_review_before_delete":
        if path_rel.startswith(("apkfiles/", "tools/")):
            return "ORANGE_PROJECT_INTERNAL_REVIEW_BEFORE_QUARANTINE"
        return "RED_QUARANTINE_CANDIDATE"
    return "ORANGE_REVIEW_MANUALLY"


def action_for_role(role: str) -> str:
    if role.startswith("GREEN_"):
        return "KEEP: part of new raw-game/runtime site or rebuild pipeline."
    if role.startswith("YELLOW_"):
        return "KEEP FOR NOW: still supports current hybrid live site or legacy fallback."
    if role.startswith("ORANGE_"):
        return "REVIEW: do not move until manually verified."
    if role == "RED_QUARANTINE_CANDIDATE":
        return "QUARANTINE FIRST: move to legacy_unused/, test site, re-run audit, then consider deletion later."
    return "REVIEW: unknown migration role."


def risk_reason(path_rel: str, classification: str, role: str) -> str:
    if role.startswith("GREEN_"):
        return "Greenlit for the new runtime/raw-game site. Preserve this file."
    if role.startswith("YELLOW_"):
        return "Still needed by the current hybrid live site or legacy fallback path. Preserve until replacement is verified."
    if role.startswith("ORANGE_"):
        return "Possible dependency or protected project file. Review manually before moving."
    if role == "RED_QUARANTINE_CANDIDATE":
        return "No direct or indirect reference found by audit. Move to quarantine first, not delete immediately."
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
    parser.add_argument("--mode", choices=["hybrid", "runtime"], default="runtime", help="Report perspective. runtime highlights new-site greenlit files while preserving hybrid dependencies.")
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
        role = migration_role(path_rel, classification, reachable, reverse_refs)
        rows.append({
            "path": path_rel,
            "extension": Path(path_rel).suffix.lower(),
            "classification": classification,
            "migrationRole": role,
            "recommendedAction": action_for_role(role),
            "riskReason": risk_reason(path_rel, classification, role),
            "referencedBy": ref_sources[:50],
            "referencedByCount": len(ref_sources),
            "reachableFromLiveEntrypoint": path_rel in reachable,
            "sizeBytes": (repo / path_rel).stat().st_size if (repo / path_rel).exists() else 0,
        })

    summary = defaultdict(int)
    migration_summary = defaultdict(int)
    for row in rows:
        summary[row["classification"]] += 1
        migration_summary[row["migrationRole"]] += 1

    greenlit_new_site_files = [row for row in rows if row["migrationRole"].startswith("GREEN_")]
    keep_for_hybrid_files = [row for row in rows if row["migrationRole"].startswith("YELLOW_")]
    manual_review_files = [row for row in rows if row["migrationRole"].startswith("ORANGE_")]
    quarantine_candidates = [row for row in rows if row["migrationRole"] == "RED_QUARANTINE_CANDIDATE"]

    quarantine_plan = [
        {
            "from": row["path"],
            "to": f"legacy_unused/{row['path']}",
            "reason": row["riskReason"],
        }
        for row in quarantine_candidates
    ]

    missing_new_runtime_required = sorted(path for path in NEW_RUNTIME_REQUIRED_FILES if path not in existing)
    missing_hybrid_required = sorted(path for path in HYBRID_REQUIRED_FILES if path not in existing)

    report = {
        "schemaVersion": 2,
        "generatedAt": int(time.time()),
        "mode": args.mode,
        "repoRoot": str(repo),
        "entrypoints": ENTRYPOINTS,
        "includeNameHits": args.include_name_hits,
        "summary": dict(summary),
        "migrationSummary": dict(migration_summary),
        "totalFiles": len(rows),
        "reachableCount": len(reachable),
        "greenlitNewSiteFileCount": len(greenlit_new_site_files),
        "keepForHybridFileCount": len(keep_for_hybrid_files),
        "manualReviewFileCount": len(manual_review_files),
        "quarantineCandidateCount": len(quarantine_candidates),
        "missingNewRuntimeRequired": missing_new_runtime_required,
        "missingHybridRequired": missing_hybrid_required,
        "greenlitNewSiteFiles": greenlit_new_site_files,
        "keepForHybridFiles": keep_for_hybrid_files,
        "manualReviewFiles": manual_review_files,
        "quarantineCandidates": quarantine_candidates,
        "files": rows,
        "refsByFile": refs_by_file,
        "nameHitRefs": dict(name_hit_refs),
        "quarantinePlan": quarantine_plan,
        "instructions": [
            "GREEN files are part of the new raw-game/runtime site or rebuild pipeline. Keep them.",
            "YELLOW files still support the current hybrid live site or fallback behavior. Keep until replacement is verified.",
            "ORANGE files require manual review. Do not move them automatically.",
            "RED files are quarantine candidates only. Move to legacy_unused/ first; do not delete directly.",
            "After quarantine, test GitHub Pages, run this audit again, and only then consider deletion."
        ]
    }

    out = repo / REPORT_REL
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": "ok",
        "mode": args.mode,
        "totalFiles": len(rows),
        "reachableCount": len(reachable),
        "summary": dict(summary),
        "migrationSummary": dict(migration_summary),
        "greenlitNewSiteFileCount": len(greenlit_new_site_files),
        "keepForHybridFileCount": len(keep_for_hybrid_files),
        "manualReviewFileCount": len(manual_review_files),
        "quarantineCandidateCount": len(quarantine_candidates),
        "missingNewRuntimeRequired": missing_new_runtime_required,
        "missingHybridRequired": missing_hybrid_required,
        "report": str(out),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
