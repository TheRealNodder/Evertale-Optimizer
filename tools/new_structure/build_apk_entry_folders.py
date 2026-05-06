#!/usr/bin/env python3
"""
Build the new Evertale Optimizer APK entry structure.

Incremental design:
- Every generated entry contains a _build marker with hashes.
- On the next run, the script reads that marker and skips unchanged entries.
- If the script stops halfway, running it again resumes automatically.
- Only changed entries are resolved and rewritten unless --force is used.

Run from repo root:
  python tools/new_structure/build_apk_entry_folders.py --input apkfiles --output apkfiles/generated_entries
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple, Set

SCRIPT_VERSION = "4-passive-localization"
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


def now_int() -> int:
    return int(time.time())


def stable_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def sha256_data(data: Any) -> str:
    return hashlib.sha256(stable_json(data).encode("utf-8")).hexdigest()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)


def try_load_json(path: Path) -> Optional[Any]:
    try:
        if path.exists():
            return load_json(path)
    except Exception:
        return None
    return None


def write_json_if_changed(path: Path, data: Any) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if path.exists() and path.read_text(encoding="utf-8", errors="replace") == text:
        return False
    path.write_text(text, encoding="utf-8", newline="\n")
    return True


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
    return raw[root_key] if isinstance(raw, dict) and root_key in raw else raw


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


def parse_localizable(path: Optional[Path]) -> Dict[str, str]:
    if not path:
        return {}
    out: Dict[str, str] = {}
    pattern = re.compile(r'^"(.*?)"="(.*)"$')
    for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        match = pattern.match(line)
        if match:
            out[match.group(1)] = match.group(2).replace('\\n', '\n').replace('\\"', '"')
    return out


def load_resolvers(input_dir: Path) -> Dict[str, Dict[str, Any]]:
    resolvers: Dict[str, Dict[str, Any]] = {}
    for root_key, filename in RESOLVER_FILES.items():
        path = find_file(input_dir, [filename])
        if not path:
            resolvers[root_key] = {}
            continue
        raw = load_json(path)
        resolvers[root_key] = key_by_name(unwrap(raw, root_key))
    resolvers["Localizable"] = parse_localizable(find_file(input_dir, ["Localizable_English.txt", "Localizable_English"]))
    return resolvers


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
    for key, item_value in value.items():
        if isinstance(item_value, dict):
            item = dict(item_value)
            item.setdefault("name", key)
            out.append(item)
    return out


def parse_order_line(line: str) -> Optional[Tuple[str, Optional[str]]]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    match = re.match(r"^([A-Za-z0-9_]+)\s*(?:\((.*?)\))?\s*$", line)
    if not match:
        return None
    return match.group(1).strip(), (match.group(2).strip() if match.group(2) else None)


def load_order(input_dir: Path, category: str) -> List[Tuple[str, Optional[str]]]:
    path = find_file(input_dir, ORDER_FILES[category])
    if not path:
        return []
    output = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        parsed = parse_order_line(line)
        if parsed:
            output.append(parsed)
    return output


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


def localize_ability_like(localizable: Dict[str, str], ability_id: str) -> Dict[str, Any]:
    loc = localized(localizable, ability_id)
    return {
        "id": ability_id,
        "found": bool(loc),
        "localization": {
            "name": loc.get("name") or ability_id,
            "description": loc.get("description") or "",
            **({"selected": loc["selected"]} if loc.get("selected") else {}),
        },
    }


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


def dependency_fingerprint_for_ability(ability_id: str, resolvers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    ability = resolvers["Ability"].get(ability_id)
    fp: Dict[str, Any] = {"abilityId": ability_id, "ability": ability, "localization": localized(resolvers["Localizable"], ability_id)}
    if not isinstance(ability, dict):
        return fp
    config_id = ability.get("config")
    config = resolvers["AbilityConfig"].get(config_id) if isinstance(config_id, str) else None
    fp["config"] = config
    if isinstance(config, dict):
        fp["targetingData"] = resolvers["TargetingData"].get(config.get("targetingData"))
        fp["abilityEffect"] = resolvers["AbilityEffect"].get(config.get("abilityEffect"))
        fp["components"] = {c: resolvers["AbilityComponent"].get(c) for c in ordered_values(config.get("components", [])) if isinstance(c, str)}
        refs = strings_in(config)
        fp["buffs"] = {x: resolvers["Buff"].get(x) for x in sorted(refs) if x in resolvers["Buff"]}
        fp["attackScalors"] = {x: resolvers["AttackScalor"].get(x) for x in sorted(refs) if x in resolvers["AttackScalor"]}
        fp["conditions"] = {x: resolvers["MonsterConditions"].get(x) for x in sorted(refs) if x in resolvers["MonsterConditions"]}
    return fp


def build_source_marker(item: Optional[Dict[str, Any]], category: str, internal_id: str, order_index: int, display_name: Optional[str], resolvers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    if item is None:
        material = {"placeholder": True, "category": category, "internalId": internal_id, "order": order_index, "displayName": display_name, "scriptVersion": SCRIPT_VERSION}
        return {"scriptVersion": SCRIPT_VERSION, "sourceHash": sha256_data(material), "dependencyHash": None}
    active_ids = [x for x in ordered_values(item.get("activeSkills", [])) if isinstance(x, str)]
    passive_ids = [x for x in ordered_values(item.get("passives", item.get("passiveSkills", []))) if isinstance(x, str)]
    dependency_material = {
        "abilities": {x: dependency_fingerprint_for_ability(x, resolvers) for x in active_ids + passive_ids},
        "leaderCondition": resolvers["MonsterConditions"].get(item.get("leaderBuffCondition")) if isinstance(item.get("leaderBuffCondition"), str) else None,
    }
    source_material = {"category": category, "internalId": internal_id, "order": order_index, "displayName": display_name, "raw": item, "scriptVersion": SCRIPT_VERSION}
    return {"scriptVersion": SCRIPT_VERSION, "sourceHash": sha256_data(source_material), "dependencyHash": sha256_data(dependency_material)}


def existing_marker_matches(path: Path, marker: Dict[str, Any], force: bool) -> bool:
    if force or not path.exists():
        return False
    existing = try_load_json(path)
    if not isinstance(existing, dict):
        return False
    old = existing.get("_build")
    if not isinstance(old, dict):
        return False
    return old.get("scriptVersion") == marker.get("scriptVersion") and old.get("sourceHash") == marker.get("sourceHash") and old.get("dependencyHash") == marker.get("dependencyHash")


def resolve_ability(ability_id: str, resolvers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    ability = resolvers["Ability"].get(ability_id)
    result: Dict[str, Any] = localize_ability_like(resolvers["Localizable"], ability_id)
    if not isinstance(ability, dict):
        return result
    result["found"] = True
    result["ability"] = ability
    config_id = ability.get("config")
    config = resolvers["AbilityConfig"].get(config_id) if isinstance(config_id, str) else None
    if isinstance(config, dict):
        result["config"] = config
        result["targetingData"] = resolvers["TargetingData"].get(config.get("targetingData"))
        result["abilityEffect"] = resolvers["AbilityEffect"].get(config.get("abilityEffect"))
        result["components"] = {c: resolvers["AbilityComponent"].get(c) for c in ordered_values(config.get("components", [])) if isinstance(c, str)}
        refs = strings_in(config)
        result["buffs"] = {x: resolvers["Buff"].get(x) for x in sorted(refs) if x in resolvers["Buff"]}
        result["attackScalors"] = {x: resolvers["AttackScalor"].get(x) for x in sorted(refs) if x in resolvers["AttackScalor"]}
        result["conditions"] = {x: resolvers["MonsterConditions"].get(x) for x in sorted(refs) if x in resolvers["MonsterConditions"]}
    return result


def resolve_ai(ai_id: str, resolvers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    ai = resolvers["AbilityAI"].get(ai_id)
    return {"id": ai_id, "found": bool(ai), "ai": ai} if ai else {"id": ai_id, "found": False}


def resolve_sequence(seq_id: str, resolvers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    seq = resolvers["AbilityAISequence"].get(seq_id)
    return {"id": seq_id, "found": bool(seq), "sequence": seq} if seq else {"id": seq_id, "found": False}


def make_placeholder(category: str, internal_id: str, display_name: Optional[str], order_index: int, marker: Dict[str, Any]) -> Dict[str, Any]:
    name = display_name or internal_id
    return {"schemaVersion": 3, "order": order_index, "id": kebab_name(name), "name": name, "category": category[:-1] if category.endswith("s") else category, "image": image_url(category, internal_id), "placeholder": True, "internal": {"sourceId": internal_id, "source": "missing_from_raw_placeholder"}, "_build": {**marker, "generatedAt": now_int()}}


def normalize_entry(item: Dict[str, Any], category: str, order_index: int, display_name_override: Optional[str], resolvers: Dict[str, Dict[str, Any]], marker: Dict[str, Any]) -> Dict[str, Any]:
    internal_id = get_internal_id(item)
    localizable = resolvers["Localizable"]
    display_name = display_name_override or localizable.get(f"{internal_id}NameKey") or item.get("displayName") or item.get("title") or item.get("name") or internal_id
    title = localizable.get(f"{internal_id}TitleKey") or localizable.get(f"{internal_id}ProfileKey") or item.get("title") or ""
    active_ids = [x for x in ordered_values(item.get("activeSkills", [])) if isinstance(x, str)]
    passive_ids = [x for x in ordered_values(item.get("passives", item.get("passiveSkills", []))) if isinstance(x, str)]
    active_ai = item.get("activeSkillsAI", {}) if isinstance(item.get("activeSkillsAI"), dict) else {}
    return {
        "schemaVersion": 3,
        "order": order_index,
        "id": kebab_name(str(display_name)),
        "name": display_name,
        "title": title,
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
        "effect": item.get("effect") if category in ("weapons", "accessories") else None,
        "profile": item.get("profile") if category in ("weapons", "accessories") else None,
        "internal": {"sourceId": internal_id, "family": item.get("family"), "source": "apk_extract", "treatAsDuplicateOf": item.get("treatAsDuplicateOf")},
        "raw": item,
        "_build": {**marker, "generatedAt": now_int()},
    }


def update_checkpoint(output_dir: Path, checkpoint: Dict[str, Any]) -> None:
    write_json_if_changed(output_dir / "reports" / "build_checkpoint.json", checkpoint)


def build_category(input_dir: Path, output_dir: Path, category: str, resolvers: Dict[str, Dict[str, Any]], force: bool, limit: Optional[int], start_after: Optional[str]) -> Dict[str, Any]:
    raw_path = find_file(input_dir, CATEGORY_FILES[category])
    if not raw_path:
        return {"category": category, "status": "missing_raw_file", "entriesWritten": 0, "entriesSkipped": 0, "placeholdersWritten": 0}
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
    written = skipped = placeholders = processed_this_run = 0
    start_allowed = start_after is None
    checkpoint = {"scriptVersion": SCRIPT_VERSION, "category": category, "status": "running", "startedAt": now_int(), "lastCompletedSourceId": None, "lastCompletedOrder": None}
    update_checkpoint(output_dir, checkpoint)
    for order_index, (internal_id, display_name) in enumerate(ordered, start=1):
        filename = f"{order_index:04d}_{slugify(internal_id)}.json"
        entry_path = entries_dir / filename
        item = by_id.get(internal_id)
        marker = build_source_marker(item, category, internal_id, order_index, display_name, resolvers)
        if not start_allowed:
            if internal_id == start_after:
                start_allowed = True
            index_entries.append({"order": order_index, "sourceId": internal_id, "name": display_name or internal_id, "file": f"entries/{filename}", "placeholder": item is None, "image": image_url(category, internal_id)})
            continue
        if limit is not None and processed_this_run >= limit:
            index_entries.append({"order": order_index, "sourceId": internal_id, "name": display_name or internal_id, "file": f"entries/{filename}", "placeholder": item is None, "image": image_url(category, internal_id)})
            continue
        if existing_marker_matches(entry_path, marker, force):
            skipped += 1
            existing = try_load_json(entry_path) or {}
            entry_name = existing.get("name") or display_name or internal_id
            is_placeholder = bool(existing.get("placeholder"))
            image = existing.get("image") or image_url(category, internal_id)
        else:
            if item is None:
                entry = make_placeholder(category, internal_id, display_name, order_index, marker)
                placeholders += 1
            else:
                entry = normalize_entry(item, category, order_index, display_name, resolvers, marker)
            write_json_if_changed(entry_path, entry)
            written += 1
            entry_name = entry.get("name")
            is_placeholder = bool(entry.get("placeholder"))
            image = entry.get("image")
        processed_this_run += 1
        checkpoint.update({"lastCompletedSourceId": internal_id, "lastCompletedOrder": order_index, "updatedAt": now_int(), "written": written, "skipped": skipped})
        update_checkpoint(output_dir, checkpoint)
        index_entries.append({"order": order_index, "sourceId": internal_id, "name": entry_name, "file": f"entries/{filename}", "placeholder": is_placeholder, "image": image})
    write_json_if_changed(category_dir / "index.json", {"schemaVersion": 3, "category": category, "sourceFile": str(raw_path.relative_to(input_dir)), "count": len(index_entries), "placeholders": placeholders, "entries": index_entries})
    checkpoint.update({"status": "complete", "completedAt": now_int()})
    update_checkpoint(output_dir, checkpoint)
    return {"category": category, "status": "ok", "rawFile": str(raw_path), "rawEntries": len(items), "totalEntries": len(ordered), "entriesWritten": written, "entriesSkipped": skipped, "processedThisRun": processed_this_run, "placeholdersWritten": placeholders, "output": str(category_dir)}


def write_resolver_indexes(output_dir: Path, resolvers: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    resolver_dir = output_dir / "resolvers"
    summary = {}
    for name, mapping in resolvers.items():
        write_json_if_changed(resolver_dir / f"{name}.index.json", {"schemaVersion": 3, "count": len(mapping), "keys": sorted(mapping.keys())})
        summary[name] = len(mapping)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="apkfiles")
    parser.add_argument("--output", default="apkfiles/generated_entries")
    parser.add_argument("--category", choices=["characters", "weapons", "accessories", "bosses"], default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--start-after", default=None)
    args = parser.parse_args()
    input_dir = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    resolvers = load_resolvers(input_dir)
    resolver_summary = write_resolver_indexes(output_dir, resolvers)
    categories = [args.category] if args.category else ["characters", "weapons", "accessories", "bosses"]
    reports = [build_category(input_dir, output_dir, c, resolvers, args.force, args.limit, args.start_after) for c in categories]
    report = {"schemaVersion": 3, "scriptVersion": SCRIPT_VERSION, "input": str(input_dir), "output": str(output_dir), "resolverCounts": resolver_summary, "categories": reports}
    write_json_if_changed(output_dir / "reports" / "build_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
