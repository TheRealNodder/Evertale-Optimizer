#!/usr/bin/env python3
"""
Universal launcher for the Evertale APK entry builder.

Use this when you do not want to worry about folder paths.

What it does:
- Auto-detects raw APK files.
- Finds Monster.json, Weapon.json, Equipment.json, Boss.json automatically.
- Writes output to the active runtime folder: apkfiles/entries.
- Keeps generated entries loadable by data-loader.js without hardwiring JS.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Iterable, Optional

CORE_FILES = ("Monster.json", "Weapon.json", "Equipment.json", "Boss.json")
SCRIPT_RELATIVE = Path("tools/new_structure/build_apk_entry_folders.py")


def has_core_files(folder: Path) -> int:
    return sum(1 for name in CORE_FILES if (folder / name).is_file())


def find_repo_root(start: Path) -> Optional[Path]:
    for folder in [start, *start.parents]:
        if (folder / SCRIPT_RELATIVE).is_file():
            return folder
        if (folder / ".git").exists() and (folder / "tools" / "new_structure").exists():
            return folder
    return None


def candidate_folders(start: Path) -> Iterable[Path]:
    yield start
    for name in ("raw", "apkfiles", "Full List", "full list"):
        p = start / name
        if p.is_dir():
            yield p
    for name in ("raw", "apkfiles"):
        p = start.parent / name
        if p.is_dir():
            yield p
    try:
        for p in start.rglob("*"):
            if p.is_dir():
                depth = len(p.relative_to(start).parts)
                if depth <= 3:
                    yield p
    except Exception:
        pass


def find_best_input(start: Path) -> Optional[Path]:
    best: Optional[Path] = None
    best_score = 0
    seen = set()
    for folder in candidate_folders(start):
        folder = folder.resolve()
        if folder in seen:
            continue
        seen.add(folder)
        score = has_core_files(folder)
        if score > best_score:
            best = folder
            best_score = score
        if score == len(CORE_FILES):
            return folder
    return best if best_score > 0 else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Auto-detect raw APK folder and run the Evertale entry builder.")
    parser.add_argument("--base", default=".", help="Starting folder to search from. Default: current folder.")
    parser.add_argument("--output", default=None, help="Optional output folder override.")
    parser.add_argument("--force", action="store_true", help="Force rebuild all entries.")
    parser.add_argument("--category", choices=["characters", "weapons", "accessories", "bosses"], default=None)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--start-after", default=None)
    args = parser.parse_args()

    base = Path(args.base).expanduser().resolve()
    if not base.exists():
        print(f"ERROR: Base folder does not exist: {base}")
        return 1
    if base.is_file():
        base = base.parent

    input_dir = find_best_input(base)
    if not input_dir:
        print("ERROR: Could not find raw APK files nearby.")
        for name in CORE_FILES:
            print(f"  - {name}")
        print(f"Starting from: {base}")
        return 1

    repo_root = find_repo_root(Path(__file__).resolve().parent) or find_repo_root(base)

    if repo_root:
        builder = repo_root / SCRIPT_RELATIVE
        # IMPORTANT: data-loader.js reads apkfiles/entries, not apkfiles/generated_entries.
        output_dir = Path(args.output).expanduser().resolve() if args.output else repo_root / "apkfiles" / "entries"
    else:
        possible_builder = Path(__file__).resolve().parent / "build_apk_entry_folders.py"
        if not possible_builder.is_file():
            print("ERROR: Could not find build_apk_entry_folders.py.")
            return 1
        builder = possible_builder
        output_dir = Path(args.output).expanduser().resolve() if args.output else input_dir / "entries"

    command = [sys.executable, str(builder), "--input", str(input_dir), "--output", str(output_dir)]
    if args.force:
        command.append("--force")
    if args.category:
        command.extend(["--category", args.category])
    if args.limit is not None:
        command.extend(["--limit", str(args.limit)])
    if args.start_after:
        command.extend(["--start-after", args.start_after])

    print("Detected raw input folder:", input_dir)
    print("Output folder:", output_dir)
    print("Running builder:", builder)
    print()
    return subprocess.call(command)


if __name__ == "__main__":
    raise SystemExit(main())
