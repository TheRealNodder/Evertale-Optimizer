#!/usr/bin/env python3
"""
Universal launcher for the Evertale APK entry builder.

Strict extraction contract:
- Raw game JSON files are read from the repo apkfiles folder only unless --base is explicitly passed.
- Generated site/runtime data is written to apkfiles/entries.
- This script does not scan unrelated folders or guess alternate raw locations.
- Character family rarity is resolved through the base-form rarity wrapper.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Dict, List

from path_utils import find_repo_root, resolve_repo_path

CORE_FILES = ("Monster.json", "Weapon.json", "Equipment.json", "Boss.json")
SCRIPT_RELATIVE = Path("tools/new_structure/build_apk_entry_folders_base_rarity.py")
DEFAULT_RAW_RELATIVE = Path("apkfiles")
DEFAULT_OUTPUT_RELATIVE = Path("apkfiles/entries")


def raw_file_status(folder: Path) -> Dict[str, bool]:
    return {name: (folder / name).is_file() for name in CORE_FILES}


def print_raw_diagnostics(folder: Path) -> None:
    print("Raw APK input folder:", folder)
    print("Raw APK folder exists:", folder.exists())
    if folder.exists():
        try:
            print("Raw APK folder file preview:")
            for path in sorted(folder.iterdir(), key=lambda p: p.name.lower())[:80]:
                kind = "dir " if path.is_dir() else "file"
                print(f"  - {kind} {path.name}")
        except Exception as exc:
            print("Could not list raw APK folder:", exc)
    print("Core raw file status:")
    for name, exists in raw_file_status(folder).items():
        print(f"  - {name}: {'FOUND' if exists else 'MISSING'}")


def has_all_core_files(folder: Path) -> bool:
    return all(raw_file_status(folder).values())


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the Evertale entry builder from the repo apkfiles folder.")
    parser.add_argument("--base", default=None, help="Raw APK folder. Default and expected value: repo apkfiles folder.")
    parser.add_argument("--output", default=None, help="Optional output folder override. Default: repo apkfiles/entries.")
    parser.add_argument("--force", action="store_true", help="Force rebuild all entries.")
    parser.add_argument("--category", choices=["characters", "weapons", "accessories", "bosses"], default=None)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--start-after", default=None)
    parser.add_argument("--no-resume", action="store_true", help="Ignore partial extraction markers and start from the beginning.")
    args = parser.parse_args()

    repo_root = find_repo_root(Path(__file__).resolve())
    input_dir = resolve_repo_path(repo_root, args.base, DEFAULT_RAW_RELATIVE)
    output_dir = resolve_repo_path(repo_root, args.output, DEFAULT_OUTPUT_RELATIVE)

    if input_dir.is_file():
        input_dir = input_dir.parent

    print_raw_diagnostics(input_dir)

    if not input_dir.exists():
        print(f"ERROR: Raw APK folder does not exist: {input_dir}")
        print("Expected raw files directly inside repo apkfiles folder.")
        return 1

    if not has_all_core_files(input_dir):
        missing: List[str] = [name for name, exists in raw_file_status(input_dir).items() if not exists]
        print("ERROR: Missing required raw APK files directly inside the raw input folder.")
        print("Required files must be placed directly in:", input_dir)
        for name in missing:
            print(f"  - missing: {name}")
        print("No fallback folder scan was performed. This is intentional so extraction always comes from apkfiles only.")
        return 1

    builder = repo_root / SCRIPT_RELATIVE
    if not builder.is_file():
        print(f"ERROR: Builder script does not exist: {builder}")
        return 1

    output_dir.mkdir(parents=True, exist_ok=True)

    command = [sys.executable, str(builder), "--input", str(input_dir), "--output", str(output_dir)]
    if args.force:
        command.append("--force")
    if args.category:
        command.extend(["--category", args.category])
    if args.limit is not None:
        command.extend(["--limit", str(args.limit)])
    if args.start_after:
        command.extend(["--start-after", args.start_after])
    if args.no_resume:
        command.append("--no-resume")

    print("Detected raw input folder:", input_dir)
    print("Output folder:", output_dir)
    print("Running builder:", builder)
    print("Command:", " ".join(command))
    print()
    return subprocess.call(command, cwd=str(repo_root))


if __name__ == "__main__":
    raise SystemExit(main())
