#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List

from path_utils import configure_utf8_stdio

ROOT_MARKERS = ["apkfiles", "tools"]
CATEGORIES = ["characters", "weapons", "accessories", "bosses"]
# All ordinary categories are append-only. Weapons intentionally collapse raw
# state rows into one visible card per family and validate through their
# dedicated family-bundle contract below.
STRICT_INDEX_CATEGORIES: set[str] = set()
REQUIRED_MARKERS = [
    "run_entry_pipeline_all.marker.json",
    "build_character_image_map.marker.json",
    "sync_character_tags.marker.json",
]
EXCLUDED_PATH_PARTS = {"legacy", "Legacy", "_weapon_duplicate_quarantine", "_boss_duplicate_quarantine", "_duplicate_quarantine"}
WEAPON_FAMILY_MODE = "weapon_family_handle_source_of_truth"


def find_repo_root(start: Path):
    current = start.resolve()
    for folder in [current] + list(current.parents):
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    return None


def load_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def resolve_entry_path(base: Path, category_dir: Path, rel_file: str) -> Path:
    rel = str(rel_file or "").replace("\\", "/").strip()
    if rel.startswith("entries/"):
        return category_dir / rel
    category_relative = category_dir / rel
    if category_relative.exists():
        return category_relative
    return base / rel


def is_excluded_path(path: Path) -> bool:
    return path.name.startswith("_") or path.name.endswith("_report.json") or any(part in EXCLUDED_PATH_PARTS or part.startswith("_") for part in path.parts)


def source_id_from_entry(data: Dict[str, Any], fallback: str = "") -> str:
    internal = data.get("internal") if isinstance(data.get("internal"), dict) else {}
    return str(internal.get("sourceId") or data.get("sourceId") or data.get("name") or data.get("id") or fallback).strip()


def row_identity(row: Any) -> str:
    if not isinstance(row, dict):
        return str(row or "").strip()
    internal = row.get("internal") if isinstance(row.get("internal"), dict) else {}
    for key in ("sourceId", "family", "id", "name", "handle", "file"):
        value = internal.get(key) if key in internal else row.get(key)
        if value:
            return str(value).strip()
    return ""


def entry_file_ids(category_dir: Path) -> Dict[str, str]:
    discovered: Dict[str, str] = {}
    entries_dir = category_dir / "entries"
    if not entries_dir.exists():
        return discovered
    for path in sorted(entries_dir.glob("*.json")):
        if not path.is_file() or is_excluded_path(path):
            continue
        data = load_json(path, None)
        if not isinstance(data, dict):
            continue
        source_id = source_id_from_entry(data, path.stem)
        if source_id:
            discovered[source_id] = path.name
    return discovered


def published_source_ids(entries: List[Dict[str, Any]], category: str) -> set[str]:
    published: set[str] = set()
    for entry in entries:
        source_id = row_identity(entry)
        if source_id:
            published.add(source_id)
        if category == "weapons":
            for state in entry.get("states", []) if isinstance(entry, dict) else []:
                state_id = row_identity(state)
                if state_id:
                    published.add(state_id)
    return published


def file_handle_order(file_value: Any) -> int | None:
    match = re.match(r"^(\d+)_", str(file_value or "").split("/")[-1])
    return int(match.group(1)) if match else None


def weapon_overlay_enabled(bundle: Dict[str, Any]) -> bool:
    discovery = bundle.get("discovery", {}) if isinstance(bundle.get("discovery"), dict) else {}
    overlay = discovery.get("weaponOverlay", {}) if isinstance(discovery.get("weaponOverlay"), dict) else {}
    return bool(overlay.get("enabled"))


def weapon_family_bundle_mode(discovery: Dict[str, Any]) -> bool:
    return str(discovery.get("mode") or "") == WEAPON_FAMILY_MODE


def weapon_expected_visible_count(index_count: int, discovery: Dict[str, Any], count: int) -> int:
    for key in ("count", "familyCount"):
        value = discovery.get(key)
        try:
            if value is not None:
                return int(value)
        except Exception:
            pass
    return count or index_count


def effectively_strict_bundle(category: str, count: int, index_count: int, discovery: Dict[str, Any], bundle: Dict[str, Any]) -> bool:
    if category == "weapons" and weapon_family_bundle_mode(discovery):
        return count == weapon_expected_visible_count(index_count, discovery, count)
    if discovery.get("strictIndexOnly", False):
        return True
    if discovery.get("discoveredUnindexedCount", 0):
        return False
    if category == "weapons" and weapon_overlay_enabled(bundle):
        return True
    return count == index_count


def validate_weapon_family_bundle(category: str, index_count: int, count: int, discovery: Dict[str, Any], errors: List[str], warnings: List[str]) -> bool:
    if category != "weapons" or not weapon_family_bundle_mode(discovery):
        return False

    expected = weapon_expected_visible_count(index_count, discovery, count)
    collapsed = int(discovery.get("collapsedStateCount") or 0)
    family_count = int(discovery.get("familyCount") or expected or 0)

    if count != expected:
        errors.append(f"[weapons] Family bundle count mismatch: expected={expected}, bundle={count}")
    if family_count != count:
        errors.append(f"[weapons] Family discovery count mismatch: familyCount={family_count}, bundle={count}")
    if index_count < count:
        errors.append(f"[weapons] Family bundle has more visible cards than indexed raw rows: index={index_count}, bundle={count}")
    if collapsed <= 0 and index_count > count:
        warnings.append("[weapons] Family bundle is smaller than index but collapsedStateCount is zero")
    return True


def validate_bundle(base: Path, category: str, index_ids: List[str], errors: List[str], warnings: List[str], bundle_counts: Dict[str, Any]) -> None:
    bundle_path = base / "bundles" / f"{category}.bundle.json"
    if not bundle_path.exists():
        errors.append(f"[{category}] Missing bundle: {bundle_path}")
        return
    bundle = load_json(bundle_path, {}) or {}
    entries = bundle.get("entries") if isinstance(bundle, dict) else []
    count = len(entries or []) if isinstance(entries, list) else 0
    index_count = len(index_ids)
    discovery = bundle.get("discovery", {}) if isinstance(bundle.get("discovery"), dict) else {}
    published_ids = published_source_ids(entries or [], category)
    missing_from_bundle = sorted(set(index_ids) - published_ids)
    if missing_from_bundle:
        errors.append(f"[{category}] Indexed entries missing from public bundle: {missing_from_bundle[:25]}")
    bundle_counts[category] = {"schemaVersion": bundle.get("schemaVersion"), "count": count, "sourceIndexCount": bundle.get("sourceIndexCount"), "discovery": discovery, "visibleIds": [row_identity(row) for row in entries or [] if row_identity(row)]}

    if validate_weapon_family_bundle(category, index_count, count, discovery, errors, warnings):
        if bundle.get("schemaVersion", 0) < 3:
            errors.append(f"[{category}] Bundle schemaVersion is stale: {bundle.get('schemaVersion')}")
        if discovery.get("discoveredUnindexedCount", 0):
            errors.append(f"[{category}] Family bundle discovered unindexed entries: {discovery.get('discoveredUnindexedCount')}")
        return

    if count != index_count:
        errors.append(f"[{category}] Public bundle count mismatch: index={index_count}, bundle={count}")

    if category in STRICT_INDEX_CATEGORIES:
        if bundle.get("schemaVersion", 0) < 3:
            errors.append(f"[{category}] Bundle schemaVersion is stale: {bundle.get('schemaVersion')}")
        overlay_ok = category == "weapons" and weapon_overlay_enabled(bundle)
        if count != index_count and not overlay_ok:
            errors.append(f"[{category}] Strict bundle count mismatch: index={index_count}, bundle={count}")
        if discovery.get("discoveredUnindexedCount", 0):
            errors.append(f"[{category}] Strict bundle discovered unindexed entries: {discovery.get('discoveredUnindexedCount')}")
        if not effectively_strict_bundle(category, count, index_count, discovery, bundle):
            errors.append(f"[{category}] Strict bundle missing strictIndexOnly=true")
        elif not discovery.get("strictIndexOnly", False):
            warnings.append(f"[{category}] Bundle is effectively strict but strictIndexOnly metadata is not set")


def expected_catalog_count(category: str, index_expected: int, bundle_counts: Dict[str, Any]) -> int:
    bundle = bundle_counts.get(category, {}) if isinstance(bundle_counts.get(category), dict) else {}
    discovery = bundle.get("discovery", {}) if isinstance(bundle.get("discovery"), dict) else {}
    overlay = discovery.get("weaponOverlay", {}) if isinstance(discovery.get("weaponOverlay"), dict) else {}
    if category == "weapons" and weapon_family_bundle_mode(discovery):
        return int(bundle.get("count") or weapon_expected_visible_count(index_expected, discovery, int(bundle.get("count") or 0)))
    if category == "weapons" and overlay.get("enabled"):
        return int(bundle.get("count") or index_expected)
    return int(bundle.get("count") or index_expected)


def index_ids_for_category(base: Path, category: str) -> List[str]:
    index_path = base / category / "index.json"
    index_data = load_json(index_path, {}) or {}
    rows = index_data.get("entries", []) if isinstance(index_data, dict) else []
    return [row_identity(row) for row in rows if row_identity(row)]


def catalog_ids_for_category(categories: Dict[str, Any], category: str) -> List[str]:
    rows = categories.get(category, []) or []
    return [row_identity(row) for row in rows if row_identity(row)]


def validate_catalog_bundle(base: Path, category_counts: Dict[str, int], errors: List[str], warnings: List[str], bundle_counts: Dict[str, Any]) -> None:
    catalog_path = base / "bundles" / "catalog.bundle.json"
    if not catalog_path.exists():
        errors.append("[catalog] Missing catalog.bundle.json")
        return
    catalog = load_json(catalog_path, {}) or {}
    if catalog.get("schemaVersion", 0) < 3:
        errors.append(f"[catalog] schemaVersion is stale: {catalog.get('schemaVersion')}")
    categories = catalog.get("categories") if isinstance(catalog, dict) else {}
    if not isinstance(categories, dict):
        errors.append("[catalog] categories is not an object")
        return
    for category, index_expected in category_counts.items():
        expected = expected_catalog_count(category, index_expected, bundle_counts)
        actual = len(categories.get(category, []) or [])
        catalog_ids = catalog_ids_for_category(categories, category)
        bundle_ids = bundle_counts.get(category, {}).get("visibleIds", [])
        missing_bundle_rows = sorted(set(bundle_ids) - set(catalog_ids))
        extra_catalog_rows = sorted(set(catalog_ids) - set(bundle_ids))
        if missing_bundle_rows or extra_catalog_rows:
            errors.append(
                f"[catalog] {category} differs from its category bundle; "
                f"missing={missing_bundle_rows[:25]}; extra={extra_catalog_rows[:25]}"
            )
        if actual != expected:
            index_ids = index_ids_for_category(base, category)
            missing = [sid for sid in index_ids if sid not in set(catalog_ids)]
            extra = [sid for sid in catalog_ids if sid not in set(index_ids)]
            message = (
                f"[catalog] Category count mismatch for {category}: expected={expected}, actual={actual}; "
                f"missingFromCatalog={missing[:25]}; extraInCatalog={extra[:25]}"
            )
            errors.append(message)


def validate_markers(base: Path, warnings: List[str]) -> Dict[str, Any]:
    markers_dir = base / "_markers"
    marker_status = {}
    for marker in REQUIRED_MARKERS:
        path = markers_dir / marker
        data = load_json(path, None)
        marker_status[marker] = bool(data)
        if not data:
            warnings.append(f"[markers] Missing marker: {marker}")
    return marker_status


def semantic_source_id(row: Dict[str, Any]) -> str:
    internal = row.get("internal") if isinstance(row.get("internal"), dict) else {}
    return str(row.get("sourceId") or internal.get("sourceId") or "").strip()


def semantic_family(row: Dict[str, Any]) -> str:
    internal = row.get("internal") if isinstance(row.get("internal"), dict) else {}
    source_id = semantic_source_id(row)
    return str(row.get("family") or internal.get("family") or re.sub(r"\d+$", "", source_id)).strip()


def semantic_form_number(row: Dict[str, Any]) -> int:
    match = re.search(r"(\d+)$", semantic_source_id(row))
    return int(match.group(1)) if match else 0


def semantic_stars(row: Dict[str, Any]) -> int:
    raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
    try:
        return int(raw.get("stars") if raw.get("stars") is not None else row.get("stars") or 0)
    except (TypeError, ValueError):
        return 0


def semantic_rarity(stars: int) -> str:
    if stars >= 5:
        return "SSR"
    if stars == 4:
        return "SR"
    if stars == 3:
        return "R"
    return "N"


def append_semantic_failure(errors: List[str], label: str, rows: List[str]) -> None:
    if rows:
        errors.append(f"[semantic] {label}: {len(rows)}; sample={rows[:10]}")


def validate_optimizer_semantics(repo: Path, base: Path, errors: List[str], warnings: List[str]) -> Dict[str, Any]:
    character_bundle = load_json(base / "bundles" / "characters.bundle.json", {})
    family_bundle = load_json(base / "bundles" / "character_families.bundle.json", {})
    runtime = load_json(base / "runtime" / "optimizer_runtime_model.json", {})
    manifest = load_json(base / "runtime" / "optimizer_runtime_manifest.json", {})
    tag_report = load_json(base / "reports" / "tag_sync_report.json", {})
    runtime_report = load_json(base / "reports" / "optimizer_runtime_model_report.json", {})
    entries = [row for row in character_bundle.get("entries", []) if isinstance(row, dict)]
    families = [row for row in family_bundle.get("entries", []) if isinstance(row, dict)]
    family_map = {str(row.get("family") or ""): row for row in families}
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for row in entries:
        grouped.setdefault(semantic_family(row), []).append(row)

    family_rarity_errors: List[str] = []
    entry_rarity_errors: List[str] = []
    state_star_errors: List[str] = []
    leader_count = 0
    for family, forms in grouped.items():
        ordered = sorted(forms, key=lambda row: (semantic_form_number(row) or 9999, semantic_source_id(row)))
        base_form = next((row for row in ordered if semantic_form_number(row) == 1), ordered[0])
        expected = semantic_rarity(semantic_stars(base_form))
        family_row = family_map.get(family, {})
        if family_row.get("rarity") != expected:
            family_rarity_errors.append(f"{family}:{family_row.get('rarity')}!={expected}")
        states = family_row.get("states") if isinstance(family_row.get("states"), list) else []
        state_map = {str(state.get("sourceId") or state.get("dataSourceId") or ""): state for state in states if isinstance(state, dict)}
        for form in forms:
            source_id = semantic_source_id(form)
            if form.get("rarity") != expected:
                entry_rarity_errors.append(f"{source_id}:{form.get('rarity')}!={expected}")
            number = semantic_form_number(form)
            if 0 < number <= 3:
                state = state_map.get(source_id)
                if not state or int(state.get("stars") or 0) != semantic_stars(form):
                    state_star_errors.append(f"{source_id}:state={state.get('stars') if state else None},raw={semantic_stars(form)}")
            refs = form.get("refs") if isinstance(form.get("refs"), dict) else {}
            raw = form.get("raw") if isinstance(form.get("raw"), dict) else {}
            if refs.get("leaderBuff") or raw.get("leaderBuff") or form.get("leaderSkills"):
                leader_count += 1

    append_semantic_failure(errors, "family rarity/base-stars mismatch", family_rarity_errors)
    append_semantic_failure(errors, "entry rarity/family mismatch", entry_rarity_errors)
    append_semantic_failure(errors, "family state/raw-form stars mismatch", state_star_errors)

    expected_entry_keys = {semantic_source_id(row) for row in entries if semantic_source_id(row)}
    runtime_entries = runtime.get("characterEntries") if isinstance(runtime.get("characterEntries"), dict) else {}
    runtime_entry_keys = set(runtime_entries)
    if runtime_entry_keys != expected_entry_keys:
        errors.append(f"[semantic] runtime characterEntries keys/count mismatch: runtime={len(runtime_entry_keys)} source={len(expected_entry_keys)}")
    collisions = runtime.get("identityCollisions") if isinstance(runtime.get("identityCollisions"), list) else []
    if collisions:
        errors.append(f"[semantic] runtime identity collisions: {len(collisions)}")

    flags = runtime.get("runtimeFlags") if isinstance(runtime.get("runtimeFlags"), dict) else {}
    tags = runtime.get("tags") if isinstance(runtime.get("tags"), dict) else {}
    evidence = runtime.get("featureEvidence") if isinstance(runtime.get("featureEvidence"), dict) else {}
    skill_profiles = runtime.get("skillProfiles") if isinstance(runtime.get("skillProfiles"), dict) else {}
    evidence_count = sum(len(rows) for rows in evidence.values() if isinstance(rows, list))
    skill_count = 0
    skill_gain_count = 0
    skill_cost_count = 0
    skill_tu_count = 0
    invalid_skill_profiles: List[str] = []
    skill_profile_fact_mismatches: List[str] = []
    skill_profile_entries_by_element: Dict[str, int] = {}

    def runtime_number(value: Any, fallback: Any = None) -> Any:
        if isinstance(value, bool) or value is None:
            return fallback
        try:
            number = float(value)
        except (TypeError, ValueError):
            return fallback
        if number != number or number in (float("inf"), float("-inf")):
            return fallback
        return int(number) if number.is_integer() else number

    for source_id, profile in skill_profiles.items():
        if source_id not in expected_entry_keys:
            invalid_skill_profiles.append(f"{source_id}:unknown-entry")
        skills = profile.get("skills") if isinstance(profile, dict) and isinstance(profile.get("skills"), list) else []
        for skill in skills:
            if not isinstance(skill, dict):
                invalid_skill_profiles.append(f"{source_id}:non-object-skill")
                continue
            skill_count += 1
            source = str(skill.get("source") or "")
            if "activeSkillsAI" in source or not source.startswith("resolved.activeSkills."):
                invalid_skill_profiles.append(f"{source_id}:{skill.get('id')}:invalid-source")
            for field in ("spiritGain", "spiritCost"):
                value = skill.get(field)
                if not isinstance(value, (int, float)) or isinstance(value, bool) or value < 0 or value > 99:
                    invalid_skill_profiles.append(f"{source_id}:{skill.get('id')}:{field}={value}")
            tu = skill.get("tuCost")
            if tu is not None and (not isinstance(tu, (int, float)) or isinstance(tu, bool) or tu < 0 or tu > 10000):
                invalid_skill_profiles.append(f"{source_id}:{skill.get('id')}:tuCost={tu}")
            skill_gain_count += int((skill.get("spiritGain") or 0) > 0)
            skill_cost_count += int((skill.get("spiritCost") or 0) > 0)
            skill_tu_count += int(tu is not None)
        source_entry = runtime_entries.get(source_id) if isinstance(runtime_entries.get(source_id), dict) else {}
        element = str(source_entry.get("element") or "unknown").lower()
        skill_profile_entries_by_element[element] = skill_profile_entries_by_element.get(element, 0) + 1

    for entry in entries:
        source_id = semantic_source_id(entry)
        profile = skill_profiles.get(source_id) if isinstance(skill_profiles.get(source_id), dict) else {}
        resolved = entry.get("resolved") if isinstance(entry.get("resolved"), dict) else {}
        active = resolved.get("activeSkills") if isinstance(resolved.get("activeSkills"), dict) else {}
        actual_skills = {
            str(skill.get("id") or ""): skill
            for skill in profile.get("skills") or []
            if isinstance(skill, dict) and str(skill.get("id") or "")
        }
        expected_ids = {
            str(payload.get("id") or skill_id)
            for skill_id, payload in active.items()
            if isinstance(payload, dict) and payload.get("found") is not False
        }
        if set(actual_skills) != expected_ids:
            skill_profile_fact_mismatches.append(f"{source_id}:skill-ids")
            continue
        if profile.get("sourceId") != source_id or profile.get("family") != semantic_family(entry):
            skill_profile_fact_mismatches.append(f"{source_id}:profile-identity")
        for skill_id, payload in active.items():
            if not isinstance(payload, dict) or payload.get("found") is False:
                continue
            expected_id = str(payload.get("id") or skill_id)
            actual = actual_skills.get(expected_id, {})
            ability = payload.get("ability") if isinstance(payload.get("ability"), dict) else {}
            config = payload.get("config") if isinstance(payload.get("config"), dict) else {}
            localization = payload.get("localization") if isinstance(payload.get("localization"), dict) else {}
            use_limit = runtime_number(ability.get("useLimit"), 0)
            expected = {
                "name": str(localization.get("name") or expected_id),
                "description": str(localization.get("description") or ""),
                "tuCost": runtime_number(ability.get("tuCost")),
                "spiritGain": max(0, runtime_number(ability.get("spiritGain"), 0)),
                "spiritCost": max(0, runtime_number(ability.get("spiritCost"), 0)),
                "useLimit": use_limit if use_limit and use_limit > 0 else None,
                "targeting": str(config.get("targetingData") or ""),
                "useCondition": str(config.get("useCondition") or ""),
                "flags": [str(value) for value in config.get("flags") or []] if isinstance(config.get("flags"), list) else [],
                "components": [str(value) for value in config.get("components") or []] if isinstance(config.get("components"), list) else [],
                "source": f"resolved.activeSkills.{skill_id}",
            }
            for field, expected_value in expected.items():
                if actual.get(field) != expected_value:
                    skill_profile_fact_mismatches.append(f"{source_id}:{expected_id}:{field}")
                    break
    feature_counts: Dict[str, int] = {}
    invalid_feature_sources: List[str] = []
    for source_id, evidence_rows in evidence.items():
        for item in evidence_rows if isinstance(evidence_rows, list) else []:
            if not isinstance(item, dict):
                continue
            feature = str(item.get("feature") or "")
            feature_counts[feature] = feature_counts.get(feature, 0) + 1
            source_blob = " ".join(str(value) for value in item.get("sources") or []).lower()
            if any(token in source_blob for token in ("activeskillsai", "revengeeffectstoskip", "immunitylist")):
                invalid_feature_sources.append(f"{source_id}:{feature}:negative-or-AI-context")
            if feature == "applies_burn" and "frostburn" in source_blob:
                invalid_feature_sources.append(f"{source_id}:{feature}:frostburn-is-not-burn-setup")
            if feature == "role_healer" and "healthy" in source_blob:
                invalid_feature_sources.append(f"{source_id}:{feature}:healthy-substring")
    if bool(tags) != bool(flags.get("usesTags")):
        errors.append("[semantic] runtimeFlags.usesTags is not truthful")
    if bool(evidence) != bool(flags.get("usesFeatureEvidence")):
        errors.append("[semantic] runtimeFlags.usesFeatureEvidence is not truthful")
    if bool(skill_profiles) != bool(flags.get("usesSkillProfiles")):
        errors.append("[semantic] runtimeFlags.usesSkillProfiles is not truthful")
    if not evidence:
        errors.append("[semantic] resolved character data produced no feature evidence")
    if not skill_profiles:
        errors.append("[semantic] resolved character data produced no structured skill profiles")
    append_semantic_failure(errors, "invalid structured skill profiles", invalid_skill_profiles)
    append_semantic_failure(errors, "structured skill profile/raw fact mismatch", skill_profile_fact_mismatches)
    append_semantic_failure(errors, "context-invalid feature evidence", invalid_feature_sources)
    required_features = {
        "applies_burn", "payoff_burn", "applies_poison", "payoff_poison",
        "applies_sleep", "payoff_sleep", "applies_stun", "payoff_stun",
        "summon", "payoff_blood", "payoff_crisis", "payoff_survivor",
        "role_guardian", "role_healer", "role_cleanser", "role_reviver",
        "resource_spirit", "tempo_turn", "leader",
    }
    missing_features = sorted(required_features - set(feature_counts))
    if missing_features:
        errors.append(f"[semantic] runtime feature authorities missing: {missing_features}")
    if entries and feature_counts.get("payoff_stun", 0) >= len(entries) * 0.25:
        errors.append("[semantic] Time Strike evidence is implausibly broad; check AI target metadata")
    if entries and feature_counts.get("role_healer", 0) >= len(entries) * 0.60:
        errors.append("[semantic] healer evidence is implausibly broad; check healthy substring matching")
    if not tags:
        warnings.append("[semantic] curated tags are empty; feature evidence is the active fallback authority")
    if tag_report.get("status") not in {"ok", "warning", "failed"}:
        errors.append("[semantic] tag sync report has no explicit status")
    if runtime_report.get("status") not in {"ok", "warning", "failed"}:
        errors.append("[semantic] runtime model report has no explicit status")

    manifest_chunks = manifest.get("chunks") if isinstance(manifest.get("chunks"), dict) else {}
    for chunk in ("characters", "characterEntries", "featureEvidence", "skillProfiles", "tags", "optimizerKnowledge"):
        if chunk not in manifest_chunks:
            errors.append(f"[semantic] runtime manifest missing {chunk} chunk")
    if manifest_chunks.get("characterEntries", {}).get("count") != len(expected_entry_keys):
        errors.append("[semantic] runtime manifest characterEntries count is stale")
    if manifest_chunks.get("featureEvidence", {}).get("count") != len(evidence):
        errors.append("[semantic] runtime manifest featureEvidence count is stale")
    if manifest_chunks.get("skillProfiles", {}).get("count") != len(skill_profiles):
        errors.append("[semantic] runtime manifest skillProfiles count is stale")
    if leader_count and not flags.get("usesLeaderSkills"):
        errors.append("[semantic] leader authority exists but runtimeFlags.usesLeaderSkills is false")

    parent_child = load_json(base / "maps" / "character_parent_child_map.json", {})
    parent_edges = {
        str(parent): {str(child) for child in children}
        for parent, children in (parent_child.get("parents") or {}).items()
        if isinstance(children, list)
    }
    reciprocal_parent_edges = sorted(
        (parent, child)
        for parent, children in parent_edges.items()
        for child in children
        if parent < child and parent in parent_edges.get(child, set())
    )
    if reciprocal_parent_edges:
        errors.append(
            f"[semantic] reciprocal parent/child directions hide both playable forms: {reciprocal_parent_edges[:10]}"
        )

    doctrine = (repo / "optimizer_doctrine.js").read_text(encoding="utf-8")
    shared = (repo / "optimizer-v5-lab" / "optimizer-v5-shared.js").read_text(encoding="utf-8")
    duplicate_guard = (repo / "optimizer-v5-lab" / "optimizer-duplicate-guard.js").read_text(encoding="utf-8")
    policy_checks = {
        "story5Main3Back": "story: { main: 5, back: 3 }" in doctrine and "STORY_MAIN:5" in shared and "STORY_BACK:3" in shared,
        "platoons20x5": "platoons: { count: 20, size: 5 }" in doctrine and "PLATOONS:20" in shared and "PLATOON_SIZE:5" in shared,
        "leaderAll8BestOnly": 'appliesTo: "all_8"' in doctrine and 'stacking: "best_only"' in doctrine,
        "rainbowMinimum4": "storyDistinctElementsMin:4" in doctrine,
        "strictDuplicateIdentity": all(token in duplicate_guard for token in ("entry", "family", "name")),
    }
    for name, passed in policy_checks.items():
        if not passed:
            errors.append(f"[semantic] optimizer policy contract failed: {name}")

    return {
        "characterEntries": len(entries),
        "characterFamilies": len(families),
        "runtimeCharacterEntries": len(runtime_entry_keys),
        "runtimeTags": len(tags),
        "featureEvidenceEntries": len(evidence),
        "featureEvidenceItems": evidence_count,
        "featureEvidenceByFeature": dict(sorted(feature_counts.items())),
        "skillProfileEntries": len(skill_profiles),
        "skillProfileSkills": skill_count,
        "skillProfilesWithSpiritGain": skill_gain_count,
        "skillProfilesWithSpiritCost": skill_cost_count,
        "skillProfilesWithTU": skill_tu_count,
        "invalidSkillProfiles": len(invalid_skill_profiles),
        "skillProfileFactMismatches": len(skill_profile_fact_mismatches),
        "skillProfileEntriesByElement": dict(sorted(skill_profile_entries_by_element.items())),
        "contextInvalidFeatureEvidence": len(invalid_feature_sources),
        "leaderEntries": leader_count,
        "familyRarityMismatches": len(family_rarity_errors),
        "entryRarityMismatches": len(entry_rarity_errors),
        "stateStarMismatches": len(state_star_errors),
        "reciprocalParentChildEdges": len(reciprocal_parent_edges),
        "policyChecks": policy_checks,
    }


def validate(include_optimizer_semantics: bool = True) -> int:
    configure_utf8_stdio()
    repo_root = find_repo_root(Path(__file__).resolve())
    if not repo_root:
        print("ERROR: Could not locate Evertale-Optimizer repo root.")
        return 1
    base = repo_root / "apkfiles" / "entries"
    errors: List[str] = []
    warnings: List[str] = []
    checked = 0
    category_counts: Dict[str, int] = {}
    bundle_counts: Dict[str, Any] = {}
    duplicate_source_ids: Dict[str, List[str]] = {}

    print("=" * 60)
    print("Evertale Optimizer Entry Validator v8")
    print("=" * 60)
    print(f"Repo Root : {repo_root}")
    print(f"Entries   : {base}")

    if not base.exists():
        print(f"ERROR: Missing entries folder: {base}")
        return 1

    for category in CATEGORIES:
        category_dir = base / category
        index_path = category_dir / "index.json"
        if not category_dir.exists():
            errors.append(f"[{category}] Missing category folder: {category_dir}")
            category_counts[category] = 0
            continue
        index_data = load_json(index_path, None)
        if not isinstance(index_data, dict):
            errors.append(f"[{category}] Missing or invalid index.json")
            category_counts[category] = 0
            continue
        entries = index_data.get("entries", [])
        if not isinstance(entries, list):
            errors.append(f"[{category}] entries is not a list")
            category_counts[category] = 0
            continue
        category_counts[category] = len(entries)
        index_ids = [row_identity(entry) for entry in entries if row_identity(entry)]
        seen_ids: Dict[str, str] = {}
        last_order = 0
        for entry in entries:
            checked += 1
            rel_file = entry.get("file")
            source_id = str(entry.get("sourceId") or entry.get("family") or "UNKNOWN")
            if not rel_file:
                errors.append(f"[{category}] Missing file field in index for sourceId={source_id}")
                continue
            entry_path = resolve_entry_path(base, category_dir, rel_file)
            if is_excluded_path(entry_path):
                errors.append(f"[{category}] Index points to excluded path: {rel_file}")
                continue
            order = int(entry.get("fileHandleOrder") or entry.get("sourceOrder") or entry.get("order") or file_handle_order(rel_file) or 0)
            if order and order < last_order:
                warnings.append(f"[{category}] Non-monotonic order near {rel_file}: {order} after {last_order}")
            last_order = max(last_order, order)
            if source_id in seen_ids:
                duplicate_source_ids.setdefault(category, []).append(source_id)
            else:
                seen_ids[source_id] = rel_file
            if not entry_path.exists():
                errors.append(f"[{category}] Missing entry file: {rel_file} -> checked {entry_path}")
                continue
            data = load_json(entry_path, None)
            if not isinstance(data, dict):
                errors.append(f"[{category}] Invalid JSON: {rel_file}")
                continue
            for field in ["name", "category", "internal"]:
                if field not in data:
                    errors.append(f"[{category}] Missing '{field}' in {rel_file}")
            actual_sid = source_id_from_entry(data, Path(rel_file).stem)
            if category in STRICT_INDEX_CATEGORIES and source_id != "UNKNOWN" and actual_sid and actual_sid != source_id:
                warnings.append(f"[{category}] sourceId mismatch index={source_id} file={actual_sid} in {rel_file}")
            for field in ["_build", "image", "refs", "resolved"]:
                if field not in data:
                    warnings.append(f"[{category}] Missing {field}: {rel_file}")
        generated_files = entry_file_ids(category_dir)
        missing_from_index = sorted(set(generated_files) - set(index_ids))
        if missing_from_index:
            preview = [f"{source_id} ({generated_files[source_id]})" for source_id in missing_from_index[:25]]
            errors.append(f"[{category}] Generated entry files missing from index: {preview}")
        validate_bundle(base, category, index_ids, errors, warnings, bundle_counts)

    validate_catalog_bundle(base, category_counts, errors, warnings, bundle_counts)
    marker_status = validate_markers(base, warnings)
    for category, rows in duplicate_source_ids.items():
        if rows:
            errors.append(f"[{category}] Duplicate sourceIds in index: {len(rows)}")

    semantic_summary = validate_optimizer_semantics(repo_root, base, errors, warnings) if include_optimizer_semantics else {"status": "deferred_until_runtime_rebuild"}
    status = "failed" if errors else "warning" if warnings else "ok"
    report = {"validatorVersion": 8, "generatedAt": int(time.time()), "status": status, "repoRoot": str(repo_root), "entriesRoot": str(base), "checked": checked, "categoryCounts": category_counts, "bundleCounts": bundle_counts, "markerStatus": marker_status, "duplicateSourceIds": duplicate_source_ids, "semanticSummary": semantic_summary, "errors": errors, "warnings": warnings}
    reports_dir = base / "reports"
    write_json(reports_dir / "validation_report.json", report)
    write_json(base / "_markers" / "validate_entries.marker.json", {"schemaVersion": 2, "tool": "validate_entries", "category": "all", "status": status, "lastKey": "validation", "lastSourceId": "", "lastHandle": None, "lastFile": "apkfiles/entries/reports/validation_report.json", "processedCount": checked, "totalCount": checked, "updatedAt": int(time.time()), "extra": {"errors": len(errors), "warnings": len(warnings)}})

    print(f"Checked Entries : {checked}")
    print(f"Errors          : {len(errors)}")
    print(f"Warnings        : {len(warnings)}")
    print(f"Report          : {reports_dir / 'validation_report.json'}")
    if errors:
        print("Top Errors:")
        for err in errors[:20]:
            print("-", err)
    return 1 if errors else 0


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Validate generated Evertale entry and optimizer authorities.")
    parser.add_argument("--structural-only", action="store_true", help="Defer optimizer runtime semantic checks until runtime chunks are rebuilt.")
    args = parser.parse_args()
    raise SystemExit(validate(include_optimizer_semantics=not args.structural_only))
