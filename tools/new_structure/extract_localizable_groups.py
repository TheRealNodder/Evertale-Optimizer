#!/usr/bin/env python3
"""
Extract Localizable_English.txt into grouped, searchable runtime maps.

Purpose:
- Do NOT rebuild all APK entries.
- Read only Localizable_English.txt.
- Group keys by internal data prefix.
- Detect likely category by matching known entry indexes.
- Write grouped localization files that can be joined into weapons/accessories/bosses/characters later.

Run from repo root:
  python tools/new_structure/extract_localizable_groups.py --input apkfiles --entries apkfiles/entries --output apkfiles/entries/localization

Outputs:
  apkfiles/entries/localization/localizable_groups.json
  apkfiles/entries/localization/localizable_groups_by_category.json
  apkfiles/entries/localization/localizable_group_report.json
"""
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

KEY_RE = re.compile(r'^"(?P<key>.*?)"="(?P<value>.*)"$')
KNOWN_SUFFIXES = [
    "SecondNameKey",
    "DescriptionKey",
    "NameKey",
    "TitleKey",
    "SubTitleKey",
    "ProfileKey",
    "SelectedKey",
    "IntroText",
    "CatchIntroText",
    "MessageKey",
    "TitleMessageKey",
]
CATEGORY_ORDER = ["characters", "weapons", "accessories", "bosses", "unknown"]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def find_localizable(input_dir: Path) -> Path:
    candidates = [input_dir / "Localizable_English.txt", input_dir / "Localizable_English"]
    for path in candidates:
        if path.exists() and path.is_file():
            return path
    for path in input_dir.rglob("*"):
        if path.is_file() and path.name.lower() in {"localizable_english.txt", "localizable_english"}:
            return path
    raise FileNotFoundError(f"Could not find Localizable_English in {input_dir}")


def parse_localizable(path: Path) -> Dict[str, str]:
    rows: Dict[str, str] = {}
    for line in read_text(path).splitlines():
        match = KEY_RE.match(line)
        if not match:
            continue
        key = match.group("key")
        value = match.group("value").replace('\\n', '\n').replace('\\"', '"')
        rows[key] = value
    return rows


def split_key(key: str) -> Tuple[str, str]:
    for suffix in sorted(KNOWN_SUFFIXES, key=len, reverse=True):
        if key.endswith(suffix):
            return key[: -len(suffix)], suffix
    match = re.match(r"^(.*?)([A-Z][A-Za-z0-9]*Key)$", key)
    if match:
        return match.group(1), match.group(2)
    return key, "value"


def load_index_source_ids(entries_root: Path, category: str) -> Set[str]:
    out: Set[str] = set()
    index_path = entries_root / category / "index.json"
    if index_path.exists():
        try:
            index = json.loads(read_text(index_path))
            for row in index.get("entries", []):
                sid = row.get("sourceId") or row.get("family")
                if sid:
                    out.add(str(sid))
        except Exception:
            pass
    if category == "characters":
        fam_index = entries_root / "characters" / "families" / "index.json"
        if fam_index.exists():
            try:
                index = json.loads(read_text(fam_index))
                for row in index.get("entries", []):
                    fam = row.get("family")
                    if fam:
                        out.add(str(fam))
                        out.add(f"{fam}01")
                        out.add(f"{fam}02")
                        out.add(f"{fam}03")
            except Exception:
                pass
    return out


def category_from_base(base: str, known: Dict[str, Set[str]]) -> str:
    if base in known["characters"]:
        return "characters"
    if base in known["weapons"]:
        return "weapons"
    if base in known["accessories"]:
        return "accessories"
    if base in known["bosses"]:
        return "bosses"
    family = re.sub(r"\d+$", "", base)
    if family and family in known["characters"]:
        return "characters"
    if "Boss" in base or base.endswith("Boss"):
        return "bosses"
    if re.search(r"(Sword|Axe|Staff|Mace|Spear|Lance|Bow|Gun|Dagger|Katana|Greatsword|Hammer)", base):
        return "weapons"
    if re.search(r"(Ring|Charm|Armor|Amulet|Pendant|Earring|Crown|Helm|Boot|Bracelet|Necklace|Accessory)", base):
        return "accessories"
    return "unknown"


def group_rows(rows: Dict[str, str], known: Dict[str, Set[str]]) -> Dict[str, Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    for key, value in rows.items():
        base, suffix = split_key(key)
        group = grouped.setdefault(base, {
            "base": base,
            "category": category_from_base(base, known),
            "keys": {},
            "rawKeys": [],
        })
        group["keys"][suffix] = value
        group["rawKeys"].append(key)
    for group in grouped.values():
        keys = group["keys"]
        group["name"] = keys.get("NameKey", "")
        group["secondName"] = keys.get("SecondNameKey", "")
        group["title"] = keys.get("TitleKey", "") or keys.get("SecondNameKey", "")
        group["subtitle"] = keys.get("SubTitleKey", "")
        group["description"] = keys.get("DescriptionKey", "")
        group["profile"] = keys.get("ProfileKey", "")
        group["selected"] = keys.get("SelectedKey", "")
        group["keyCount"] = len(group["rawKeys"])
    return grouped


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="apkfiles")
    parser.add_argument("--entries", default="apkfiles/entries")
    parser.add_argument("--output", default="apkfiles/entries/localization")
    args = parser.parse_args()

    input_dir = Path(args.input).resolve()
    entries_root = Path(args.entries).resolve()
    output_dir = Path(args.output).resolve()
    loc_path = find_localizable(input_dir)
    rows = parse_localizable(loc_path)
    known = {cat: load_index_source_ids(entries_root, cat) for cat in ["characters", "weapons", "accessories", "bosses"]}
    grouped = group_rows(rows, known)

    by_category = {cat: [] for cat in CATEGORY_ORDER}
    for base in sorted(grouped):
        group = grouped[base]
        by_category.setdefault(group["category"], []).append(group)

    report = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "source": str(loc_path),
        "totalLocalizedKeys": len(rows),
        "totalGroups": len(grouped),
        "knownSourceIds": {cat: len(ids) for cat, ids in known.items()},
        "categoryCounts": {cat: len(by_category.get(cat, [])) for cat in CATEGORY_ORDER},
        "sampleGroups": {
            cat: by_category.get(cat, [])[:10] for cat in CATEGORY_ORDER
        },
    }

    write_json(output_dir / "localizable_groups.json", {
        "schemaVersion": 1,
        "count": len(grouped),
        "groups": grouped,
    })
    write_json(output_dir / "localizable_groups_by_category.json", {
        "schemaVersion": 1,
        "categories": by_category,
    })
    write_json(output_dir / "localizable_group_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
