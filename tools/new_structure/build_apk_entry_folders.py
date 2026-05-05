#!/usr/bin/env python3
"""
Build separate ordered APK entry files for the new Evertale Optimizer structure.

Run from repo root:

    python tools/new_structure/build_apk_entry_folders.py --input apkfiles --output apkfiles/generated_entries

Rules:
- Reads raw APK-style files only: Monster.json, Weapon.json, Equipment.json, Boss.json.
- Does not read old website data files.
- Creates one JSON file per entry.
- Creates one index.json per category.
- Preserves explicit order files when present.
- Appends raw entries not found in explicit order after the ordered list.
- Creates placeholders for ordered entries missing from raw files.
- Uses /characters/ HD image paths for bosses by removing Boss before the numeric suffix.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

IMAGEKIT_BASE = "https://ik.imagekit.io/r8fsa98s9"

RAW_FILE_CANDIDATES = {
    "characters": ["Monster.json", "Monsters.json"],
    "weapons": ["Weapon.json", "Weapons.json"],
    "accessories": ["Equipment.json", "Equipments.json", "Accessory.json", "Accessories.json"],
    "bosses": ["Boss.json", "Bosses.json"],
}

ORDER_FILE_CANDIDATES = {
    "characters": ["CatalogOrder/character_order.txt", "CatalogOrder/monster_order.txt", "character_order.txt", "monster_order.txt"],
    "weapons": ["CatalogOrder/weapon_order.txt", "weapon_order.txt"],
    "accessories": ["CatalogOrder/accessory_order.txt", "CatalogOrder/equipment_order.txt", "accessory_order.txt", "equipment_order.txt"],
    "bosses": ["CatalogOrder/boss_order.txt", "boss_order.txt"],
}

ROOT_KEYS = {
    "characters": ["Monster", "Monsters", "characters", "items"],
    "weapons": ["Weapon", "Weapons", "weapons", "items"],
    "accessories": ["Equipment", "Equipments", "Accessory", "Accessories", "accessories", "items"],
    "bosses": ["Monster", "Boss", "Bosses", "bosses", "items"],
}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def find_file(input_dir: Path, names: Iterable[str]) -> Optional[Path]:
    for name in names:
        direct = input_dir / name
        if direct.exists():
            return direct
    lowered = {Path(name).name.lower() for name in names}
    for path in input_dir.rglob("*"):
        if path.is_file() and path.name.lower() in lowered:
            return path
    return None


def extract_list(raw: Any, category: str) -> List[Dict[str, Any]]:
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, dict):
        for key in ROOT_KEYS[category]:
            value = raw.get(key)
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]
        dict_items = []
        for key, value in raw.items():
            if isinstance(value, dict):
                item = dict(value)
                item.setdefault("name", key)
                dict_items.append(item)
        if dict_items:
            return dict_items
    return []


def parse_order_line(line: str) -> Optional[Tuple[str, Optional[str]]]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    match = re.match(r"^([A-Za-z0-9_]+)\s*(?:\((.*?)\))?\s*$", line)
    if not match:
        return None
    internal_id = match.group(1).strip()
    display_name = match.group(2).strip() if match.group(2) else None
    return internal_id, display_name or None


def load_order(input_dir: Path, category: str) -> List[Tuple[str, Optional[str]]]:
    order_path = find_file(input_dir, ORDER_FILE_CANDIDATES[category])
    if not order_path:
        return []
    order: List[Tuple[str, Optional[str]]] = []
    for line in order_path.read_text(encoding="utf-8-sig").splitlines():
        parsed = parse_order_line(line)
        if parsed:
            order.append(parsed)
    return order


def get_internal_id(item: Dict[str, Any]) -> str:
    if isinstance(item.get("name"), str):
        return item["name"]
    internal = item.get("internal")
    if isinstance(internal, dict):
        for key in ("monsterId", "weaponId", "equipmentId", "bossId", "id"):
            if isinstance(internal.get(key), str):
                return internal[key]
    for key in ("id", "family"):
        if isinstance(item.get(key), str):
            return item[key]
    return "unknown"


def slugify(value: str) -> str:
    value = value.strip()
    value = re.sub(r"[^A-Za-z0-9_-]+", "-", value)
    value = re.sub(r"-+", "-", value)
    return value.strip("-") or "unknown"


def kebab_name(value: str) -> str:
    words = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?=[A-Z]|$)|\d+", value)
    if words:
        return "-".join(w.lower() for w in words)
    return slugify(value).lower()


def normalize_element(element: Any) -> Optional[str]:
    if not isinstance(element, str):
        return None
    mapping = {
        "Death": "Dark",
        "Life": "Light",
        "Air": "Storm",
        "Fire": "Fire",
        "Water": "Water",
        "Earth": "Earth",
        "Storm": "Storm",
        "Dark": "Dark",
        "Light": "Light",
    }
    return mapping.get(element, element)


def image_name_for_boss(internal_id: str) -> str:
    return re.sub(r"Boss(?=\d+$)", "", internal_id) + ".png"


def image_url(category: str, internal_id: str) -> str:
    if category == "characters":
        return f"{IMAGEKIT_BASE}/characters/{internal_id}.png"
    if category == "weapons":
        return f"{IMAGEKIT_BASE}/weapons/{internal_id}.png"
    if category == "accessories":
        return f"{IMAGEKIT_BASE}/accessories/{internal_id}.png"
    if category == "bosses":
        return f"{IMAGEKIT_BASE}/characters/{image_name_for_boss(internal_id)}"
    return ""


def ordered_values(value: Any) -> List[Any]:
    if isinstance(value, dict):
        return [value[k] for k in sorted(value.keys(), key=lambda x: int(x) if str(x).isdigit() else str(x))]
    if isinstance(value, list):
        return value
    return []


def make_placeholder(category: str, internal_id: str, display_name: Optional[str], order_index: int) -> Dict[str, Any]:
    name = display_name or internal_id
    return {
        "schemaVersion": 1,
        "order": order_index,
        "id": kebab_name(name),
        "name": name,
        "category": category[:-1] if category.endswith("s") else category,
        "rarity": None,
        "stars": None,
        "element": None,
        "image": image_url(category, internal_id),
        "activeSkills": [],
        "passiveSkills": [],
        "placeholder": True,
        "internal": {
            "sourceId": internal_id,
            "source": "missing_from_raw_placeholder",
        },
    }


def normalize_entry(item: Dict[str, Any], category: str, order_index: int, display_name_override: Optional[str]) -> Dict[str, Any]:
    internal_id = get_internal_id(item)
    display_name = display_name_override or item.get("displayName") or item.get("title") or item.get("name") or internal_id
    active_skills = ordered_values(item.get("activeSkills", []))
    passives = ordered_values(item.get("passives", item.get("passiveSkills", [])))

    entry: Dict[str, Any] = {
        "schemaVersion": 1,
        "order": order_index,
        "id": kebab_name(str(display_name)),
        "name": display_name,
        "category": category[:-1] if category.endswith("s") else category,
        "rarity": item.get("rarity"),
        "stars": item.get("stars"),
        "evolvedStars": item.get("evolvedStars"),
        "element": normalize_element(item.get("element")),
        "weaponType": item.get("weaponType") or item.get("weaponPref"),
        "stats": {
            "atk": item.get("baseAttack") or item.get("atk"),
            "hp": item.get("baseMaxHp") or item.get("hp"),
            "spd": item.get("speed") or item.get("spd"),
            "cost": item.get("cost"),
        },
        "image": image_url(category, internal_id),
        "activeSkills": active_skills,
        "passiveSkills": passives,
        "rawRefs": {
            "leaderBuff": item.get("leaderBuff"),
            "leaderBuffCondition": item.get("leaderBuffCondition"),
            "aiSequence": item.get("aiSequence"),
            "activeSkillsAI": item.get("activeSkillsAI"),
            "summonableMonsters": item.get("summonableMonsters"),
        },
        "internal": {
            "sourceId": internal_id,
            "family": item.get("family"),
            "source": "apk_extract",
            "treatAsDuplicateOf": item.get("treatAsDuplicateOf"),
        },
        "raw": item,
    }
    entry["rawRefs"] = {k: v for k, v in entry["rawRefs"].items() if v not in (None, {}, [])}
    if category in ("weapons", "accessories"):
        entry["effect"] = item.get("effect")
        entry["profile"] = item.get("profile")
    return entry


def build_category(input_dir: Path, output_dir: Path, category: str) -> Dict[str, Any]:
    raw_path = find_file(input_dir, RAW_FILE_CANDIDATES[category])
    if not raw_path:
        return {"category": category, "status": "missing_raw_file", "entriesWritten": 0, "placeholdersWritten": 0}

    raw = load_json(raw_path)
    items = extract_list(raw, category)
    by_id = {get_internal_id(item): item for item in items}

    order = load_order(input_dir, category)
    ordered_ids: List[Tuple[str, Optional[str]]] = []
    seen = set()

    for internal_id, display_name in order:
        if internal_id not in seen:
            ordered_ids.append((internal_id, display_name))
            seen.add(internal_id)

    for item in items:
        internal_id = get_internal_id(item)
        if internal_id not in seen:
            ordered_ids.append((internal_id, None))
            seen.add(internal_id)

    category_dir = output_dir / category
    entries_dir = category_dir / "entries"
    entries_dir.mkdir(parents=True, exist_ok=True)

    index_entries = []
    placeholders = 0

    for index, (internal_id, display_name) in enumerate(ordered_ids, start=1):
        item = by_id.get(internal_id)
        if item is None:
            entry = make_placeholder(category, internal_id, display_name, index)
            placeholders += 1
        else:
            entry = normalize_entry(item, category, index, display_name)

        file_name = f"{index:04d}_{slugify(internal_id)}.json"
        rel_path = f"entries/{file_name}"
        write_json(entries_dir / file_name, entry)
        index_entries.append({
            "order": index,
            "sourceId": internal_id,
            "name": entry.get("name"),
            "file": rel_path,
            "placeholder": bool(entry.get("placeholder")),
            "image": entry.get("image"),
        })

    write_json(category_dir / "index.json", {
        "schemaVersion": 1,
        "category": category,
        "sourceFile": str(raw_path.relative_to(input_dir)),
        "count": len(index_entries),
        "placeholders": placeholders,
        "entries": index_entries,
    })

    return {
        "category": category,
        "status": "ok",
        "rawFile": str(raw_path),
        "rawEntries": len(items),
        "entriesWritten": len(index_entries),
        "placeholdersWritten": placeholders,
        "output": str(category_dir),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="apkfiles", help="Folder containing raw APK JSON files")
    parser.add_argument("--output", default="apkfiles/generated_entries", help="Folder to write generated per-entry files")
    args = parser.parse_args()

    input_dir = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    reports = []
    for category in ("characters", "weapons", "accessories", "bosses"):
        reports.append(build_category(input_dir, output_dir, category))

    report = {
        "schemaVersion": 1,
        "input": str(input_dir),
        "output": str(output_dir),
        "categories": reports,
    }
    write_json(output_dir / "reports" / "build_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
