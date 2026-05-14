#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any, Dict, List

ROOT_MARKERS = ["apkfiles", "tools"]
DEFAULT_PLAN = "apkfiles/entries/reports/quarantine_plan_only.json"

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
        raise SystemExit(f"ERROR: Missing quarantine plan: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"ERROR: Invalid JSON in {path}: {exc}") from exc


def normalize_repo_path(value: Any) -> str:
    value = str(value or "").strip().replace("\\", "/")
    while value.startswith("./"):
        value = value[2:]
    return value


def is_protected(path: str) -> bool:
    if path in PROTECTED_ALWAYS_KEEP:
        return True
    return path.startswith(PROTECTED_PREFIXES)


def validate_plan_item(item: Dict[str, Any]) -> tuple[str, str]:
    src = normalize_repo_path(item.get("from"))
    dst = normalize_repo_path(item.get("to"))
    if not src or not dst:
        raise ValueError(f"Invalid plan item missing from/to: {item}")
    if src.startswith("legacy_unused/"):
        raise ValueError(f"Source is already inside legacy_unused/: {src}")
    if not dst.startswith("legacy_unused/"):
        raise ValueError(f"Destination must be inside legacy_unused/: {dst}")
    if src == dst:
        raise ValueError(f"Source and destination are identical: {src}")
    if is_protected(src):
        raise ValueError(f"Protected source must not be moved: {src}")
    return src, dst


def empty_dirs_bottom_up(paths: List[Path], repo: Path) -> List[str]:
    removed: List[str] = []
    seen = sorted({p.parent for p in paths}, key=lambda p: len(p.parts), reverse=True)
    for folder in seen:
        if folder == repo or not folder.exists():
            continue
        try:
            folder.rmdir()
            removed.append(folder.relative_to(repo).as_posix())
        except OSError:
            pass
    return removed


def main() -> int:
    parser = argparse.ArgumentParser(description="Move RED quarantine candidates into legacy_unused/.")
    parser.add_argument(
        "--plan",
        default=DEFAULT_PLAN,
        help=f"Path to quarantine_plan_only.json. Default: {DEFAULT_PLAN}",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually move files. Without this flag, the tool only performs a dry run.",
    )
    parser.add_argument(
        "--no-clean-empty-dirs",
        action="store_true",
        help="Do not remove empty source directories after moving files.",
    )
    args = parser.parse_args()

    repo = find_repo_root(Path.cwd())
    plan_path = repo / args.plan
    report = load_json(plan_path)
    plan = report.get("quarantinePlan") or []

    if not isinstance(plan, list):
        raise SystemExit("ERROR: quarantinePlan must be a list.")

    operations: List[tuple[str, str]] = []
    skipped_missing: List[str] = []
    skipped_existing: List[str] = []
    blocked: List[str] = []

    for item in plan:
        try:
            src_rel, dst_rel = validate_plan_item(item)
        except ValueError as exc:
            blocked.append(str(exc))
            continue

        src = repo / src_rel
        dst = repo / dst_rel
        if not src.exists():
            skipped_missing.append(src_rel)
            continue
        if dst.exists():
            skipped_existing.append(dst_rel)
            continue
        operations.append((src_rel, dst_rel))

    summary = {
        "mode": "apply" if args.apply else "dry_run",
        "planPath": str(plan_path),
        "planCount": len(plan),
        "movableOperationCount": len(operations),
        "skippedMissingCount": len(skipped_missing),
        "skippedExistingDestinationCount": len(skipped_existing),
        "blockedCount": len(blocked),
        "blocked": blocked[:25],
        "skippedMissing": skipped_missing[:25],
        "skippedExistingDestination": skipped_existing[:25],
    }

    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if blocked:
        raise SystemExit("ERROR: Protected or invalid plan items found. Nothing was moved.")

    if not args.apply:
        print("DRY RUN ONLY. Re-run with --apply to move files.")
        return 0

    moved_sources: List[Path] = []
    moved: List[Dict[str, str]] = []
    for src_rel, dst_rel in operations:
        src = repo / src_rel
        dst = repo / dst_rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
        moved_sources.append(src)
        moved.append({"from": src_rel, "to": dst_rel})

    removed_empty_dirs: List[str] = []
    if not args.no_clean_empty_dirs:
        removed_empty_dirs = empty_dirs_bottom_up(moved_sources, repo)

    result = {
        "status": "ok",
        "movedCount": len(moved),
        "skippedMissingCount": len(skipped_missing),
        "skippedExistingDestinationCount": len(skipped_existing),
        "removedEmptyDirCount": len(removed_empty_dirs),
        "removedEmptyDirs": removed_empty_dirs[:50],
        "firstMoved": moved[:25],
        "nextSteps": [
            "Review git status.",
            "Test index.html, roster.html, and optimizer.html locally or on GitHub Pages.",
            "Run python tools/new_structure/deep_dependency_audit.py --include-name-hits again.",
            "Commit the quarantine move only after the site still works."
        ],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
