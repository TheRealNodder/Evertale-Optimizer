#!/usr/bin/env python3
"""
Extract Localizable_English.txt into grouped runtime maps.

Outputs:
  apkfiles/entries/localization/localizable_groups.json
  apkfiles/entries/localization/localizable_groups_by_category.json
  apkfiles/entries/localization/leader_skill_localization.json
  apkfiles/entries/localization/localizable_group_report.json
"""
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, Optional, Set, Tuple

KEY_RE = re.compile(r'^"(?P<key>.*?)"="(?P<value>.*)"$')
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
]
CATEGORY_ORDER = ["characters", "weapons", "accessories", "bosses", "leader_skills", "unknown"]
LEADER_BASE_RE = re.compile(
    r"(LeaderSkill|HPUp|ATKUp|AttackUp|AttackAndHPUp|CostDown|Spirit|SpeedUp|SPDUp|TUCost|DamageReduc|DamageReduction)",
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


def parse_localizable(path: Path) -> Dict[str, str]:
    rows: Dict[str, str] = {}
    for line in read_text(path).splitlines():
        match = KEY_RE.match(line)
        if not match:
            continue
        key = match.group("key")
        value = match.group("value").replace("\\n", "\n").replace('\\"', '"')
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


def is_leader_skill_group(base: str, keys: Dict[str, str]) -> bool:
    if LEADER_BASE_RE.search(base):
        return True
    if "AffectedKey" in keys and ("DescriptionKey" in keys or "NameKey" in keys):
        return True
    return False


def category_from_base(base: str, keys: Dict[str, str], known: Dict[str, Set[str]]) -> str:
    if is_leader_skill_group(base, keys):
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
        group["name"] = keys.get("NameKey", "")
        group["secondName"] = keys.get("SecondNameKey", "")
        group["title"] = keys.get("TitleKey", "") or keys.get("SecondNameKey", "")
        group["subtitle"] = keys.get("SubTitleKey", "")
        group["description"] = keys.get("DescriptionKey", "")
        group["affected"] = keys.get("AffectedKey", "")
        group["profile"] = keys.get("ProfileKey", "")
        group["selected"] = keys.get("SelectedKey", "")
        group["keyCount"] = len(group["rawKeys"])
    return grouped


def build_leader_skill_map(grouped: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    skills: Dict[str, Dict[str, Any]] = {}
    for base, group in grouped.items():
        if group.get("category") != "leader_skills":
            continue
        if not (group.get("name") or group.get("description") or group.get("affected")):
            continue
        skills[base] = {
            "id": base,
            "name": group.get("name", ""),
            "description": group.get("description", ""),
            "affected": group.get("affected", ""),
            "rawKeys": group.get("rawKeys", []),
        }
    return {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "count": len(skills),
        "skills": skills,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=None, help="Path to apkfiles. Auto-detected when omitted.")
    parser.add_argument("--entries", default=None, help="Path to apkfiles/entries. Auto-detected when omitted.")
    parser.add_argument("--output", default=None, help="Output folder. Defaults to apkfiles/entries/localization.")
    args = parser.parse_args()

    repo_root = find_repo_root()
    input_dir = find_apkfiles(repo_root, args.input)
    entries_root = find_entries(repo_root, input_dir, args.entries)
    output_dir = resolve_path(args.output, repo_root, str(entries_root / "localization")) if args.output else (entries_root / "localization").resolve()

    loc_path = find_localizable(input_dir)
    rows = parse_localizable(loc_path)
    known = {cat: load_index_source_ids(entries_root, cat) for cat in ["characters", "weapons", "accessories", "bosses"]}
    grouped = group_rows(rows, known)
    leader_skills = build_leader_skill_map(grouped)

    by_category = {cat: [] for cat in CATEGORY_ORDER}
    for base in sorted(grouped):
        group = grouped[base]
        by_category.setdefault(group["category"], []).append(group)

    report = {
        "schemaVersion": 2,
        "generatedAt": int(time.time()),
        "repoRoot": str(repo_root),
        "input": str(input_dir),
        "entriesRoot": str(entries_root),
        "output": str(output_dir),
        "source": str(loc_path),
        "totalLocalizedKeys": len(rows),
        "totalGroups": len(grouped),
        "leaderSkillCount": leader_skills["count"],
        "knownSourceIds": {cat: len(ids) for cat, ids in known.items()},
        "categoryCounts": {cat: len(by_category.get(cat, [])) for cat in CATEGORY_ORDER},
        "sampleLeaderSkills": list(leader_skills["skills"].values())[:20],
        "sampleGroups": {cat: by_category.get(cat, [])[:10] for cat in CATEGORY_ORDER},
    }

    write_json(output_dir / "localizable_groups.json", {"schemaVersion": 2, "count": len(grouped), "groups": grouped})
    write_json(output_dir / "localizable_groups_by_category.json", {"schemaVersion": 2, "categories": by_category})
    write_json(output_dir / "leader_skill_localization.json", leader_skills)
    write_json(output_dir / "localizable_group_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
