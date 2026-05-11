#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List

ROOT_MARKERS = ["apkfiles", "tools"]
RAW_ROOT_REL = "apkfiles"
REPORT_REL = "apkfiles/entries/reports/optimizer_source_audit.json"

VIABLE_HINTS = [
    "monster", "weapon", "equipment", "boss", "skill", "ability", "passive", "leader",
    "ai", "threat", "scal", "target", "condition", "effect", "status", "summon"
]

CORE_FILES = {
    "Monster.json": "character base records, stats, element, rarity, skill references, summon links",
    "Weapon.json": "weapon records, stats, type, passives/effects",
    "Equipment.json": "accessory/equipment records, stats, effects",
    "Boss.json": "boss versions, boss stats, boss skills/AI variants",
    "AIThreat.json": "AI targeting threat values and priority hints",
}

FIELD_HINTS = {
    "skills": ["skill", "ability", "active", "passive", "leader"],
    "ai": ["ai", "threat", "priority", "condition", "target"],
    "scalers": ["scale", "scaler", "attack", "damage", "multiplier", "rate"],
    "status": ["burn", "poison", "sleep", "stun", "stealth", "enrage", "guardian", "ward"],
    "summons": ["summon", "minion", "spawn"],
}


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root")


def load_json_safe(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return None


def flatten_keys(obj: Any, limit: int = 25000) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    seen = 0

    def walk(x: Any):
        nonlocal seen
        if seen >= limit:
            return
        seen += 1
        if isinstance(x, dict):
            for k, v in x.items():
                ks = str(k)
                counts[ks] = counts.get(ks, 0) + 1
                walk(v)
        elif isinstance(x, list):
            for v in x[:5000]:
                walk(v)

    walk(obj)
    return counts


def sample_records(obj: Any, max_samples: int = 3) -> List[Any]:
    if isinstance(obj, list):
        return obj[:max_samples]
    if isinstance(obj, dict):
        for key in ("items", "entries", "data", "records", "list"):
            if isinstance(obj.get(key), list):
                return obj[key][:max_samples]
        return [dict(list(obj.items())[:20])]
    return []


def classify_file(path: Path, raw_root: Path) -> Dict[str, Any]:
    rel = path.relative_to(raw_root).as_posix()
    name = path.name
    lower = rel.lower()
    data = load_json_safe(path)
    size = path.stat().st_size

    keys = flatten_keys(data) if data is not None else {}
    key_text = " ".join(keys.keys()).lower()
    name_text = lower + " " + key_text

    category_hits = {}
    for category, hints in FIELD_HINTS.items():
        hits = sorted({h for h in hints if h in name_text})
        if hits:
            category_hits[category] = hits

    viable = name in CORE_FILES or any(h in lower for h in VIABLE_HINTS) or bool(category_hits)

    top_keys = sorted(keys.items(), key=lambda kv: (-kv[1], kv[0]))[:40]
    shape = "unknown"
    count = None
    if isinstance(data, list):
        shape = "list"
        count = len(data)
    elif isinstance(data, dict):
        shape = "object"
        count = len(data)
        for k in ("items", "entries", "data", "records", "list"):
            if isinstance(data.get(k), list):
                shape = f"object.{k}[]"
                count = len(data[k])
                break

    return {
        "path": f"apkfiles/{rel}",
        "file": name,
        "sizeBytes": size,
        "shape": shape,
        "count": count,
        "corePurpose": CORE_FILES.get(name, ""),
        "viableForOptimizer": viable,
        "categoryHits": category_hits,
        "topKeys": [{"key": k, "count": c} for k, c in top_keys],
        "samples": sample_records(data, 2) if viable else [],
    }


def main() -> int:
    repo = find_repo_root(Path.cwd())
    raw_root = repo / RAW_ROOT_REL
    files = sorted([p for p in raw_root.rglob("*.json") if "entries" not in p.parts and p.is_file()])

    classified = [classify_file(p, raw_root) for p in files]
    viable = [r for r in classified if r["viableForOptimizer"]]

    report = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "rawRoot": str(raw_root),
        "totalJsonFilesScanned": len(classified),
        "viableOptimizerSourceCount": len(viable),
        "coreFilesExpected": CORE_FILES,
        "coreFilesFound": [f"apkfiles/{name}" for name in CORE_FILES if (raw_root / name).exists()],
        "viableSources": viable,
        "allJsonFiles": [{k: v for k, v in r.items() if k != "samples"} for r in classified],
        "recommendedNextTools": [
            "extract_optimizer_knowledge.py",
            "build_optimizer_runtime_model.py",
            "validate_optimizer_runtime_model.py"
        ]
    }

    out = repo / REPORT_REL
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "ok",
        "totalJsonFilesScanned": len(classified),
        "viableOptimizerSourceCount": len(viable),
        "report": str(out),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
