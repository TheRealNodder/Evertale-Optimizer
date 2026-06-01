#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

IMAGE_BASE = "https://ik.imagekit.io/r8fsa98s9/characters"
STATE_ORDER = ["base", "evolved", "final"]
OVERRIDES_RELATIVE = "apkfiles/entries/maps/character_image_overrides.json"
EXCLUDED_PATH_PARTS = {"legacy", "Legacy", "_duplicate_quarantine", "_weapon_duplicate_quarantine", "_boss_duplicate_quarantine"}


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
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def image_url(source_id: str, image_base: str) -> str:
    return f"{image_base.rstrip('/')}/{source_id}.png"


def is_excluded_path(path: Path) -> bool:
    return path.name.startswith("_") or any(part in EXCLUDED_PATH_PARTS or part.startswith("_") for part in path.parts)


def default_states_for_family(family: str, rarity: str, image_base: str) -> List[Dict[str, Any]]:
    rarity = str(rarity or "").upper()
    if rarity == "SSR":
        rows = [("base", "01", 5), ("evolved", "02", 6), ("final", "03", 6)]
    elif rarity == "SR":
        rows = [("base", "01", 3), ("evolved", "02", 4)]
    else:
        rows = [("base", "01", 1)]
    return [{"state": state, "sourceId": f"{family}{suffix}", "dataSourceId": f"{family}{suffix}", "file": f"{family}{suffix}.png", "url": image_url(f"{family}{suffix}", image_base), "stars": stars, "title": "", "description": ""} for state, suffix, stars in rows]


def normalize_state(row: Dict[str, Any], family: str, image_base: str) -> Dict[str, Any]:
    source_id = str(row.get("sourceId") or row.get("imageSourceId") or row.get("dataSourceId") or "").strip() or f"{family}01"
    url = str(row.get("image") or row.get("url") or "").strip() or image_url(source_id, image_base)
    file_name = str(row.get("file") or Path(url.split("?")[0]).name or f"{source_id}.png")
    return {"state": row.get("state") or "base", "sourceId": source_id, "dataSourceId": row.get("dataSourceId") or source_id, "file": file_name, "url": url, "stars": row.get("stars"), "title": row.get("title", ""), "description": row.get("description", "")}


def build_from_family_file(path: Path, image_base: str) -> Optional[Dict[str, Any]]:
    if is_excluded_path(path):
        return None
    fam = load_json(path)
    if not isinstance(fam, dict):
        return None
    family = str(fam.get("family") or fam.get("id") or path.stem).strip()
    if not family:
        return None
    rarity = str(fam.get("rarity") or "").upper()
    raw_states = fam.get("states") if isinstance(fam.get("states"), list) else []
    states = [normalize_state(row, family, image_base) for row in raw_states if isinstance(row, dict)] or default_states_for_family(family, rarity, image_base)
    states.sort(key=lambda row: STATE_ORDER.index(row.get("state")) if row.get("state") in STATE_ORDER else 99)
    return {"family": family, "name": fam.get("name", ""), "rarity": rarity, "element": fam.get("element", ""), "states": states}


def resolve_family_path(entries_root: Path, family_dir: Path, rel: str) -> Path:
    rel = str(rel or "").replace("\\", "/").lstrip("./")
    rel_path = Path(rel)
    candidates = [family_dir / rel_path, entries_root / "characters" / rel_path, entries_root / rel_path]
    if rel.startswith("families/"):
        candidates.append(family_dir / rel.split("/", 1)[1])
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def safe_override_states(family: str, rarity: str, current_states: List[Dict[str, Any]], override_states: List[Dict[str, Any]]) -> Tuple[bool, str]:
    rarity = str(rarity or "").upper()
    if rarity == "SSR" and len(current_states or []) >= 3 and len(override_states or []) < 3:
        return False, "blocked_single_state_ssr_override"
    for state in override_states or []:
        source_id = str(state.get("sourceId") or "")
        file_name = str(state.get("file") or "")
        if rarity == "SSR" and source_id == family and file_name == f"{family}.png":
            return False, "blocked_unsuffixed_ssr_override"
    return True, "ok"


def apply_overrides(repo_root: Path, payload: Dict[str, Any]) -> Tuple[List[str], List[Dict[str, str]]]:
    overrides_path = repo_root / OVERRIDES_RELATIVE
    overrides = load_json(overrides_path, {}) or {}
    families = overrides.get("families") if isinstance(overrides, dict) else {}
    if not isinstance(families, dict):
        return [], []
    applied: List[str] = []
    blocked: List[Dict[str, str]] = []
    for family, override in families.items():
        if family not in payload or not isinstance(override, dict):
            continue
        states = override.get("states")
        if isinstance(states, list) and states:
            ok, reason = safe_override_states(family, str(payload[family].get("rarity") or ""), payload[family].get("states") or [], states)
            if not ok:
                blocked.append({"family": family, "reason": reason})
                continue
            payload[family]["states"] = states
            payload[family]["image"] = states[0].get("url")
            applied.append(family)
    return applied, blocked


def build_from_families(entries_root: Path, image_base: str) -> Dict[str, Any]:
    family_dir = entries_root / "characters" / "families"
    index = load_json(family_dir / "index.json", {}) or {}
    rows = index.get("entries") if isinstance(index, dict) else []
    rows = sorted(rows or [], key=lambda r: int(r.get("fileHandleOrder") or r.get("order") or r.get("sourceOrder") or 999999) if isinstance(r, dict) else 999999)
    result: Dict[str, Any] = {}
    missing: List[str] = []
    skipped: List[str] = []
    for row in rows:
        rel = str(row.get("file") or "").replace("\\", "/").lstrip("./")
        if not rel:
            continue
        path = resolve_family_path(entries_root, family_dir, rel)
        if is_excluded_path(path):
            skipped.append(rel)
            continue
        built = build_from_family_file(path, image_base)
        if built:
            result[built["family"]] = built
        else:
            missing.append(rel)
    return {"map": result, "missing": missing, "skipped": skipped, "source": str(family_dir), "sourceCount": len(rows or [])}


def write_marker(entries_root: Path, report: Dict[str, Any]) -> None:
    write_json(entries_root / "_markers" / "build_character_image_map.marker.json", {"schemaVersion": 1, "tool": "build_character_image_map", "category": "characters", "status": "complete", "lastKey": "character_image_map", "lastSourceId": "", "lastHandle": None, "lastFile": "apkfiles/entries/maps/character_image_map.json", "processedCount": report.get("count", 0), "totalCount": report.get("sourceCount", 0), "updatedAt": int(time.time()), "extra": {"report": "apkfiles/entries/reports/character_image_map_report.json", "missingCount": report.get("missingCount", 0), "skippedCount": report.get("skippedCount", 0)}})


def main() -> int:
    parser = argparse.ArgumentParser(description="Build explicit character image mapping from character family files.")
    parser.add_argument("--entries", default=None, help="Path to apkfiles/entries. Auto-detected when omitted.")
    parser.add_argument("--image-base", default=IMAGE_BASE, help="Base URL for character PNGs.")
    args = parser.parse_args()
    repo_root = find_repo_root(Path.cwd())
    entries_root = Path(args.entries).resolve() if args.entries else (repo_root / "apkfiles" / "entries").resolve()
    built = build_from_families(entries_root, args.image_base)
    applied_overrides, blocked_overrides = apply_overrides(repo_root, built["map"])
    payload = {"schemaVersion": 3, "generatedAt": int(time.time()), "imageBase": args.image_base.rstrip("/"), "source": built["source"], "count": len(built["map"]), "families": built["map"]}
    report = {"schemaVersion": 3, "generatedAt": payload["generatedAt"], "entriesRoot": str(entries_root), "output": str(entries_root / "maps" / "character_image_map.json"), "count": payload["count"], "sourceCount": built["sourceCount"], "missingCount": len(built["missing"]), "skippedCount": len(built["skipped"]), "missing": built["missing"], "skipped": built["skipped"], "appliedOverrides": applied_overrides, "blockedOverrides": blocked_overrides}
    write_json(entries_root / "maps" / "character_image_map.json", payload)
    write_json(entries_root / "reports" / "character_image_map_report.json", report)
    write_marker(entries_root, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
