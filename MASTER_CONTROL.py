#!/usr/bin/env python3
"""Universal repo-root launcher for the canonical Master Control."""
from __future__ import annotations

import runpy
import sys
from pathlib import Path


def main() -> None:
    implementation = Path(__file__).resolve().parent / "tools" / "new_structure" / "MASTER_CONTROL.py"
    if not implementation.exists():
        raise FileNotFoundError(f"Missing Master Control implementation: {implementation}")
    sys.path.insert(0, str(implementation.parent))
    runpy.run_path(str(implementation), run_name="__main__")


if __name__ == "__main__":
    main()
