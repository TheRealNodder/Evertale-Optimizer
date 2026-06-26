#!/usr/bin/env python3
"""Root launcher for the Evertale Master Control pipeline.

This file exists so local Windows runs and GitHub Actions can use:

    python MASTER_CONTROL.py
    python MASTER_CONTROL.py --extract --force

The real implementation stays in tools/new_structure/MASTER_CONTROL.py.
"""
from __future__ import annotations

import runpy
import sys
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parent
    tools_dir = repo_root / "tools" / "new_structure"
    target = tools_dir / "MASTER_CONTROL.py"

    if not target.is_file():
        print(f"ERROR: Missing Master Control implementation: {target}", file=sys.stderr)
        return 1

    sys.path.insert(0, str(tools_dir))
    sys.argv[0] = str(target)
    runpy.run_path(str(target), run_name="__main__")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
