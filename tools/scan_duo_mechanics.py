#!/usr/bin/env python3
"""
scan_duo_mechanics.py

Scans APK character entry JSON files for multi-entry mechanics:
- summon
- switch
- transform
- replace
- revive
- exchange
- clone
- imposter
- reinforcement

The scanner is intentionally conservative:
- It records every mechanic keyword hit for audit/debugging.
- It extracts concrete child/unit targets from common resolved config fields and refs.
- It outputs a verified data file that can be used by UI/runtime code without depending on broad generic helper links.

Usage:
  python tools/scan_duo_mechanics.py
  python tools/scan_duo_mechanics.py --root . --write
"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

MECHANIC_WORDS = [
    "summon",
    "summoned",
    "summons",
    "switch",
    "switches",
    "switched",
    "transform",
    "transforms",
    "transformed",
    "replace",
    "replaces",
    "replaced",
    "revive",
    "revives",
    "revived",
    "exchange",
    "exchanges",
    "clone",
    "clones",
    "duplicate",
    "duplicates",
    "imposter",
    "reinforcement",
    "reinforcements",
]

TARGET_KEY_HINTS = [
    "monster",
    "monsters",
    "summon",
    "summons",
    "summoned",
    "spawn",
    "spawned",
    "replace",
    "replacement",
    "switch",
    "transform",
    "transformed",
    "exchange",
    "clone",
    "duplicate",
    "imposter",
    "reinforcement",
]

SOURCE_ID_RE = re.compile(r"^[A-Za-z][A-Za-z0-9]+\d{2,3}$")


def strip_form_suffix(value: str) -> str:
    return re.sub(r"\d+$", "", value or "")


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def walk(obj: Any, path: str = "") -> Iterable[Tuple[str, Any]]:
    yield path, obj
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk(v, f"{path}.{k}" if path else str(k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk(v, f"{path}[{i}]")


def text_blob(obj: Any) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False).lower()
    except TypeError:
        return str(obj).lower()


def mechanic_hits(obj: Any) -> List[str]:
    blob = text_blob(obj)
    return sorted({w for w in MECHANIC_WORDS if w in blob})


def looks_like_source_id(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    return bool(SOURCE_ID_RE.match(value.strip()))


def key_has_target_hint(path: str) -> bool:
    p = path.lower()
    return any(h in p for h in TARGET_KEY_HINTS)


def collect_targets(obj: Any) -> Set[str]:
    targets: Set[str] = set()
    for path, value in walk(obj):
        if not key_has_target_hint(path):
            continue
        if looks_like_source_id(value):
            targets.add(str(value).strip())
        elif isinstance(value, list):
            for item in value:
                if looks_like_source_id(item):
                    targets.add(str(item).strip())
                elif isinstance(item, dict):
                    for _, nested in walk(item):
                        if looks_like_source_id(nested):
                            targets.add(str(nested).strip())
        elif isinstance(value, dict):
            for _, nested in walk(value):
                if looks_like_source_id(nested):
                    targets.add(str(nested).strip())
    return targets


def entry_source_id(entry: Dict[str, Any], fallback_file: str) -> str:
    internal = entry.get("internal") if isinstance(entry.get("internal"), dict) else {}
    raw = entry.get("raw") if isinstance(entry.get("raw"), dict) else {}
    for candidate in [internal.get("sourceId"), raw.get("sourceId"), entry.get("sourceId"), entry.get("name")]:
        if isinstance(candidate, str) and SOURCE_ID_RE.match(candidate):
            return candidate
    m = re.search(r"_([A-Za-z][A-Za-z0-9]+\d{2,3})\.json$", fallback_file)
    if m:
        return m.group(1)
    return str(entry.get("id") or fallback_file.replace(".json", ""))


def active_skill_records(entry: Dict[str, Any]) -> List[Tuple[str, Dict[str, Any]]]:
    resolved = entry.get("resolved") if isinstance(entry.get("resolved"), dict) else {}
    active = resolved.get("activeSkills") if isinstance(resolved.get("activeSkills"), dict) else {}
    records: List[Tuple[str, Dict[str, Any]]] = []
    for skill_id, detail in active.items():
        if isinstance(detail, dict):
            records.append((str(skill_id), detail))
    return records


def display_skill_name(detail: Dict[str, Any], fallback: str) -> str:
    loc = detail.get("localization") if isinstance(detail.get("localization"), dict) else {}
    return str(loc.get("name") or detail.get("name") or fallback)


def display_skill_description(detail: Dict[str, Any]) -> str:
    loc = detail.get("localization") if isinstance(detail.get("localization"), dict) else {}
    return str(loc.get("description") or detail.get("description") or "")


def classify_targets(hits: List[str], targets: Set[str]) -> str:
    hitset = set(hits)
    if not targets:
        return "mechanic_no_target"
    if hitset & {"switch", "switches", "switched", "exchange", "exchanges", "replace", "replaces", "replaced"}:
        return "switch_replace_exchange"
    if hitset & {"transform", "transforms", "transformed"}:
        return "transform"
    if hitset & {"clone", "clones", "duplicate", "duplicates", "imposter"}:
        return "clone_imposter"
    if hitset & {"revive", "revives", "revived", "reinforcement", "reinforcements"}:
        return "revive_reinforcement"
    if hitset & {"summon", "summoned", "summons"}:
        return "summon"
    return "linked_target"


def scan(root: Path) -> Dict[str, Any]:
    entries_dir = root / "apkfiles" / "entries" / "characters" / "entries"
    files = sorted(entries_dir.glob("*.json"))
    parent_to_children: Dict[str, Set[str]] = defaultdict(set)
    skill_records: List[Dict[str, Any]] = []
    mechanic_units: Set[str] = set()
    target_units: Set[str] = set()

    for path in files:
        try:
            entry = load_json(path)
        except Exception as exc:
            skill_records.append({"file": str(path), "error": str(exc)})
            continue
        if not isinstance(entry, dict):
            continue

        parent = entry_source_id(entry, path.name)
        entry_mechanic_hits = mechanic_hits(entry)
        if entry_mechanic_hits:
            mechanic_units.add(parent)

        # Scan active skills first; these are the source of truth for actual mechanics.
        for skill_id, detail in active_skill_records(entry):
            hits = mechanic_hits(detail)
            if not hits:
                continue
            targets = collect_targets(detail)
            for target in targets:
                if target != parent:
                    parent_to_children[parent].add(target)
                    target_units.add(target)
            skill_records.append({
                "parentSourceId": parent,
                "parentFamily": strip_form_suffix(parent),
                "file": str(path.relative_to(root)).replace("\\", "/"),
                "skillId": skill_id,
                "skillName": display_skill_name(detail, skill_id),
                "description": display_skill_description(detail),
                "mechanicKeywords": hits,
                "targetSourceIds": sorted(targets),
                "mechanicType": classify_targets(hits, targets),
            })

        # Also keep refs.summonableMonsters as audit-only evidence.
        refs = entry.get("refs") if isinstance(entry.get("refs"), dict) else {}
        summonable = refs.get("summonableMonsters")
        if isinstance(summonable, list) and summonable:
            for target in summonable:
                if looks_like_source_id(target):
                    target_units.add(str(target))
            skill_records.append({
                "parentSourceId": parent,
                "parentFamily": strip_form_suffix(parent),
                "file": str(path.relative_to(root)).replace("\\", "/"),
                "skillId": "refs.summonableMonsters",
                "skillName": "refs.summonableMonsters",
                "description": "Audit-only broad summonableMonsters reference; do not use alone for UI merge.",
                "mechanicKeywords": ["summon"],
                "targetSourceIds": sorted(str(t) for t in summonable if looks_like_source_id(t)),
                "mechanicType": "audit_only_summonable_refs",
            })

    direct_specific_links = {k: sorted(v) for k, v in sorted(parent_to_children.items()) if v}
    by_family: Dict[str, Set[str]] = defaultdict(set)
    for parent, children in parent_to_children.items():
        by_family[strip_form_suffix(parent)].update(strip_form_suffix(c) for c in children)

    return {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "description": "Verified active-skill multi-entry mechanics scanned from apkfiles/entries/characters/entries. refs.summonableMonsters records are audit-only unless also present in active-skill targets.",
        "scan": {
            "entryFileCount": len(files),
            "mechanicSkillRecordCount": len([r for r in skill_records if not r.get("error")]),
            "mechanicUnitCount": len(mechanic_units),
            "directParentCount": len(direct_specific_links),
            "targetUnitCount": len(target_units),
        },
        "directSpecificLinks": direct_specific_links,
        "families": {k: sorted(v) for k, v in sorted(by_family.items()) if v},
        "skillRecords": skill_records,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan character entries for duo/summon/switch/transform mechanics.")
    parser.add_argument("--root", default=".", help="Repository root. Default: current directory.")
    parser.add_argument("--write", action="store_true", help="Write apkfiles/DuoActiveVerified.json and report file.")
    parser.add_argument("--output", default="apkfiles/DuoActiveVerified.json", help="Output JSON path when --write is used.")
    parser.add_argument("--report", default="apkfiles/entries/reports/duo_active_scan_report.json", help="Report JSON path when --write is used.")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    result = scan(root)

    if args.write:
        out = root / args.output
        report = root / args.report
        dump_json(out, result)
        dump_json(report, {
            "generatedAt": result["generatedAt"],
            "scan": result["scan"],
            "directParentCount": len(result["directSpecificLinks"]),
            "familiesWithLinks": len(result["families"]),
            "output": args.output,
        })
        print(f"Wrote {out.relative_to(root)}")
        print(f"Wrote {report.relative_to(root)}")
    else:
        print(json.dumps(result["scan"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
