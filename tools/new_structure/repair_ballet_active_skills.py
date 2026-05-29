#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

ROOT_MARKERS = ["apkfiles", "tools"]
TARGET_FAMILIES = ["LudmillaBallet", "YandereMaidBallet"]

SKILL_ALIAS = {
    "QuickSingleAttackAYandereMaidBallet": "QuickSingleAttackALudmillaBallet",
    "SingleAttackAYandereMaidBallet": "SingleAttackALudmillaBallet",
    "BigSingleAttackAYandereMaidBallet": "BigSingleAttackALudmillaBallet",
    "AllyBuffAYandereMaidBallet": "AllyBuffALudmillaBallet",
}


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root")


def load_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def source_id(entry: Dict[str, Any], fallback: str = "") -> str:
    internal = entry.get("internal") if isinstance(entry.get("internal"), dict) else {}
    return str(internal.get("sourceId") or entry.get("sourceId") or fallback).strip()


def family(entry: Dict[str, Any], fallback: str = "") -> str:
    internal = entry.get("internal") if isinstance(entry.get("internal"), dict) else {}
    return str(internal.get("family") or entry.get("family") or fallback).strip()


def order_from_entry(entry: Dict[str, Any], path: Path) -> int:
    try:
        return int(entry.get("order") or 0)
    except Exception:
        pass
    prefix = path.name.split("_", 1)[0]
    return int(prefix) if prefix.isdigit() else 0


def active_skill_detail(entry: Dict[str, Any], skill_id: str) -> Dict[str, Any] | None:
    resolved = entry.get("resolved") if isinstance(entry.get("resolved"), dict) else {}
    active = resolved.get("activeSkills") if isinstance(resolved.get("activeSkills"), dict) else {}
    detail = active.get(skill_id)
    return detail if isinstance(detail, dict) else None


def repair_alias_localization(entries: List[tuple[Path, Dict[str, Any]]]) -> List[Dict[str, str]]:
    by_skill: Dict[str, Dict[str, Any]] = {}
    for _path, entry in entries:
        resolved = entry.get("resolved") if isinstance(entry.get("resolved"), dict) else {}
        active = resolved.get("activeSkills") if isinstance(resolved.get("activeSkills"), dict) else {}
        for skill_id, detail in active.items():
            if isinstance(detail, dict):
                by_skill[str(skill_id)] = detail

    changes: List[Dict[str, str]] = []
    for path, entry in entries:
        changed = False
        resolved = entry.setdefault("resolved", {})
        active = resolved.setdefault("activeSkills", {})
        if not isinstance(active, dict):
            continue

        for target_id, source_id in SKILL_ALIAS.items():
            if target_id not in active or source_id not in by_skill:
                continue

            target = active[target_id]
            source = by_skill[source_id]
            if not isinstance(target, dict) or not isinstance(source, dict):
                continue

            target_loc = target.get("localization") if isinstance(target.get("localization"), dict) else {}
            source_loc = source.get("localization") if isinstance(source.get("localization"), dict) else {}

            # The extracted raw data has the Yandere/Clarice ability configs, but some
            # localizable keys are absent. Preserve target ability/config objects and
            # only borrow the human-readable text from the matching Ludmilla skill.
            if source_loc and (
                not target_loc
                or target_loc.get("name") in ("", None, target_id)
                or str(target_loc.get("name", "")).startswith(target_id)
            ):
                target["localization"] = dict(source_loc)
                target["localizationSource"] = source_id
                changed = True
                changes.append({"file": path.name, "skill": target_id, "localizedFrom": source_id})

        if changed:
            write_json(path, entry)

    return changes


def repair_family_files(repo: Path, entries: List[tuple[Path, Dict[str, Any]]]) -> List[Dict[str, Any]]:
    entries_root = repo / "apkfiles" / "entries"
    family_dir = entries_root / "characters" / "families"
    reports: List[Dict[str, Any]] = []

    by_family: Dict[str, List[tuple[Path, Dict[str, Any]]]] = {}
    for path, entry in entries:
        fam = family(entry)
        by_family.setdefault(fam, []).append((path, entry))

    for fam in TARGET_FAMILIES:
        rows = sorted(by_family.get(fam, []), key=lambda x: (source_id(x[1], x[0].stem), order_from_entry(x[1], x[0])))
        if not rows:
            continue

        fam_path = family_dir / f"{fam}.json"
        fam_json = load_json(fam_path, {}) or {}
        max_order = max(order_from_entry(entry, path) for path, entry in rows)
        fam_json["order"] = max_order
        fam_json["family"] = fam
        fam_json["name"] = fam_json.get("name") or rows[-1][1].get("name") or fam
        fam_json["title"] = fam_json.get("title") or rows[-1][1].get("title", "")
        fam_json["rarity"] = fam_json.get("rarity") or rows[-1][1].get("rarity") or "SSR"

        existing_states = fam_json.get("states") if isinstance(fam_json.get("states"), list) else []
        existing_by_source = {str(s.get("sourceId")): s for s in existing_states if isinstance(s, dict)}

        states: List[Dict[str, Any]] = []
        state_names = ["base", "evolved"]
        for idx, (path, entry) in enumerate(rows):
            sid = source_id(entry, path.stem.split("_", 1)[-1])
            old = existing_by_source.get(sid, {})
            states.append({
                "state": old.get("state") or (state_names[idx] if idx < len(state_names) else f"form{idx+1}"),
                "stars": old.get("stars") or entry.get("stars") or entry.get("evolvedStars"),
                "sourceId": sid,
                "dataSourceId": sid,
                "image": old.get("image") or entry.get("image") or f"https://ik.imagekit.io/r8fsa98s9/characters/{sid}.png",
                "name": entry.get("name") or fam_json.get("name") or "",
                "title": entry.get("title") or fam_json.get("title") or "",
                "description": entry.get("description") or old.get("description") or "",
                "hasRawForm": True,
            })

        # Keep final-art-only state if the image exists in the expected CDN naming pattern,
        # but pin its dataSourceId to the highest raw form so active skills/passives come
        # from the real extracted entry instead of an empty image-only placeholder.
        if fam_json.get("rarity", "").upper() == "SSR":
            final_sid = f"{fam}03"
            if final_sid not in {s["sourceId"] for s in states}:
                highest_sid = source_id(rows[-1][1], rows[-1][0].stem.split("_", 1)[-1])
                old = existing_by_source.get(final_sid, {})
                states.append({
                    "state": "final",
                    "stars": 6,
                    "sourceId": final_sid,
                    "dataSourceId": highest_sid,
                    "image": old.get("image") or f"https://ik.imagekit.io/r8fsa98s9/characters/{final_sid}.png",
                    "name": old.get("name") or rows[-1][1].get("name") or fam_json.get("name") or "",
                    "title": old.get("title") or rows[-1][1].get("title") or fam_json.get("title") or "",
                    "description": old.get("description") or rows[-1][1].get("description") or "",
                    "hasRawForm": False,
                })

        fam_json["states"] = states
        fam_json.setdefault("_build", {})
        fam_json["_build"]["repairedBy"] = "repair_ballet_active_skills.py"
        fam_json["_build"]["repairedAt"] = int(time.time())
        write_json(fam_path, fam_json)
        reports.append({"family": fam, "order": max_order, "states": len(states), "file": str(fam_path)})

    # Repair character family index order for the target families.
    index_path = family_dir / "index.json"
    index = load_json(index_path, {"entries": []}) or {"entries": []}
    for row in index.get("entries", []):
        if row.get("family") in TARGET_FAMILIES:
            fam = row["family"]
            fam_rows = by_family.get(fam, [])
            if fam_rows:
                row["order"] = max(order_from_entry(entry, path) for path, entry in fam_rows)
                row["states"] = len(load_json(family_dir / f"{fam}.json", {}).get("states", []))
    index["entries"] = sorted(index.get("entries", []), key=lambda row: int(row.get("order") or 0))
    index["count"] = len(index["entries"])
    index["orderSource"] = "raw entry numeric file handles + repair_ballet_active_skills.py"
    index["orderGeneratedAt"] = int(time.time())
    write_json(index_path, index)

    return reports


def run_tool(repo: Path, script_name: str) -> int:
    script = repo / "tools" / "new_structure" / script_name
    result = subprocess.run([sys.executable, str(script)], cwd=str(repo), text=True, capture_output=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode


def main() -> int:
    repo = find_repo_root(Path.cwd())
    entries_dir = repo / "apkfiles" / "entries" / "characters" / "entries"
    loaded: List[tuple[Path, Dict[str, Any]]] = []
    for path in sorted(entries_dir.glob("*.json")):
        entry = load_json(path)
        if isinstance(entry, dict) and family(entry) in TARGET_FAMILIES:
            loaded.append((path, entry))

    localization_changes = repair_alias_localization(loaded)
    # reload after writes
    loaded = [(path, load_json(path)) for path, _entry in loaded]
    family_reports = repair_family_files(repo, loaded)

    # Use the existing new_structure generators after repairing source data.
    ran = {}
    for script in ["sync_category_order_canonical.py", "build_character_image_map.py", "sync_character_tags.py", "build_entry_bundles.py", "validate_entries.py"]:
        ran[script] = run_tool(repo, script)

    report = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "targetFamilies": TARGET_FAMILIES,
        "localizedSkillAliases": localization_changes,
        "familyReports": family_reports,
        "toolReturnCodes": ran,
    }
    report_path = repo / "apkfiles" / "entries" / "reports" / "ballet_active_skill_repair_report.json"
    write_json(report_path, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if all(code == 0 for code in ran.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
