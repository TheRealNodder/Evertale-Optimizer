#!/usr/bin/env python3
"""
Extract Localizable_English into grouped runtime maps.

Outputs:
  apkfiles/entries/localization/localizable_groups.json
  apkfiles/entries/localization/localizable_groups_by_category.json
  apkfiles/entries/localization/leader_skill_localization.json
  apkfiles/entries/localization/localizable_group_report.json

Leader-skill rule:
  Character entry refs.leaderBuff is the source-of-truth ID.
  Localizable_English provides the readable Name/Description/Affected text for that ID.
"""
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, Optional, Set, Tuple

# Supports Unity .strings style: "Key" = "Value"; and compact: "Key"="Value"
KEY_RE = re.compile(r'^\s*"(?P<key>(?:\\.|[^"])*)"\s*=\s*"(?P<value>(?:\\.|[^"])*)"\s*;?\s*$')
KNOWN_SUFFIXES = [
    "SecondNameKey",
    "DescriptionKey",
    "AffectedKey",
    "NameKey",
    "TitleKey",
    "SubTitleKey",
    "ProfileKey",
    "SelectedKey",
    "IntroText",
    "CatchIntroText",
    "MessageKey",
    "TitleMessageKey",
    "Description",
    "Affected",
    "Name",
    "Title",
]
CATEGORY_ORDER = ["characters", "weapons", "accessories", "bosses", "leader_skills", "unknown"]
ELEMENT_WORD_RE = re.compile(r"\b(Fire|Water|Storm|Earth|Light|Dark)\b", re.I)
LEADER_STAT_RE = re.compile(r"\b(HP|ATK|Attack|Atk)\b", re.I)
LEADER_COMBO_RE = re.compile(r"(ATK\s*&\s*HP|Attack\s*&\s*HP|AttackAndHP|ATKAndHP|HPAndATK)", re.I)
LEADER_BASE_RE = re.compile(
    r"(LeaderSkill|HPUp|ATKUp|AtkUp|AttackUp|AttackAndHPUp|ATKAndHPUp|HPAndATKUp|Allies?HP|Allies?ATK|Allies?Attack)",
    re.I,
)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def find_repo_root(start: Optional[Path] = None) -> Path:
    cur = (start or Path.cwd()).resolve()
    for path in [cur, *cur.parents]:
        if (path / ".git").exists() or (path / "apkfiles").exists():
            return path
    return cur


def resolve_path(path_text: Optional[str], repo_root: Path, default_rel: str) -> Path:
    raw = Path(path_text) if path_text else Path(default_rel)
    if raw.is_absolute():
        return raw.resolve()
    cwd_candidate = (Path.cwd() / raw).resolve()
    if cwd_candidate.exists():
        return cwd_candidate
    return (repo_root / raw).resolve()


def find_apkfiles(repo_root: Path, explicit: Optional[str]) -> Path:
    if explicit:
        path = resolve_path(explicit, repo_root, explicit)
        if path.exists():
            return path
    for path in [repo_root / "apkfiles", Path.cwd() / "apkfiles"]:
        if path.exists() and path.is_dir():
            return path.resolve()
    for path in repo_root.rglob("apkfiles"):
        if path.is_dir():
            return path.resolve()
    raise FileNotFoundError("Could not auto-detect apkfiles folder. Pass --input path/to/apkfiles")


def find_entries(repo_root: Path, apkfiles: Path, explicit: Optional[str]) -> Path:
    if explicit:
        path = resolve_path(explicit, repo_root, explicit)
        if path.exists():
            return path
    for path in [apkfiles / "entries", repo_root / "apkfiles" / "entries", Path.cwd() / "entries"]:
        if path.exists() and path.is_dir():
            return path.resolve()
    return (apkfiles / "entries").resolve()


def find_localizable(input_dir: Path) -> Path:
    for path in [input_dir / "Localizable_English.txt", input_dir / "Localizable_English"]:
        if path.exists() and path.is_file():
            return path
    for path in input_dir.rglob("*"):
        if path.is_file() and path.name.lower() in {"localizable_english.txt", "localizable_english"}:
            return path
    raise FileNotFoundError(f"Could not find Localizable_English in {input_dir}")


def unescape_value(value: str) -> str:
    return value.replace("\\n", "\n").replace('\\"', '"').replace("\\t", "\t")


def strip_wrapped(value: str) -> str:
    text = value.strip().rstrip(";").strip()
    if len(text) >= 2 and text[0] == '"' and text[-1] == '"':
        text = text[1:-1]
    return unescape_value(text)


def parse_localizable(path: Path) -> Dict[str, str]:
    rows: Dict[str, str] = {}
    for raw_line in read_text(path).splitlines():
        line = raw_line.strip()
        if not line or line.startswith("//") or line.startswith("#"):
            continue
        match = KEY_RE.match(line)
        if match:
            rows[unescape_value(match.group("key"))] = unescape_value(match.group("value"))
            continue
        if "\t" in line:
            key, value = line.split("\t", 1)
            key = strip_wrapped(key)
            if key:
                rows[key] = strip_wrapped(value)
            continue
        if "=" in line:
            key, value = line.split("=", 1)
            key = strip_wrapped(key)
            if key:
                rows[key] = strip_wrapped(value)
            continue
    return rows


def split_key(key: str) -> Tuple[str, str]:
    for suffix in sorted(KNOWN_SUFFIXES, key=len, reverse=True):
        if key.endswith(suffix):
            return key[: -len(suffix)], suffix
    match = re.match(r"^(.*?)([A-Z][A-Za-z0-9]*Key)$", key)
    if match:
        return match.group(1), match.group(2)
    return key, "value"


def key_norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def load_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(read_text(path))
    except Exception:
        return fallback


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


def collect_leader_buff_ids(entries_root: Path) -> Dict[str, Dict[str, Any]]:
    leaders: Dict[str, Dict[str, Any]] = {}
    index_path = entries_root / "characters" / "index.json"
    index = load_json(index_path, {}) or {}
    for row in index.get("entries", []) if isinstance(index, dict) else []:
        rel_file = str(row.get("file") or "").replace("\\", "/")
        if not rel_file:
            continue
        entry_path = entries_root / "characters" / rel_file
        if not entry_path.exists():
            entry_path = entries_root / rel_file
        entry = load_json(entry_path, {}) or {}
        refs = entry.get("refs") if isinstance(entry.get("refs"), dict) else {}
        raw = entry.get("raw") if isinstance(entry.get("raw"), dict) else {}
        internal = entry.get("internal") if isinstance(entry.get("internal"), dict) else {}
        leader_id = str(refs.get("leaderBuff") or raw.get("leaderBuff") or internal.get("leaderBuff") or "").strip()
        if not leader_id:
            continue
        condition = str(refs.get("leaderBuffCondition") or raw.get("leaderBuffCondition") or internal.get("leaderBuffCondition") or "").strip()
        source_id = str(row.get("sourceId") or refs.get("sourceId") or internal.get("sourceId") or entry.get("name") or "").strip()
        leaders.setdefault(leader_id, {"id": leader_id, "condition": condition, "sourceIds": []})
        if source_id and source_id not in leaders[leader_id]["sourceIds"]:
            leaders[leader_id]["sourceIds"].append(source_id)
        if condition and not leaders[leader_id].get("condition"):
            leaders[leader_id]["condition"] = condition
    return leaders


def resolve_leader_id_from_base(base: str, leader_ids: Set[str]) -> str | None:
    if not base:
        return None
    if base in leader_ids:
        return base
    base_norm = key_norm(base)
    for leader_id in sorted(leader_ids, key=len, reverse=True):
        lid_norm = key_norm(leader_id)
        if base_norm == lid_norm or base_norm.endswith(lid_norm):
            return leader_id
    for prefix in ("Buff", "LeaderSkill", "Passive"):
        if base.startswith(prefix) and base[len(prefix):] in leader_ids:
            return base[len(prefix):]
    return None


def is_true_leader_skill_text(base: str, keys: Dict[str, str]) -> bool:
    text = " ".join(str(keys.get(k, "")) for k in ("NameKey", "TitleKey", "DescriptionKey", "AffectedKey", "Name", "Description", "Affected", "value"))
    combined = f"{base} {text}"
    has_stat = bool(LEADER_STAT_RE.search(combined) or LEADER_COMBO_RE.search(combined))
    has_element = bool(ELEMENT_WORD_RE.search(combined))
    has_leader_phrase = bool(re.search(r"\b(Allied|ally|allies|element units|units have their|max HP increased|Attack increased)\b", combined, re.I))
    has_base_pattern = bool(LEADER_BASE_RE.search(base))
    has_percent = "%" in combined or "Percent" in base
    return (has_base_pattern or has_stat or LEADER_COMBO_RE.search(combined)) and (has_element or has_leader_phrase or has_percent)


def is_leader_skill_group(base: str, keys: Dict[str, str], known: Dict[str, Set[str]]) -> bool:
    if resolve_leader_id_from_base(base, known.get("leader_skills", set())):
        return True
    return is_true_leader_skill_text(base, keys)


def category_from_base(base: str, keys: Dict[str, str], known: Dict[str, Set[str]]) -> str:
    if is_leader_skill_group(base, keys, known):
        return "leader_skills"
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
    if re.search(r"(Sword|Axe|Staff|Mace|Spear|Lance|Bow|Gun|Dagger|Katana|Greatsword|GreatAxe|Hammer)", base):
        return "weapons"
    if re.search(r"(Ring|Charm|Armor|Amulet|Pendant|Earring|Crown|Helm|Helmet|Boot|Bracelet|Necklace|Accessory|Equipment|Belt|Gauntlet|Cloak)", base):
        return "accessories"
    return "unknown"


def group_rows(rows: Dict[str, str], known: Dict[str, Set[str]]) -> Dict[str, Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    for key, value in rows.items():
        base, suffix = split_key(key)
        group = grouped.setdefault(base, {
            "base": base,
            "family": re.sub(r"\d+$", "", base),
            "category": "unknown",
            "keys": {},
            "rawKeys": [],
        })
        group["keys"][suffix] = value
        group["rawKeys"].append(key)
    for group in grouped.values():
        keys = group["keys"]
        group["category"] = category_from_base(group["base"], keys, known)
        group["name"] = keys.get("NameKey", "") or keys.get("Name", "") or keys.get("TitleKey", "") or keys.get("Title", "")
        group["secondName"] = keys.get("SecondNameKey", "")
        group["title"] = keys.get("TitleKey", "") or keys.get("Title", "") or keys.get("SecondNameKey", "")
        group["subtitle"] = keys.get("SubTitleKey", "")
        group["description"] = keys.get("DescriptionKey", "") or keys.get("Description", "")
        group["affected"] = keys.get("AffectedKey", "") or keys.get("Affected", "")
        if not group["description"] and keys.get("value") and group["category"] == "leader_skills":
            group["description"] = keys.get("value", "")
        group["profile"] = keys.get("ProfileKey", "")
        group["selected"] = keys.get("SelectedKey", "")
        group["keyCount"] = len(group["rawKeys"])
        leader_id = resolve_leader_id_from_base(group["base"], known.get("leader_skills", set()))
        if leader_id:
            group["leaderBuffId"] = leader_id
    return grouped


def find_legacy_leader_skills(repo_root: Path) -> Path | None:
    for path in [
        repo_root / "legacy" / "legacy_unused" / "data" / "leader_skills.json",
        repo_root / "data" / "leader_skills.json",
        repo_root / "legacy" / "data" / "leader_skills.json",
    ]:
        if path.exists():
            return path
    return None


def load_legacy_leader_skills(repo_root: Path) -> Dict[str, Any]:
    path = find_legacy_leader_skills(repo_root)
    if not path:
        return {"source": None, "skills": [], "byCharacter": {}, "aliases": {}}
    data = load_json(path, {}) or {}
    rows = data.get("leaderSkills", []) if isinstance(data, dict) else []
    by_character: Dict[str, Dict[str, Any]] = {}
    aliases: Dict[str, str] = {}
    cleaned_rows = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        character = str(row.get("character") or "").strip()
        name = str(row.get("name") or row.get("skillName") or "").strip()
        description = str(row.get("description") or row.get("text") or "").strip().replace("mac HP", "max HP")
        element = str(row.get("element") or "").strip()
        if not character or not (name or description):
            continue
        clean = {"character": character, "element": element, "name": name, "description": description, "source": str(path)}
        cleaned_rows.append(clean)
        by_character[character] = clean
        aliases[key_norm(character)] = character
        parts = character.split()
        if parts:
            aliases[key_norm(parts[0])] = character
        if len(parts) >= 2:
            aliases[key_norm(" ".join(parts[:2]))] = character
    return {"source": str(path), "skills": cleaned_rows, "byCharacter": by_character, "aliases": aliases}


def build_leader_skill_map(grouped: Dict[str, Dict[str, Any]], repo_root: Path, leader_buff_ids: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Build the runtime leader-skill map from character leaderBuff IDs only.

    Earlier versions treated every Localizable group that looked leader-skill-like as a
    runtime leader skill. That polluted leader_skill_localization.json with active and
    passive skills such as Recovery Mist, which made the frontend resolver unreliable.

    The character entry refs.leaderBuff/raw.leaderBuff IDs are the authority. Localizable
    is only used to attach readable text to those known IDs.
    """
    skills: Dict[str, Dict[str, Any]] = {}
    rejected_samples = []
    leader_ids = set(leader_buff_ids)

    for base, group in grouped.items():
        leader_id = group.get("leaderBuffId") or resolve_leader_id_from_base(base, leader_ids)
        if not leader_id:
            if group.get("category") == "leader_skills" and len(rejected_samples) < 30:
                rejected_samples.append({
                    "id": base,
                    "name": group.get("name", ""),
                    "description": group.get("description", ""),
                    "reason": "not_referenced_by_character_leaderBuff",
                })
            continue

        if not (group.get("name") or group.get("description") or group.get("affected")):
            continue

        skills[leader_id] = {
            "id": leader_id,
            "localizableBase": base,
            "name": group.get("name", ""),
            "description": group.get("description", ""),
            "affected": group.get("affected", ""),
            "condition": leader_buff_ids.get(leader_id, {}).get("condition", ""),
            "sourceIds": leader_buff_ids.get(leader_id, {}).get("sourceIds", []),
            "rawKeys": group.get("rawKeys", []),
            "source": "Localizable_English",
        }

    legacy = load_legacy_leader_skills(repo_root)
    return {
        "schemaVersion": 7,
        "generatedAt": int(time.time()),
        "count": len(skills),
        "skills": dict(sorted(skills.items())),
        "leaderBuffSourceCount": len(leader_buff_ids),
        "missingLeaderBuffLocalizations": sorted([lid for lid in leader_buff_ids if lid not in skills]),
        "legacyCount": len(legacy.get("skills", [])),
        "legacyByCharacter": legacy.get("byCharacter", {}),
        "legacyCharacterAliases": legacy.get("aliases", {}),
        "legacySource": legacy.get("source"),
        "rejectedPassiveSamples": rejected_samples,
        "filter": {
            "leaderBuffAuthority": "character entry refs.leaderBuff",
            "localizableUsage": "text_only_for_known_leaderBuff_ids",
            "localizableFormats": ["quoted_equals_semicolon", "quoted_equals", "tab", "plain_equals"],
            "excluded": ["active skills", "passive skills", "mechanic buffs not referenced by character leaderBuff"],
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=None, help="Path to apkfiles. Auto-detected when omitted.")
    parser.add_argument("--entries", default=None, help="Path to apkfiles/entries. Auto-detected when omitted.")
    parser.add_argument("--output", default=None, help="Output folder. Defaults to apkfiles/entries/localization.")
    args = parser.parse_args()

    repo_root = find_repo_root(Path(__file__).resolve())
    input_dir = find_apkfiles(repo_root, args.input)
    entries_root = find_entries(repo_root, input_dir, args.entries)
    output_dir = resolve_path(args.output, repo_root, str(entries_root / "localization")) if args.output else (entries_root / "localization").resolve()

    loc_path = find_localizable(input_dir)
    rows = parse_localizable(loc_path)
    leader_buff_ids = collect_leader_buff_ids(entries_root)
    known = {cat: load_index_source_ids(entries_root, cat) for cat in ["characters", "weapons", "accessories", "bosses"]}
    known["leader_skills"] = set(leader_buff_ids)
    grouped = group_rows(rows, known)
    leader_skills = build_leader_skill_map(grouped, repo_root, leader_buff_ids)

    by_category = {cat: [] for cat in CATEGORY_ORDER}
    for base in sorted(grouped):
        group = grouped[base]
        by_category.setdefault(group["category"], []).append(group)

    report = {
        "schemaVersion": 6,
        "generatedAt": int(time.time()),
        "repoRoot": str(repo_root),
        "input": str(input_dir),
        "entriesRoot": str(entries_root),
        "output": str(output_dir),
        "source": str(loc_path),
        "totalLocalizedKeys": len(rows),
        "totalGroups": len(grouped),
        "leaderSkillCount": leader_skills["count"],
        "leaderBuffSourceCount": leader_skills.get("leaderBuffSourceCount", 0),
        "missingLeaderBuffLocalizations": leader_skills.get("missingLeaderBuffLocalizations", [])[:60],
        "legacyLeaderSkillCount": leader_skills.get("legacyCount", 0),
        "legacyLeaderSkillSource": leader_skills.get("legacySource"),
        "knownSourceIds": {cat: len(ids) for cat, ids in known.items()},
        "categoryCounts": {cat: len(by_category.get(cat, [])) for cat in CATEGORY_ORDER},
        "leaderSkillFilter": leader_skills.get("filter", {}),
        "rejectedPassiveSamples": leader_skills.get("rejectedPassiveSamples", []),
        "sampleLeaderSkills": list(leader_skills["skills"].values())[:20],
        "sampleLegacyLeaderSkills": list(leader_skills.get("legacyByCharacter", {}).values())[:20],
        "sampleGroups": {cat: by_category.get(cat, [])[:10] for cat in CATEGORY_ORDER},
    }

    write_json(output_dir / "localizable_groups.json", {"schemaVersion": 6, "count": len(grouped), "groups": grouped})
    write_json(output_dir / "localizable_groups_by_category.json", {"schemaVersion": 6, "categories": by_category})
    write_json(output_dir / "leader_skill_localization.json", leader_skills)
    write_json(output_dir / "localizable_group_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
