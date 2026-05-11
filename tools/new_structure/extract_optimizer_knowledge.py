#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List

ROOT_MARKERS = ["apkfiles", "tools"]
RAW_ROOT_REL = "apkfiles"
OUT_REL = "apkfiles/entries/runtime/optimizer_knowledge.json"

KEY_PATTERNS = {
    "skill": re.compile(r"skill|ability|active|passive|leader", re.I),
    "ai": re.compile(r"ai|threat|priority|target|condition", re.I),
    "status": re.compile(r"burn|poison|sleep|stun|stealth|guardian|ward|rage", re.I),
    "scaler": re.compile(r"scale|damage|multiplier|attack|rate", re.I),
    "summon": re.compile(r"summon|spawn|minion", re.I),
}


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root")


def load_json_safe(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return None


def scan_obj(obj: Any, found: Dict[str, List[str]], prefix: str = ""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            path = f"{prefix}.{k}" if prefix else str(k)
            low = str(k).lower()
            for cat, pattern in KEY_PATTERNS.items():
                if pattern.search(low):
                    found.setdefault(cat, []).append(path)
            scan_obj(v, found, path)
    elif isinstance(obj, list):
        for idx, v in enumerate(obj[:50]):
            scan_obj(v, found, f"{prefix}[{idx}]")


def main() -> int:
    repo = find_repo_root(Path.cwd())
    raw_root = repo / RAW_ROOT_REL

    payload = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "sources": []
    }

    for path in sorted(raw_root.rglob("*.json")):
        if "entries" in path.parts:
            continue

        data = load_json_safe(path)
        if data is None:
            continue

        found: Dict[str, List[str]] = {}
        scan_obj(data, found)

        if not found:
            continue

        payload["sources"].append({
            "path": path.relative_to(repo).as_posix(),
            "categories": {
                k: sorted(set(v))[:250]
                for k, v in found.items()
            }
        })

    out = repo / OUT_REL
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": "ok",
        "sources": len(payload["sources"]),
        "output": str(out)
    }, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
