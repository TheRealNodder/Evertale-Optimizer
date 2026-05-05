#!/usr/bin/env python3
"""
Build the new Evertale Optimizer APK entry structure.

This is not a simple splitter. It builds one self-contained JSON bundle per
character, weapon, accessory, and boss entry while also pulling the raw resolver
objects needed by that entry.

Run from repo root:
  python tools/new_structure/build_apk_entry_folders.py --input apkfiles --output apkfiles/generated_entries

Input rules:
- Reads APK/raw files such as Monster.json, Boss.json, Weapon.json, Equipment.json,
  Ability.json, AbilityConfig.json, AbilityEffect.json, AbilityComponent.json,
  AbilityAI.json, AbilityAISequence.json, MonsterConditions.json, AttackScalor.json,
  TargetingData.json, Buff.json, BattleBehavior.json, AIThreat.json,
  Localizable_English.txt, BundleReqs.json, Package.json, ValidShards.json.
- Ignores old website files by default: characters.json, character_actives.json,
  character_passives.json, character_tags.json, weapons.json, accessories.json,
  bosses.json.

Output rules:
- One JSON file per entry.
- One index.json per category.
- Each entry keeps raw data and adds resolver references.
- Strict order is read from apkfiles/CatalogOrder/*.txt when present.
- Missing ordered items become placeholders.
- Boss images use HD /characters/ URLs by removing "Boss" before the suffix.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple, Set

IMAGEKIT_BASE = "https://ik.imagekit.io/r8fsa98s9"
OLD_WEBSITE_FILES = {
    "characters.json", "character_actives.json", "character_passives.json", "character_tags.json",
    "weapons.json", "accessories.json", "bosses.json", "leader_skills.json", "enemies.json",
}
CATEGORY_FILES = {
    "characters": ["Monster.json", "Monsters.json"],
    "weapons": ["Weapon.json", "Weapons.json"],
    "accessories": ["Equipment.json", "Equipments.json", "Accessory.json", "Accessories.json"],
    "bosses": ["Boss.json", "Bosses.json"],
}
ORDER_FILES = {
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
RESOLVER_FILES = {
    "Ability": "Ability.json",
    "AbilityConfig": "AbilityConfig.json",
    "AbilityEffect": "AbilityEffect.json",
    "AbilityComponent": "AbilityComponent.json",
    "AbilityAI": "AbilityAI.json",
    "AbilityAISequence": "AbilityAISequence.json",
    "MonsterConditions": "MonsterConditions.json",
    "AttackScalor": "AttackScalor.json",
    "TargetingData": "TargetingData.json",
    "Buff": "Buff.json",
    "BattleBehavior": "BattleBehavior.json",
    "AIThreat": "AIThreat.json",
    "BundleReqs": "BundleReqs.json",
    "Package": "Package.json",
    "ValidShards": "ValidShards.json",
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
        p = input_dir / name
        if p.exists() and p.is_file():
            return p
    wanted = {Path(n).name.lower() for n in names}
    for p in input_dir.rglob("*"):
        if p.is_file() and p.name.lower() in wanted and p.name not in OLD_WEBSITE_FILES:
            return p
    return None


def unwrap(raw: Any, root_key: str) -> Any:
    if isinstance(raw, dict) and root_key in raw:
        return raw[root_key]
    return raw


def key_by_name(data: Any) -> Dict[str, Any]:
    if isinstance(data, dict):
        return data
    out: Dict[str, Any] = {}
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                name = item.get("name") or item.get("id")
                if isinstance(name, str):
                    out[name] = item
    return out


def load_resolvers(input_dir: Path) -> Dict[str, Dict[str, Any]]:
    resolvers: Dict[str, Dict[str, Any]] = {}
    for root_key, filename in RESOLVER_FILES.items():
        p = find_file(input_dir, [filename])
        if not p:
            resolvers[root_key] = {}
            continue
        raw = load_json(p)
        resolvers[root_key] = key_by_name(unwrap(raw, root_key))
    resolvers["Localizable"] = parse_localizable(find_file(input_dir, ["Localizable_English.txt"]))
    return resolvers


def parse_localizable(path: Optional[Path]) -> Dict[str, str]:
    if not path:
        return {}
    out: Dict[str, str] = {}
    pattern = re.compile(r'^"(.*?)"="(.*)"$')
    for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        m = pattern.match(line)
        if m:
            out[m.group(1)] = m.group(2).replace('\\n', '\n').replace('\\"', '"')
    return out


def extract_list(raw: Any, category: str) -> List[Dict[str, Any]]:
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, dict):
        for key in ROOT_KEYS[category]:
            value = raw.get(key)
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]
            if isinstance(value, dict):
                return dict_to_named_list(value)
        return dict_to_named_list(raw)
    return []


def dict_to_named_list(value: Dict[str, Any]) -> List[Dict[str, Any]]:
    out = []
    for k, v in value.items():
        if isinstance(v, dict):
            item = dict(v)
            item.setdefault("name", k)
            out.append(item)
    return out


def parse_order_line(line: str) -> Optional[Tuple[str, Optional[str]]]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    m = re.match(r"^([A-Za-z0-9_]+)\s*(?:\((.*?)\))?\s*$", line)
    if not m:
        return None
    return m.group(1).strip(), (m.group(2).strip() if m.group(2) else None)


def load_order(input_dir: Path, category: str) -> List[Tuple[str, Optional[str]]]:
    p = find_file(input_dir, ORDER_FILES[category])
    if not p:
        return []
    result = []
    for line in p.read_text(encoding="utf-8-sig").splitlines():
        parsed = parse_order_line(line)
        if parsed:
            result.append(parsed)
    return result


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
    value = re.sub(r"[^A-Za-z0-9_-]+", "-", value.strip())
    return re.sub(r"-+", "-", value).strip("-") or "unknown"


def kebab_name(value: str) -> str:
    words = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?=[A-Z]|$)|\d+", value)
    return "-".join(w.lower() for w in words) if words else slugify(value).lower()


def normalize_element(element: Any) -> Optional[str]:
    if not isinstance(element, str):
        return None
    return {"Death": "Dark", "Life": "Light", "Air": "Storm"}.get(element, element)


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
    return value if isinstance(value, list) else []


def localized(localizable: Dict[str, str], base: str) -> Dict[str, Optional[str]]:
    keys = [
        ("name", f"{base}NameKey"),
        ("description", f"{base}DescriptionKey"),
        ("selected", f"{base}SelectedKey"),
    ]
    return {field: localizable.get(key) for field, key in keys if key in localizable}


def strings_in(value: Any) -> Set[str]:
    found: Set[str] = set()
    if isinstance(value, str):
        found.add(value)
    elif isinstance(value, dict):
        for v in value.values():
            found |= strings_in(v)
    elif isinstance(value, list):
        for v in value:
            found |= strings_in(v)
    return found


def resolve_ability(ability_id: str, resolvers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    ability = resolvers["Ability"].get(ability_id)
    result: Dict[str, Any] = {"id": ability_id, "found": bool(ability)}
    if not ability:
        return result
    result["ability"] = ability
    config_id = ability.get("config")
    config = resolvers["AbilityConfig"].get(config_id) if isinstance(config_id, str) else None
    if config:
        result["config"] = config
        result["targetingData"] = resolvers["TargetingData"].get(config.get("targetingData"))
        result["abilityEffect"] = resolvers["AbilityEffect"].get(config.get("abilityEffect"))
        result["immuneSuggestionCondition"] = resolvers["MonsterConditions"].get(config.get("immuneSuggestionCondition"))
        result["components"] = {c: resolvers["AbilityComponent"].get(c) for c in ordered_values(config.get("components", [])) if isinstance(c, str)}
        buffs = sorted({s for s in strings_in(config) if s in resolvers["Buff"]})
        scalors = sorted({s for s in strings_in(config) if s in resolvers["AttackScalor"]})
        conditions = sorted({s for s in strings_in(config) if s in resolvers["MonsterConditions"]})
        result["buffs"] = {b: resolvers["Buff"].get(b) for b in buffs}
        result["attackScalors"] = {s: resolvers["AttackScalor"].get(s) for s in scalors}
        result["conditions"] = {c: resolvers["MonsterConditions"].get(c) for c in conditions}
    loc = localized(resolvers["Localizable"], ability_id)
    if loc:
        result["localization"] = loc
    return result


def resolve_ai(ai_id: str, resolvers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    ai = resolvers["AbilityAI"].get(ai_id)
    return {"id": ai_id, "found": bool(ai), "ai": ai} if ai else {"id": ai_id, "found": False}


def resolve_sequence(seq_id: str, resolvers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    seq = resolvers["AbilityAISequence"].get(seq_id)
    return {"id": seq_id, "found": bool(seq), "sequence": seq} if seq else {"id": seq_id, "found": False}


def make_placeholder(category: str, internal_id: str, display_name: Optional[str], order_index: int) -> Dict[str, Any]:
    name = display_name or internal_id
    return {
        "schemaVersion": 2,
        "order": order_index,
        "id": kebab_name(name),
        "name": name,
        "category": category[:-1] if category.endswith("s") else category,
        "image": image_url(category, internal_id),
        "placeholder": True,
        "internal": {"sourceId": internal_id, "source": "missing_from_raw_placeholder"},
    }


def normalize_entry(item: Dict[str, Any], category: str, order_index: int, display_name_override: Optional[str], resolvers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    internal_id = get_internal_id(item)
    display_name = display_name_override or item.get("displayName") or item.get("title") or item.get("name") or internal_id
    active_ids = [x for x in ordered_values(item.get("activeSkills", [])) if isinstance(x, str)]
    passive_ids = [x for x in ordered_values(item.get("passives", item.get("passiveSkills", []))) if isinstance(x, str)]
    active_ai = item.get("activeSkillsAI", {}) if isinstance(item.get("activeSkillsAI"), dict) else {}

    entry: Dict[str, Any] = {
        "schemaVersion": 2,
        "order": order_index,
        "id": kebab_name(str(display_name)),
        "name": display_name,
        "category": category[:-1] if category.endswith("s") else category,
        "rarity": item.get("rarity"),
        "stars": item.get("stars"),
        "evolvedStars": item.get("evolvedStars"),
        "element": normalize_element(item.get("element")),
        "weaponType": item.get("weaponType") or item.get("weaponPref"),
        "stats": {"atk": item.get("baseAttack") or item.get("atk"), "hp": item.get("baseMaxHp") or item.get("hp"), "spd": item.get("speed") or item.get("spd"), "cost": item.get("cost")},
        "image": image_url(category, internal_id),
        "refs": {"activeSkills": active_ids, "passives": passive_ids, "activeSkillsAI": active_ai, "aiSequence": item.get("aiSequence"), "leaderBuff": item.get("leaderBuff"), "leaderBuffCondition": item.get("leaderBuffCondition"), "summonableMonsters": item.get("summonableMonsters")},
        "resolved": {
            "activeSkills": {aid: resolve_ability(aid, resolvers) for aid in active_ids},
            "passives": {pid: resolve_ability(pid, resolvers) for pid in passive_ids},
            "activeSkillsAI": {slot: resolve_ai(ai, resolvers) for slot, ai in active_ai.items() if isinstance(ai, str)},
            "aiSequence": resolve_sequence(item.get("aiSequence"), resolvers) if isinstance(item.get("aiSequence"), str) else None,
            "leaderCondition": resolvers["MonsterConditions"].get(item.get("leaderBuffCondition")) if isinstance(item.get("leaderBuffCondition"), str) else None,
        },
        "internal": {"sourceId": internal_id, "family": item.get("family"), "source": "apk_extract", "treatAsDuplicateOf": item.get("treatAsDuplicateOf")},
        "raw": item,
    }
    if category in ("weapons", "accessories"):
        entry["effect"] = item.get("effect")
        entry["profile"] = item.get("profile")
    return entry


def build_category(input_dir: Path, output_dir: Path, category: str, resolvers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    raw_path = find_file(input_dir, CATEGORY_FILES[category])
    if not raw_path:
        return {"category": category, "status": "missing_raw_file", "entriesWritten": 0, "placeholdersWritten": 0}
    raw = load_json(raw_path)
    items = extract_list(raw, category)
    by_id = {get_internal_id(item): item for item in items}
    ordered: List[Tuple[str, Optional[str]]] = []
    seen: Set[str] = set()
    for internal_id, display_name in load_order(input_dir, category):
        if internal_id not in seen:
            ordered.append((internal_id, display_name)); seen.add(internal_id)
    for item in items:
        internal_id = get_internal_id(item)
        if internal_id not in seen:
            ordered.append((internal_id, None)); seen.add(internal_id)
    category_dir = output_dir / category
    entries_dir = category_dir / "entries"
    entries_dir.mkdir(parents=True, exist_ok=True)
    index_entries = []
    placeholders = 0
    for i, (internal_id, display_name) in enumerate(ordered, start=1):
        if internal_id in by_id:
            entry = normalize_entry(by_id[internal_id], category, i, display_name, resolvers)
        else:
            entry = make_placeholder(category, internal_id, display_name, i); placeholders += 1
        filename = f"{i:04d}_{slugify(internal_id)}.json"
        write_json(entries_dir / filename, entry)
        index_entries.append({"order": i, "sourceId": internal_id, "name": entry.get("name"), "file": f"entries/{filename}", "placeholder": bool(entry.get("placeholder")), "image": entry.get("image")})
    write_json(category_dir / "index.json", {"schemaVersion": 2, "category": category, "sourceFile": str(raw_path.relative_to(input_dir)), "count": len(index_entries), "placeholders": placeholders, "entries": index_entries})
    return {"category": category, "status": "ok", "rawFile": str(raw_path), "rawEntries": len(items), "entriesWritten": len(index_entries), "placeholdersWritten": placeholders, "output": str(category_dir)}


def write_resolver_indexes(output_dir: Path, resolvers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    resolver_dir = output_dir / "resolvers"
    summary = {}
    for name, mapping in resolvers.items():
        if name == "Localizable":
            write_json(resolver_dir / "Localizable.index.json", {"count": len(mapping), "keys": sorted(mapping.keys())})
        else:
            write_json(resolver_dir / f"{name}.index.json", {"count": len(mapping), "keys": sorted(mapping.keys())})
        summary[name] = len(mapping)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="apkfiles")
    parser.add_argument("--output", default="apkfiles/generated_entries")
    args = parser.parse_args()
    input_dir = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    resolvers = load_resolvers(input_dir)
    resolver_summary = write_resolver_indexes(output_dir, resolvers)
    reports = [build_category(input_dir, output_dir, c, resolvers) for c in ("characters", "weapons", "accessories", "bosses")]
    report = {"schemaVersion": 2, "input": str(input_dir), "output": str(output_dir), "resolverCounts": resolver_summary, "categories": reports}
    write_json(output_dir / "reports" / "build_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
