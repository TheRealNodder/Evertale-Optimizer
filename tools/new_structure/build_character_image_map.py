#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

IMAGE_BASE = "https://ik.imagekit.io/r8fsa98s9/characters"
STATE_ORDER = ["base", "evolved", "final"]
OVERRIDES_RELATIVE = "apkfiles/entries/maps/character_image_overrides.json"


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for folder in [current] + list(current.parents):
        if (folder / "apkfiles" / "entries").exists():
            return folder
    return current


def load_json(path: Path, fallback: Any = None) -> Any:
    try:
        with path.open("r", encoding="utf-8-sig") as f:
            return json.load(f)
    except FileNotFoundError:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
        newline="\n",
    )


def image_url(source_id: str, image_base: str) -> str:
    return f"{image_base.rstrip('/')}/{source_id}.png"


def default_states_for_family(family: str, rarity: str, image_base: str) -> List[Dict[str, Any]]:
    rarity = str(rarity or "").upper()
    if rarity == "SSR":
        rows = [("base", "01", 5), ("evolved", "02", 6), ("final", "03", 6)]
    elif rarity == "SR":
        rows = [("base", "01", 3), ("evolved", "02", 4)]
    else:
        rows = [("base", "01", 1)]
    return [
        {
            "state": state,
            "sourceId": f"{family}{suffix}",
            "file": f"{family}{suffix}.png",
            "url": image_url(f"{family}{suffix}", image_base),
            "stars": stars,
        }
        for state, suffix, stars in rows
    ]


def normalize_state(row: Dict[str, Any], family: str, image_base: str) -> Dict[str, Any]:
    source_id = str(row.get("sourceId") or row.get("imageSourceId") or row.get("dataSourceId") or "").strip()
    if not source_id:
        source_id = f"{family}01"
    url = str(row.get("image") or row.get("url") or "").strip() or image_url(source_id, image_base)
    file_name = str(row.get("file") or Path(url.split("?")[0]).name or f"{source_id}.png")
    return {
        "state": row.get("state") or "base",
        "sourceId": source_id,
        "dataSourceId": row.get("dataSourceId") or source_id,
        "file": file_name,
        "url": url,
        "stars": row.get("stars"),
        "title": row.get("title", ""),
        "description": row.get("description", ""),
    }


def build_from_family_file(path: Path, image_base: str) -> Optional[Dict[str, Any]]:
    fam = load_json(path)
    if not isinstance(fam, dict):
        return None
    family = str(fam.get("family") or fam.get("id") or path.stem).strip()
    if not family:
        return None
    rarity = str(fam.get("rarity") or "").upper()
    raw_states = fam.get("states") if isinstance(fam.get("states"), list) else []
    states = [normalize_state(row, family, image_base) for row in raw_states if isinstance(row, dict)]
    if not states:
        states = default_states_for_family(family, rarity, image_base)
    states.sort(key=lambda row: STATE_ORDER.index(row.get("state")) if row.get("state") in STATE_ORDER else 99)
    return {
        "family": family,
        "name": fam.get("name", ""),
        "rarity": rarity,
        "element": fam.get("element", ""),
        "states": states,
    }


def resolve_family_path(entries_root: Path, family_dir: Path, rel: str) -> Path:
    rel_path = Path(rel)
    candidates = []
    candidates.append(family_dir / rel_path)
    candidates.append(entries_root / "characters" / rel_path)
    candidates.append(entries_root / rel_path)
    if rel.startswith("families/"):
        candidates.append(family_dir / rel.split("/", 1)[1])
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def apply_overrides(repo_root: Path, payload: Dict[str, Any]) -> List[str]:
    overrides_path = repo_root / OVERRIDES_RELATIVE
    overrides = load_json(overrides_path, {}) or {}
    families = overrides.get("families") if isinstance(overrides, dict) else {}
    if not isinstance(families, dict):
        return []

    applied = []
    for family, override in families.items():
        if family not in payload:
            continue
        if not isinstance(override, dict):
            continue

        states = override.get("states")
        if isinstance(states, list) and states:
            payload[family]["states"] = states
            payload[family]["image"] = states[0].get("url")
            applied.append(family)

    return applied


def build_from_families(entries_root: Path, image_base: str) -> Dict[str, Any]:
    family_dir = entries_root / "characters" / "families"
    index = load_json(family_dir / "index.json", {}) or {}
    rows = index.get("entries") if isinstance(index, dict) else []
    result: Dict[str, Any] = {}
    missing: List[str] = []

    for row in rows or []:
        rel = str(row.get("file") or "").replace("\\", "/").lstrip("./")
        if not rel:
            continue
        path = resolve_family_path(entries_root, family_dir, rel)
        built = build_from_family_file(path, image_base)
        if built:
            result[built["family"]] = built
        else:
            missing.append(rel)

    return {
        "map": result,
        "missing": missing,
        "source": str(family_dir),
        "sourceCount": len(rows or []),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build explicit character image mapping from character family files.")
    parser.add_argument("--entries", default=None, help="Path to apkfiles/entries. Auto-detected when omitted.")
    parser.add_argument("--image-base", default=IMAGE_BASE, help="Base URL for character PNGs.")
    args = parser.parse_args()

    repo_root = find_repo_root(Path.cwd())
    entries_root = Path(args.entries).resolve() if args.entries else (repo_root / "apkfiles" / "entries").resolve()
    built = build_from_families(entries_root, args.image_base)

    applied_overrides = apply_overrides(repo_root, built["map"])

    payload = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "imageBase": args.image_base.rstrip("/"),
        "source": built["source"],
        "count": len(built["map"]),
        "families": built["map"],
    }

    report = {
        "schemaVersion": 1,
        "generatedAt": payload["generatedAt"],
        "entriesRoot": str(entries_root),
        "output": str(entries_root / "maps" / "character_image_map.json"),
        "count": payload["count"],
        "sourceCount": built["sourceCount"],
        "missingCount": len(built["missing"]),
        "missing": built["missing"],
        "appliedOverrides": applied_overrides,
    }

    write_json(entries_root / "maps" / "character_image_map.json", payload)
    write_json(entries_root / "reports" / "character_image_map_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
