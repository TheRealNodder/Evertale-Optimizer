#!/usr/bin/env python3
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

ROOT_MARKERS = ["apkfiles", "tools"]
ENTRIES_REL = "apkfiles/entries"
REPORT_REL = "apkfiles/entries/reports/master_field_contract_audit_report.json"

CATEGORIES = ["characters", "weapons", "accessories", "bosses"]

CRITICAL_FIELDS = {
    "characters": ["id", "sourceId", "name", "category", "image", "raw"],
    "weapons": ["id", "sourceId", "name", "category", "image", "raw"],
    "accessories": ["id", "sourceId", "name", "category", "image", "raw"],
    "bosses": ["id", "sourceId", "name", "category", "image", "raw"],
}

VISIBLE_FIELDS = {
    "characters": ["title", "description", "rarity", "element", "stats"],
    "weapons": ["description", "rarity", "weaponType", "stats"],
    "accessories": ["description", "rarity", "stats"],
    "bosses": ["description", "rarity", "element", "stats"],
}

STAT_FIELDS = ["atk", "hp", "spd", "cost"]
FIELD_ALIASES = {
    "sourceId": ["sourceId", "internal.sourceId"],
}
RUNTIME_REL = "apkfiles/entries/runtime/optimizer_runtime_model.json"
BUNDLE_RELS = {
    "characters": "apkfiles/entries/bundles/characters.bundle.json",
    "weapons": "apkfiles/entries/bundles/weapons.bundle.json",
    "accessories": "apkfiles/entries/bundles/accessories.bundle.json",
    "bosses": "apkfiles/entries/bundles/bosses.bundle.json",
    "characterFamilies": "apkfiles/entries/bundles/character_families.bundle.json",
}


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root")


def read_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def is_missing(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def nested_get(row: Dict[str, Any], dotted: str) -> Any:
    cur: Any = row
    for part in dotted.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def contract_value(row: Dict[str, Any], field: str) -> Any:
    for candidate in FIELD_ALIASES.get(field, [field]):
        value = nested_get(row, candidate)
        if not is_missing(value):
            return value
    return None


def normalize_entries_payload(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for key in ("entries", "items", "characters", "weapons", "accessories", "bosses"):
            value = payload.get(key)
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]
    return []


def entry_paths(entries_root: Path, category: str, index_payload: Dict[str, Any]) -> List[Path]:
    category_root = entries_root / category
    rows = normalize_entries_payload(index_payload)
    paths: List[Path] = []
    for row in rows:
        rel = str(row.get("file") or "").strip()
        if rel:
            paths.append(category_root / rel.replace("entries/", "entries/", 1))
    if paths:
        return paths
    entries_dir = category_root / "entries"
    return sorted(entries_dir.glob("*.json")) if entries_dir.exists() else []


def key_for(row: Dict[str, Any], path: Path) -> str:
    return str(row.get("sourceId") or row.get("id") or row.get("name") or path.name)


def check_stats(category: str, row: Dict[str, Any], key: str, warnings: List[str]) -> None:
    stats = row.get("stats")
    if not isinstance(stats, dict):
        warnings.append(f"[{category}] {key}: stats is missing or not an object")
        return
    for field in STAT_FIELDS:
        if field not in stats:
            warnings.append(f"[{category}] {key}: stats.{field} is missing")


def check_character_states(row: Dict[str, Any], key: str, warnings: List[str]) -> None:
    variants = row.get("imageVariants")
    if variants is not None and not isinstance(variants, list):
        warnings.append(f"[characters] {key}: imageVariants exists but is not a list")
    forms = row.get("forms")
    if forms is not None and not isinstance(forms, list):
        warnings.append(f"[characters] {key}: forms exists but is not a list")
    family = row.get("family") or nested_get(row, "internal.family")
    if family and not variants:
        warnings.append(f"[characters] {key}: no imageVariants found for family/state flow")


def check_skills(category: str, row: Dict[str, Any], key: str, warnings: List[str]) -> None:
    if category != "characters":
        return
    refs = row.get("refs") if isinstance(row.get("refs"), dict) else {}
    resolved = row.get("resolved") if isinstance(row.get("resolved"), dict) else {}
    active_refs = refs.get("activeSkills") if isinstance(refs.get("activeSkills"), list) else []
    passive_refs = refs.get("passives") if isinstance(refs.get("passives"), list) else []
    if active_refs and not isinstance(resolved.get("activeSkills"), dict):
        warnings.append(f"[characters] {key}: activeSkills refs exist but resolved.activeSkills is missing")
    if passive_refs and not isinstance(resolved.get("passives"), dict):
        warnings.append(f"[characters] {key}: passive refs exist but resolved.passives is missing")


def audit_entries(repo: Path) -> Tuple[Dict[str, Any], List[str], List[str]]:
    entries_root = repo / ENTRIES_REL
    summary: Dict[str, Any] = {}
    errors: List[str] = []
    warnings: List[str] = []

    for category in CATEGORIES:
        index_path = entries_root / category / "index.json"
        index_payload = read_json(index_path, {}) or {}
        paths = entry_paths(entries_root, category, index_payload)
        checked = 0
        placeholder_count = 0
        for path in paths:
            row = read_json(path, None)
            if not isinstance(row, dict):
                errors.append(f"[{category}] {path.relative_to(repo).as_posix()}: file is not valid JSON object")
                continue
            checked += 1
            key = key_for(row, path)
            if row.get("placeholder"):
                placeholder_count += 1
            for field in CRITICAL_FIELDS[category]:
                if is_missing(contract_value(row, field)):
                    errors.append(f"[{category}] {key}: critical field {field} is missing")
                elif field == "sourceId" and is_missing(nested_get(row, "sourceId")):
                    warnings.append(f"[{category}] {key}: sourceId is supplied by internal.sourceId; regenerate entries to promote top-level sourceId")
            for field in VISIBLE_FIELDS[category]:
                if is_missing(nested_get(row, field)):
                    warnings.append(f"[{category}] {key}: visible field {field} is missing")
            check_stats(category, row, key, warnings)
            check_character_states(row, key, warnings) if category == "characters" else None
            check_skills(category, row, key, warnings)
        summary[category] = {
            "index": index_path.relative_to(repo).as_posix(),
            "indexCount": int(index_payload.get("count") or len(normalize_entries_payload(index_payload)) or 0) if isinstance(index_payload, dict) else 0,
            "checked": checked,
            "placeholders": placeholder_count,
        }
        if summary[category]["indexCount"] and summary[category]["indexCount"] != checked:
            warnings.append(f"[{category}] index count {summary[category]['indexCount']} does not match checked entries {checked}")
    return summary, errors, warnings


def audit_bundles(repo: Path) -> Tuple[Dict[str, Any], List[str], List[str]]:
    out: Dict[str, Any] = {}
    errors: List[str] = []
    warnings: List[str] = []
    for key, rel in BUNDLE_RELS.items():
        path = repo / rel
        payload = read_json(path, None)
        if not isinstance(payload, dict):
            errors.append(f"[bundle] {rel}: missing or invalid")
            out[key] = {"present": False, "count": 0}
            continue
        rows = normalize_entries_payload(payload)
        count = int(payload.get("count") or len(rows) or 0)
        out[key] = {"present": True, "count": count, "entries": len(rows), "schemaVersion": payload.get("schemaVersion")}
        if count and rows and count != len(rows):
            warnings.append(f"[bundle] {rel}: declared count {count} does not match entries {len(rows)}")
    return out, errors, warnings


def audit_runtime(repo: Path) -> Tuple[Dict[str, Any], List[str], List[str]]:
    path = repo / RUNTIME_REL
    runtime = read_json(path, None)
    if not isinstance(runtime, dict):
        return {"present": False}, [f"[runtime] {RUNTIME_REL}: missing or invalid"], []
    required = ["characters", "characterEntries", "weapons", "accessories", "bosses", "tags", "runtimeFlags"]
    errors: List[str] = []
    warnings: List[str] = []
    for field in required:
        if field not in runtime:
            errors.append(f"[runtime] missing {field}")
    flags = runtime.get("runtimeFlags") if isinstance(runtime.get("runtimeFlags"), dict) else {}
    for flag in ("usesAI", "usesScalers", "usesStatuses", "usesPassives", "usesLeaderSkills", "usesSummons", "usesTags"):
        if flag not in flags:
            warnings.append(f"[runtime] runtimeFlags.{flag} missing")
    return {
        "present": True,
        "schemaVersion": runtime.get("schemaVersion"),
        "characters": len(runtime.get("characters") or {}),
        "characterEntries": len(runtime.get("characterEntries") or {}),
        "weapons": len(runtime.get("weapons") or {}),
        "accessories": len(runtime.get("accessories") or {}),
        "bosses": len(runtime.get("bosses") or {}),
        "tags": len(runtime.get("tags") or {}),
    }, errors, warnings


def main() -> int:
    repo = find_repo_root(Path(__file__).resolve())
    entry_summary, entry_errors, entry_warnings = audit_entries(repo)
    bundle_summary, bundle_errors, bundle_warnings = audit_bundles(repo)
    runtime_summary, runtime_errors, runtime_warnings = audit_runtime(repo)

    errors = entry_errors + bundle_errors + runtime_errors
    warnings = entry_warnings + bundle_warnings + runtime_warnings
    report = {
        "schemaVersion": 1,
        "generatedAt": int(time.time()),
        "status": "ok" if not errors else "failed",
        "purpose": "Master Control field contract audit for Catalog, Roster, and Optimizer readiness.",
        "entrySummary": entry_summary,
        "bundleSummary": bundle_summary,
        "runtimeSummary": runtime_summary,
        "errors": errors[:500],
        "warnings": warnings[:500],
        "warningCount": len(warnings),
        "errorCount": len(errors),
        "rules": [
            "Critical fields must exist before data is considered safe for site runtime.",
            "Visible-field warnings identify missing display or optimizer context but do not fail the run.",
            "Raw source payload must be preserved so future extractors can promote newly discovered fields without data loss.",
        ],
    }
    write_json(repo / REPORT_REL, report)
    print(json.dumps({"status": report["status"], "errors": len(errors), "warnings": len(warnings), "report": REPORT_REL}, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
