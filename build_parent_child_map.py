#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT_MARKERS = ["apkfiles", "tools"]
STATE_SUFFIX_RE = re.compile(r"^(.*?)(\d{2})$")
CHILD_HINT_RE = re.compile(r"(rabbit|angel|raven|clone|doll|summon|minion|shadow|imposter|beastshikigami|yandere|maid|exchange|token)", re.I)


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for folder in [current] + list(current.parents):
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate Evertale-Optimizer repo root.")


def load_json(path: Path, default: Any = None) -> Any:
    if not path.exists() or path.stat().st_size == 0:
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return default


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def strip_state(value: Any) -> str:
    raw = str(value or "").strip()
    match = STATE_SUFFIX_RE.match(raw)
    return match.group(1) if match else raw


def norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", strip_state(value).lower())


def source_id_from_entry(entry: Dict[str, Any], fallback: str = "") -> str:
    internal = entry.get("internal") if isinstance(entry.get("internal"), dict) else {}
    raw = entry.get("raw") if isinstance(entry.get("raw"), dict) else {}
    return str(internal.get("sourceId") or entry.get("sourceId") or raw.get("name") or entry.get("name") or entry.get("id") or fallback).strip()


def family_from_entry(entry: Dict[str, Any], fallback: str = "") -> str:
    internal = entry.get("internal") if isinstance(entry.get("internal"), dict) else {}
    raw = entry.get("raw") if isinstance(entry.get("raw"), dict) else {}
    source_id = source_id_from_entry(entry, fallback)
    return str(entry.get("family") or internal.get("family") or raw.get("family") or strip_state(source_id) or fallback).strip()


def add_alias(alias: Dict[str, str], key_value: Any, family: str) -> None:
    family = str(family or "").strip()
    if not family:
        return
    for value in {str(key_value or "").strip(), strip_state(key_value), family, strip_state(family)}:
        k = norm(value)
        if k and k not in alias:
            alias[k] = family


def load_family_rows(repo: Path, entries_root: Path) -> List[Dict[str, Any]]:
    bundle = load_json(entries_root / "bundles" / "character_families.bundle.json", {})
    rows = bundle.get("entries", []) if isinstance(bundle, dict) and isinstance(bundle.get("entries"), list) else []
    if rows:
        return rows

    index = load_json(entries_root / "characters" / "families" / "index.json", {})
    out: List[Dict[str, Any]] = []
    for row in index.get("entries", []) if isinstance(index, dict) else []:
        rel = str(row.get("file") or "").replace("\\", "/").lstrip("./")
        if not rel:
            continue
        if rel.startswith("families/"):
            rel = rel.split("/", 1)[1]
        payload = load_json(entries_root / "characters" / "families" / rel, None)
        if isinstance(payload, dict):
            out.append(payload)
    return out


def build_aliases(repo: Path, entries_root: Path) -> Tuple[Dict[str, str], Dict[str, Dict[str, Any]]]:
    aliases: Dict[str, str] = {}
    families: Dict[str, Dict[str, Any]] = {}

    for fam in load_family_rows(repo, entries_root):
        family = str(fam.get("family") or fam.get("id") or "").strip()
        if not family:
            continue
        families[family] = fam
        for value in [family, fam.get("name"), fam.get("displayName"), fam.get("title")]:
            add_alias(aliases, value, family)
        for source in fam.get("rawFormSourceIds", []) if isinstance(fam.get("rawFormSourceIds"), list) else []:
            add_alias(aliases, source, family)
        for source in fam.get("formSourceIds", []) if isinstance(fam.get("formSourceIds"), list) else []:
            add_alias(aliases, source, family)
        for state in fam.get("states", []) if isinstance(fam.get("states"), list) else []:
            if not isinstance(state, dict):
                continue
            for value in [state.get("sourceId"), state.get("dataSourceId"), state.get("imageSourceId"), state.get("name"), state.get("title")]:
                add_alias(aliases, value, family)

    char_index = load_json(entries_root / "characters" / "index.json", {})
    for row in char_index.get("entries", []) if isinstance(char_index, dict) else []:
        rel = str(row.get("file") or "").replace("\\", "/").lstrip("./")
        if not rel:
            continue
        if not rel.startswith("entries/"):
            rel = "entries/" + rel
        payload = load_json(entries_root / "characters" / rel, None)
        if not isinstance(payload, dict):
            continue
        fallback = Path(rel).stem
        family = family_from_entry(payload, fallback)
        for value in [family, source_id_from_entry(payload, fallback), payload.get("name"), payload.get("displayName"), payload.get("title"), fallback]:
            add_alias(aliases, value, family)
        families.setdefault(family, {"family": family, "name": payload.get("name") or family})

    return aliases, families


def canonical(value: Any, aliases: Dict[str, str]) -> str:
    k = norm(value)
    return aliases.get(k) or strip_state(value)


def child_score(family: str) -> int:
    score = 0
    if CHILD_HINT_RE.search(family):
        score += 100
    if re.search(r"(regular|bride|swimsuit|dark|christmas|valentine|ballet)$", family, re.I):
        score -= 10
    return score


def add_edge(edges: Dict[str, set[str]], parent: str, child: str) -> None:
    if not parent or not child or parent == child:
        return
    edges.setdefault(parent, set()).add(child)


def add_relationship_map(edges: Dict[str, set[str]], labels: Dict[str, str], aliases: Dict[str, str], map_name: str, mapping: Any, preferred: set[str]) -> int:
    if not isinstance(mapping, dict):
        return 0
    added = 0
    for parent_raw, children in mapping.items():
        if not isinstance(children, list):
            continue
        parent = canonical(parent_raw, aliases)
        if not parent:
            continue
        for child_raw in children:
            child = canonical(child_raw, aliases)
            if not child or child == parent:
                continue
            add_edge(edges, parent, child)
            labels.setdefault(parent, "Forms")
            added += 1
    return added


def build_edges(repo: Path, aliases: Dict[str, str]) -> Tuple[Dict[str, set[str]], Dict[str, str], List[Dict[str, Any]], List[str]]:
    duo = load_json(repo / "apkfiles" / "Duo.json", {}) or {}
    display = load_json(repo / "apkfiles" / "DuoDisplay.json", {}) or {}
    edges: Dict[str, set[str]] = {}
    labels: Dict[str, str] = {}
    issues: List[Dict[str, Any]] = []
    source_maps: List[str] = []
    preferred: set[str] = set()

    parent_cards = display.get("parentCards", {}) if isinstance(display, dict) else {}
    if isinstance(parent_cards, dict):
        source_maps.append("DuoDisplay.parentCards")
        for parent_raw, cfg in parent_cards.items():
            parent = canonical(parent_raw, aliases)
            preferred.add(parent)
            labels[parent] = str((cfg or {}).get("buttonLabel") or "Forms")
            children = (cfg or {}).get("children", []) if isinstance(cfg, dict) else []
            for child_raw in children if isinstance(children, list) else []:
                child = canonical(child_raw, aliases)
                add_edge(edges, parent, child)

    if isinstance(duo, dict):
        for map_name, mapping in duo.items():
            if not isinstance(mapping, dict):
                continue
            added = add_relationship_map(edges, labels, aliases, map_name, mapping, preferred)
            if added:
                source_maps.append(f"Duo.{map_name}")

    return edges, labels, issues, source_maps


def main() -> int:
    parser = argparse.ArgumentParser(description="Build authoritative parent/child merge map for Evertale catalog frontends.")
    parser.add_argument("--entries-root", default="apkfiles/entries")
    args = parser.parse_args()

    repo = find_repo_root(Path.cwd())
    entries_root = (repo / args.entries_root).resolve() if not Path(args.entries_root).is_absolute() else Path(args.entries_root).resolve()
    maps_dir = entries_root / "maps"
    reports_dir = entries_root / "reports"

    aliases, families = build_aliases(repo, entries_root)
    edges, labels, issues, source_maps = build_edges(repo, aliases)

    parents = {parent: sorted(children) for parent, children in sorted(edges.items()) if children}
    child_to_parents: Dict[str, List[str]] = {}
    for parent, kids in parents.items():
        for child in kids:
            child_to_parents.setdefault(child, []).append(parent)
    children = {child: sorted(parent_list) for child, parent_list in sorted(child_to_parents.items())}
    groups = []
    for parent, kids in parents.items():
        groups.append({
            "parent": parent,
            "children": kids,
            "members": [parent, *kids],
            "buttonLabel": labels.get(parent, "Forms"),
            "parentName": families.get(parent, {}).get("name") or parent,
            "childNames": {child: families.get(child, {}).get("name") or child for child in kids},
        })

    payload = {
        "schemaVersion": 2,
        "generatedAt": int(time.time()),
        "source": source_maps,
        "parents": parents,
        "children": children,
        "groups": groups,
        "aliases": aliases,
        "counts": {
            "parents": len(parents),
            "children": len(children),
            "groups": len(groups),
            "aliases": len(aliases),
            "families": len(families),
        },
    }
    write_json(maps_dir / "character_parent_child_map.json", payload)

    report = {
        "schemaVersion": 2,
        "generatedAt": payload["generatedAt"],
        "status": "ok" if not issues else "warning",
        "counts": payload["counts"],
        "issues": issues,
        "sourceMaps": source_maps,
        "victoriaPresentInAliases": "victoriaregular" in aliases,
        "outputs": ["apkfiles/entries/maps/character_parent_child_map.json"],
    }
    write_json(reports_dir / "parent_child_map_report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] in {"ok", "warning"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
