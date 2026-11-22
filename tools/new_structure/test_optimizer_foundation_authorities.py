#!/usr/bin/env python3
"""Semantic regression checks for optimizer data authorities.

These tests intentionally inspect generated output as well as source contracts.
A successful process return code is not sufficient if generated semantics drift.
"""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path
from typing import Any, Dict, Iterable, List

try:
    from .build_optimizer_runtime_model import (
        description_feature_records,
        description_features,
        structured_scaler_polarity_records,
    )
except ImportError:
    from build_optimizer_runtime_model import (
        description_feature_records,
        description_features,
        structured_scaler_polarity_records,
    )


REPO = Path(__file__).resolve().parents[2]
ENTRIES = REPO / "apkfiles" / "entries"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def bundle_entries(name: str) -> List[Dict[str, Any]]:
    payload = read_json(ENTRIES / "bundles" / name)
    rows = payload.get("entries", []) if isinstance(payload, dict) else []
    return [row for row in rows if isinstance(row, dict)]


def source_id(row: Dict[str, Any]) -> str:
    internal = row.get("internal") if isinstance(row.get("internal"), dict) else {}
    return str(row.get("sourceId") or internal.get("sourceId") or "").strip()


def family_id(row: Dict[str, Any]) -> str:
    internal = row.get("internal") if isinstance(row.get("internal"), dict) else {}
    return str(row.get("family") or internal.get("family") or re.sub(r"\d+$", "", source_id(row))).strip()


def form_number(row: Dict[str, Any]) -> int:
    match = re.search(r"(\d+)$", source_id(row))
    return int(match.group(1)) if match else 0


def raw_stars(row: Dict[str, Any]) -> int:
    raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
    try:
        return int(raw.get("stars") if raw.get("stars") is not None else row.get("stars") or 0)
    except (TypeError, ValueError):
        return 0


def expected_rarity(stars: int) -> str:
    if stars >= 5:
        return "SSR"
    if stars == 4:
        return "SR"
    if stars == 3:
        return "R"
    return "N"


def group_by_family(rows: Iterable[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(family_id(row), []).append(row)
    return grouped


class OptimizerFoundationAuthorityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.entries = bundle_entries("characters.bundle.json")
        cls.families = bundle_entries("character_families.bundle.json")
        cls.family_map = {str(row.get("family") or ""): row for row in cls.families}
        cls.grouped = group_by_family(cls.entries)
        cls.runtime = read_json(ENTRIES / "runtime" / "optimizer_runtime_model.json")
        cls.manifest = read_json(ENTRIES / "runtime" / "optimizer_runtime_manifest.json")

    def test_family_and_entry_rarity_come_from_base_stars(self) -> None:
        problems = []
        for family, forms in self.grouped.items():
            ordered = sorted(forms, key=lambda row: (form_number(row) or 9999, source_id(row)))
            base = next((row for row in ordered if form_number(row) == 1), ordered[0])
            rarity = expected_rarity(raw_stars(base))
            family_row = self.family_map.get(family, {})
            if family_row.get("rarity") != rarity:
                problems.append(f"{family}: family={family_row.get('rarity')} expected={rarity}")
            for row in forms:
                if row.get("rarity") != rarity:
                    problems.append(f"{source_id(row)}: entry={row.get('rarity')} expected={rarity}")
        if problems:
            self.fail(f"Rarity mismatches: {len(problems)}\n" + "\n".join(problems[:50]))

    def test_family_states_preserve_actual_raw_form_stars(self) -> None:
        problems = []
        for family, forms in self.grouped.items():
            family_row = self.family_map.get(family, {})
            states = family_row.get("states") if isinstance(family_row.get("states"), list) else []
            state_by_source = {
                str(state.get("sourceId") or state.get("dataSourceId") or ""): state
                for state in states
                if isinstance(state, dict)
            }
            for form in forms:
                number = form_number(form)
                if number <= 0 or number > 3:
                    continue
                sid = source_id(form)
                state = state_by_source.get(sid)
                if not state:
                    problems.append(f"{family}: raw form {sid} missing from family states")
                    continue
                if int(state.get("stars") or 0) != raw_stars(form):
                    problems.append(f"{sid}: state stars={state.get('stars')} raw stars={raw_stars(form)}")
        if problems:
            self.fail(f"Family-state mismatches: {len(problems)}\n" + "\n".join(problems[:50]))

    def test_runtime_character_entries_are_source_indexed_without_collapse(self) -> None:
        expected = {source_id(row) for row in self.entries if source_id(row)}
        actual = set((self.runtime.get("characterEntries") or {}).keys())
        self.assertEqual(len(expected), len(self.entries), "Character bundle contains duplicate source IDs")
        self.assertEqual(actual, expected, "Runtime characterEntries must be keyed by sourceId")
        collisions = self.runtime.get("identityCollisions") or []
        self.assertEqual(collisions, [], f"Runtime identity collisions: {collisions[:10]}")

    def test_runtime_feature_evidence_is_present_and_truthful(self) -> None:
        evidence = self.runtime.get("featureEvidence") or {}
        flags = self.runtime.get("runtimeFlags") or {}
        self.assertTrue(evidence, "Resolved character data must produce feature evidence")
        self.assertEqual(bool(evidence), bool(flags.get("usesFeatureEvidence")))
        tags = self.runtime.get("tags") or {}
        self.assertEqual(bool(tags), bool(flags.get("usesTags")))
        chunks = self.manifest.get("chunks") or {}
        self.assertIn("featureEvidence", chunks)
        self.assertEqual(chunks["featureEvidence"].get("count"), len(evidence))

    def test_runtime_feature_evidence_is_context_aware(self) -> None:
        evidence = self.runtime.get("featureEvidence") or {}

        def features(source: str) -> set[str]:
            return {str(row.get("feature") or "") for row in evidence.get(source, []) if isinstance(row, dict)}

        def feature_sources(source: str, feature: str) -> set[str]:
            return {
                str(receipt)
                for row in evidence.get(source, [])
                if isinstance(row, dict) and row.get("feature") == feature
                for receipt in row.get("sources") or []
            }

        expected = {
            "AstridNew02": {"applies_burn", "payoff_burn"},
            "NobunagaRegular02": {"applies_burn", "payoff_burn"},
            "UnicornRegular02": {"applies_stun", "payoff_survivor", "tempo_turn", "role_cleanser"},
            "CallenBride02": {"applies_sleep", "payoff_sleep", "role_self_sustain"},
            "KingArthurRegular02": {"applies_poison", "payoff_poison", "summon"},
        }
        for source, required in expected.items():
            self.assertTrue(required <= features(source), f"{source} missing {sorted(required - features(source))}")

        self.assertNotIn("applies_burn", features("AnastasiaRegular02"), "Frostburn must not become normal Burn setup")
        self.assertNotIn("applies_burn", features("WashingtonRegular02"), "Frostburn must not become normal Burn setup")
        washington_burn_sources = feature_sources("WashingtonRegular02", "payoff_burn")
        self.assertFalse(
            any("SingleAttackAWashingtonRegular" in source for source in washington_burn_sources),
            "Frostburned-only Compounding Shot must not become a normal Burn payoff",
        )
        self.assertTrue(
            any("LargeBuffAWashingtonRegular" in source for source in washington_burn_sources),
            "Stars of Victory must retain its explicit support for burning allies",
        )
        frostburn_only = description_features("100% damage, plus 100% for each sleeping or frostburned enemy.")
        self.assertIn("payoff_sleep", frostburn_only)
        self.assertNotIn("payoff_burn", frostburn_only, "burned matched inside frostburned")
        self.assertIn("payoff_burn", description_features("500% damage against targets that are burning."))
        for description, feature in (
            ("500% damage if the target is not burning.", "payoff_burn"),
            ("500% damage if the target is non-poisoned.", "payoff_poison"),
            ("500% damage if the target is not sleeping.", "payoff_sleep"),
            ("500% damage if the target is not stunned.", "payoff_stun"),
        ):
            self.assertNotIn(feature, description_features(description), f"negated status invented {feature}")
        self.assertNotIn("payoff_stun", features("FireBird02"), "AI target hints must not invent Time Strike payoff")
        self.assertNotIn("applies_poison", features("HoodedFrog01"), "status immunity lists must not invent Poison setup")
        self.assertNotIn("applies_stun", features("WhiteSnakeGirlDark02"), "stun reduction/caveats must not invent Stun setup")
        for source in ("DeadlyNurse01", "DeadlyNurse02"):
            self.assertNotIn("applies_stun", features(source), "Stun absorption granted to an ally is not enemy Stun setup")
        self.assertIn("applies_poison", features("WhiteSnakeGirlDark02"), "ward removal must not hide the following Mega Poison application")
        self.assertIn("role_team_healer", features("WhiteSnakeGirlDark02"), "team healing scope must be preserved")
        for feature in ("payoff_burn", "payoff_poison", "payoff_sleep"):
            self.assertNotIn(feature, features("VenusRegular02"), "status-removal availability is not a status payoff")
            self.assertNotIn(feature, features("KintaroRegular02"), "a status damage penalty is not a status payoff")
        self.assertIn("applies_frostburn", features("WashingtonRegular02"))
        self.assertIn("payoff_frostburn", features("WashingtonRegular02"))
        self.assertNotIn("applies_burn", features("WashingtonRegular02"), "Frostburn conversion is not immediate Burn setup")
        self.assertIn("role_ally_healer", features("OnionBoy01"), "oneAllyNotMe is ally healing, not team-wide healing")
        self.assertNotIn("role_team_healer", features("OnionBoy01"), "the substring 'all' inside 'ally' is not an all-allies target")
        self.assertIn("role_ally_cleanser", features("MaleKnight01"), "1Ally Purify must retain external cleanse value")
        self.assertNotIn("role_team_cleanser", features("MaleKnight01"), "1Ally Purify is not a team-wide cleanse")
        for source in ("WhiteSnakeGirl01", "HijikataRegular01", "KaguyahimeSwimsuit01", "AnastasiaRegular02"):
            self.assertNotIn("role_guardian", features(source), f"{source} only denies, targets, or bypasses Guardians")
        for source in ("YamatoRegular01", "DonQuixoteRegular01", "ThorRegular01"):
            self.assertIn("role_guardian", features(source), f"{source} has explicit interception authority")
        self.assertIn("applies_poison", features("KaguyahimeDark02"), "Hypnosis has an explicit Mega Poison configuration")
        self.assertNotIn("applies_sleep", features("KaguyahimeDark02"), "Hypnosis loses a turn but does not apply the Sleep status")
        for source in ("ElmKouhaiRegular01", "ElmKouhaiRegular02"):
            self.assertNotIn("payoff_burn", features(source), "unless burning is negative polarity, not Burn payoff")
        self.assertIn("payoff_burn", features("QueenHeartsRegular02"), "lower non-Burn scaler must resolve as Burn payoff")
        self.assertIn("payoff_sleep", features("QueenHeartsRegular02"), "lower non-Sleep scaler must resolve as Sleep payoff")
        self.assertNotIn("penalized_by_burn", features("QueenHeartsRegular02"), "inverted scaler polarity made Queen anti-Burn")
        self.assertIn("penalized_by_burn", features("KintaroRegular02"), "higher non-Burn scaler must retain anti-Burn polarity")
        for source, status in (
            ("NapoleonRegular02", "stun"),
            ("NobunagaRegular02", "stun"),
            ("SatanRegular02", "stun"),
        ):
            self.assertNotIn(
                f"removes_{status}",
                features(source),
                f"{source} mentions {status} setup/ward/immunity but does not remove it",
            )
        christmas = {row["feature"]: row for row in evidence.get("ChristmasCatEar02", [])}
        for status in ("burn", "poison", "sleep"):
            receipts = christmas[f"removes_{status}"]["receipts"]
            self.assertTrue(any(row.get("targetTeam") == "allies" for row in receipts), "allied cleanse target scope was lost")
        self.assertIn("role_team_cleanser", christmas, "all-allies status removal must retain team cleanse value")

        forbidden_sources = ("activeskillsai", "revengeeffectstoskip", "immunitylist")
        problems = []
        for source_id, rows in evidence.items():
            for row in rows if isinstance(rows, list) else []:
                source_blob = " ".join(str(value) for value in row.get("sources") or []).lower()
                if any(token in source_blob for token in forbidden_sources):
                    problems.append(f"{source_id}:{row.get('feature')}:{source_blob}")
                if row.get("feature") == "applies_burn" and "frostburn" in source_blob:
                    problems.append(f"{source_id}: Frostburn setup leak")
                if row.get("feature") == "role_healer" and "healthy" in source_blob:
                    problems.append(f"{source_id}: healthy/heal substring leak")
        self.assertEqual(problems, [], "Context-invalid evidence:\n" + "\n".join(problems[:50]))

    def test_description_parser_polarity_and_event_direction(self) -> None:
        for text in (
            "Effects may interrupt the turn (e.g. Stuns targeting the lowest TU target).",
            "Reduces the amount of any stun effects this unit receives by 50TU.",
            "Whenever an ally would be affected by stun, this unit takes the stun instead.",
            "This unit has Stun Immunity and a Stun Ward.",
        ):
            self.assertNotIn("applies_stun", description_features(text), text)
        self.assertIn("applies_stun", description_features("Stuns 2 random enemies for 50TU."))
        self.assertNotIn("applies_poison", description_features("Poison cannot be applied to this unit."))
        self.assertIn(
            "applies_poison",
            description_features("Targets have their Poison Wards removed, then are granted Mega Poison for 200TU."),
        )
        penalty = "700% damage. Minus 100% damage for each sleeping, burning or poisoned ally."
        self.assertFalse({"payoff_burn", "payoff_poison", "payoff_sleep"} & set(description_features(penalty)))
        counter = "Heals all allies. Usable if an ally is burning, sleeping or poisoned; those effects are removed."
        self.assertFalse({"payoff_burn", "payoff_poison", "payoff_sleep"} & set(description_features(counter)))
        typed = description_feature_records("When this unit enters the battlefield from allied reinforcements, all allies are healed.")
        self.assertTrue(any(row.get("feature") == "timing_entry_self" and row.get("timing") == "entry" for row in typed))
        for text in (
            "This unit cannot become a Guardian.",
            "500% damage if the target is a Guardian.",
            "This attack cannot be redirected by Guardians.",
        ):
            self.assertNotIn("role_guardian", description_features(text), text)
        self.assertIn(
            "role_guardian",
            description_features("This unit is a Guardian and redirects one enemy attack targeting another ally to itself."),
        )
        self.assertNotIn(
            "payoff_burn",
            description_features("For 200TU, unless burning, this unit cannot be defeated and has damage reduction."),
        )
        allied_cleanse = description_feature_records(
            "Whenever this unit is defeated by an enemy, all allies are healed and sleep, burn or poison are removed from them."
        )
        for status in ("burn", "poison", "sleep"):
            self.assertTrue(
                any(row.get("feature") == f"removes_{status}" and row.get("targetTeam") == "allies" for row in allied_cleanse)
            )
        false_cross_clause = description_features(
            "This unit gains Stun Immunity and a Stun Ward. The Ward is removed after it blocks one effect."
        )
        self.assertNotIn("removes_stun", false_cross_clause, "cross-clause removal invented a Stun cleanse")
        false_setup = description_features(
            "Burns one ally. Grants that ally a Poison Ward. Wards are removed after one use."
        )
        self.assertNotIn("removes_burn", false_setup, "setup plus unrelated removal invented a Burn cleanse")
        self.assertNotIn("removes_poison", false_setup, "ward expiration invented a Poison cleanse")

    def test_structured_scaler_polarity_uses_numeric_direction(self) -> None:
        payoff = structured_scaler_polarity_records({
            "ability": {"abilityScalor": 9, "conditionalAbilityScalors": [7, 5]},
            "config": {"attackScalors": ["GoodVs1NotBurningEnemy", "GoodVs2NotSleepingEnemies"]},
            "attackScalors": {
                "GoodVs1NotBurningEnemy": {"sourceCondition": "1EnemyNotBurning"},
                "GoodVs2NotSleepingEnemies": {"sourceCondition": "2EnemiesNotSleeping"},
            },
        })
        self.assertEqual({row["feature"] for row in payoff}, {"payoff_burn", "payoff_sleep"})
        conflict = structured_scaler_polarity_records({
            "ability": {"abilityScalor": 1, "conditionalAbilityScalors": [4]},
            "config": {"attackScalors": ["GoodVsNotBurning"]},
            "attackScalors": {"GoodVsNotBurning": {"targetCondition": "IsNotBurning"}},
        })
        self.assertEqual([row["feature"] for row in conflict], ["penalized_by_burn"])
        availability_only = structured_scaler_polarity_records({
            "ability": {"abilityScalor": 1},
            "config": {"useCondition": "IsNotBurning"},
        })
        self.assertEqual(availability_only, [], "availability condition became scaler polarity")

    def test_skill_profiles_preserve_contextual_action_authority(self) -> None:
        profiles = self.runtime.get("skillProfiles") or {}
        self.assertTrue(profiles)
        self.assertTrue(all(row.get("profileVersion") == 2 for row in profiles.values()))
        cupid = profiles.get("CupidRegular02") or {}
        skills = {row.get("id"): row for row in cupid.get("skills") or []}
        shot = skills.get("SpecialAttackACupidRegular") or {}
        self.assertEqual(shot.get("target", {}).get("side"), "enemies")
        self.assertEqual(shot.get("target", {}).get("count"), 1)
        self.assertEqual(shot.get("baseMultiplier"), 1.5)
        self.assertEqual(shot.get("conditionalMultipliers"), [3, 4.5, 6, 7.5, 9])
        self.assertTrue(shot.get("attackScalers"), "resolved conditional scaler authority was dropped")
        matchmaker = skills.get("MultiBuffACupidRegular") or {}
        self.assertEqual(matchmaker.get("target", {}).get("side"), "allies")
        self.assertTrue(matchmaker.get("target", {}).get("all"))
        self.assertIn("IsNotActive3LOCKCupidRegular", matchmaker.get("conditionIds") or [])

    def test_runtime_feature_coverage_is_bounded_and_complete(self) -> None:
        evidence = self.runtime.get("featureEvidence") or {}
        counts: Dict[str, int] = {}
        for rows in evidence.values():
            for row in rows if isinstance(rows, list) else []:
                feature = str(row.get("feature") or "")
                counts[feature] = counts.get(feature, 0) + 1
        required = {
            "applies_burn", "payoff_burn", "applies_poison", "payoff_poison",
            "applies_sleep", "payoff_sleep", "applies_stun", "payoff_stun",
            "summon", "payoff_blood", "payoff_crisis", "payoff_survivor",
            "role_guardian", "role_healer", "role_cleanser", "role_reviver",
            "resource_spirit", "tempo_turn", "leader",
            "applies_frostburn", "payoff_frostburn", "applies_stealth", "payoff_stealth",
            "applies_charge", "payoff_charge", "role_team_healer", "role_team_cleanser",
            "role_ally_cleanser", "role_self_sustain", "defense_hold_ground", "timing_entry_self",
        }
        self.assertTrue(required <= set(counts), f"Missing feature authorities: {sorted(required - set(counts))}")
        entry_count = len(self.entries)
        self.assertLess(counts["payoff_stun"], entry_count * 0.25, "Time Strike evidence collapsed into generic AI metadata")
        self.assertLess(counts["role_healer"], entry_count * 0.60, "Heal evidence is too broad")
        self.assertLess(counts["applies_burn"], entry_count * 0.25, "Burn setup evidence is too broad")
        self.assertLess(counts["applies_stun"], entry_count * 0.25, "Stun caveats/reductions collapsed into setup")

    def test_typed_evidence_and_leader_profiles_are_source_indexed(self) -> None:
        evidence = self.runtime.get("featureEvidence") or {}
        problems = []
        for evidence_source_id, items in evidence.items():
            for item in items if isinstance(items, list) else []:
                receipts = item.get("receipts") or []
                if not receipts:
                    problems.append(f"{evidence_source_id}:{item.get('feature')}: missing receipts")
                    continue
                for row in receipts:
                    if not row.get("source") or not row.get("sourceScope") or not row.get("relation"):
                        problems.append(f"{evidence_source_id}:{item.get('feature')}: incomplete typed receipt")
        self.assertEqual([], problems[:50], "Typed evidence contract failures: " + "; ".join(problems[:50]))
        leaders = self.runtime.get("leaderProfiles") or {}
        expected = {
            source_id(row)
            for row in self.entries
            if (row.get("raw") if isinstance(row.get("raw"), dict) else {}).get("leaderBuff") or row.get("leaderSkills")
        }
        self.assertEqual(expected, set(leaders))
        self.assertTrue(all(row.get("authorityResolved") for row in leaders.values()))
        chunks = self.manifest.get("chunks") or {}
        self.assertIn("leaderProfiles", chunks)
        self.assertEqual(len(leaders), chunks["leaderProfiles"].get("count"))

    def test_frontend_declares_and_checks_foundation_chunks(self) -> None:
        loader = (REPO / "optimizerRuntimeLoader.js").read_text(encoding="utf-8")
        bootstrap = (REPO / "optimizerRuntimeBootstrap.js").read_text(encoding="utf-8")
        for chunk in ("characters", "featureEvidence", "skillProfiles", "leaderProfiles", "optimizerKnowledge", "tags"):
            self.assertIn(chunk, loader)
        self.assertIn("OPTIMIZER_FOUNDATION_CHUNKS", loader)
        self.assertIn("optimizerFoundationReady", bootstrap)

    def test_validation_reports_have_explicit_status(self) -> None:
        for name in ("validation_report.json", "master_field_contract_audit_report.json"):
            report = read_json(ENTRIES / "reports" / name)
            self.assertIn(report.get("status"), {"ok", "warning", "failed"}, name)
            self.assertIsInstance(report.get("errors"), list, name)
            self.assertIsInstance(report.get("warnings"), list, name)

    def test_parent_child_authority_never_hides_both_reciprocal_forms(self) -> None:
        payload = read_json(ENTRIES / "maps" / "character_parent_child_map.json")
        parents = {key: set(value) for key, value in payload.get("parents", {}).items()}
        reciprocal = sorted(
            (parent, child)
            for parent, children in parents.items()
            for child in children
            if parent in parents.get(child, set()) and parent < child
        )
        self.assertEqual([], reciprocal)
        self.assertIn("FrankensteinRegularDoll", parents.get("FrankensteinRegular", set()))
        self.assertNotIn("FrankensteinRegular", parents.get("FrankensteinRegularDoll", set()))
        frontend_filter = (REPO / "roster-parent-filter-v3.js").read_text(encoding="utf-8")
        self.assertIn("cache:'no-store'", frontend_filter)


try:
    from . import passive_definition_sources as PDS
except ImportError:
    import passive_definition_sources as PDS

RAW = REPO / "apkfiles"
PASSIVE_SOURCE_FILES = ["Buff.json", "MonsterConditions.json", "AttackScalor.json", "BattleBehavior.json", "AbilityEffect.json", "Monster.json", "Weapon.json", "Boss.json"]


def _raw_copy(tmp: Path) -> Path:
    import shutil
    for name in PASSIVE_SOURCE_FILES:
        shutil.copyfile(RAW / name, tmp / name)
    return tmp


def _replace_in_candidate(folder: Path, file_name: str, ns: str, ident: str, old: bytes, new: bytes) -> None:
    """Edit bytes inside ONE definition object's exact byte range (test-only mutation)."""
    sources = PDS.SourceSet(folder)
    cand = sources.definitions[ns][ident][0]
    data = (folder / file_name).read_bytes()
    start, end = cand.byte_range
    segment = data[start:end]
    assert segment.count(old) >= 1, f"{old!r} not found in {ns}/{ident}"
    (folder / file_name).write_bytes(data[:start] + segment.replace(old, new, 1) + data[end:])


def _digests(folder: Path) -> Dict[str, Dict[str, str]]:
    PDS.clear_cache()
    out = {cat: PDS.passive_dependency_digests(folder, cat) for cat in ("characters", "weapons", "bosses")}
    PDS.clear_cache()
    return out


class PassiveDefinitionRegistryTests(unittest.TestCase):
    """Slice A: exact passive provenance and selective dependency invalidation.

    Fixtures are real APK records; mutations happen only in temporary copies and are
    labeled fault injection, never APK observations.
    """

    @classmethod
    def setUpClass(cls) -> None:
        cls.sources = PDS.SourceSet(RAW, REPO)
        cls.graph = PDS.DependencyGraph(cls.sources)
        cls.base = _digests(RAW)

    # -- exact numbers and canonicalization ---------------------------------
    def test_numeric_canonicalization_is_exact_and_provenance_distinguishes_spelling(self) -> None:
        def parse(b: bytes):
            return PDS.parse_exact(b)[0]
        a, b, c = parse(b'{"x":1}'), parse(b'{"x":1.0}'), parse(b'{"x":1e0}')
        self.assertEqual(PDS.canonical_text(a), PDS.canonical_text(b))
        self.assertEqual(PDS.canonical_text(a), PDS.canonical_text(c))
        self.assertNotEqual(PDS.source_text(a), PDS.source_text(b))
        self.assertEqual(PDS.canonical_text(parse(b'{"x":-0}')), '{"x":0}')
        self.assertEqual(PDS.canonical_text(parse(b'{"x":0.10}')), '{"x":0.1}')
        big = b'{"x":123456789012345678901234567890}'
        self.assertEqual(PDS.canonical_text(parse(big)), '{"x":123456789012345678901234567890}')
        self.assertEqual(PDS.canonical_text(parse(b'{"x":1.5e-7}')), '{"x":0.00000015}')
        self.assertNotEqual(PDS.canonical_text(parse(b'{"x":true}')), PDS.canonical_text(parse(b'{"x":1}')))
        self.assertNotEqual(PDS.canonical_text(parse(b'{"x":null}')), PDS.canonical_text(parse(b'{}')))
        self.assertEqual(PDS.canonical_text(parse(b'{"b":1,"a":2}')), '{"a":2,"b":1}')
        self.assertEqual(PDS.source_text(parse(b'{"b":1,"a":2}')), '{"b":1,"a":2}')

    def test_nonfinite_rejected_and_duplicate_keys_preserved(self) -> None:
        for bad in (b'{"x":NaN}', b'{"x":Infinity}', b'{"x":-Infinity}'):
            with self.assertRaises(PDS.ExactJSONError):
                PDS.parse_exact(bad)
        root, dups, _ = PDS.parse_exact(b'{"T":{"A":{"v":1},"A":{"v":2}}}')
        table = root.get("T")
        self.assertEqual([k for k, _ in table.pairs()], ["A", "A"])
        self.assertEqual(len(dups), 1)

    def test_duplicate_definition_candidates_are_kept_and_block_complete_closure(self) -> None:
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder / "Buff.json").write_bytes(b'{"Buff":{"A":{"behaviors":["StatOnly"]},"A":{"behaviors":["StatOnly"],"stackName":"Other"}}}')
            for name, root in (("MonsterConditions.json", "MonsterConditions"), ("AttackScalor.json", "AttackScalor"), ("BattleBehavior.json", "BattleBehavior"), ("AbilityEffect.json", "AbilityEffect")):
                (folder / name).write_text(json.dumps({root: {}}), encoding="utf-8")
            for name, root in (("Monster.json", "Monster"), ("Weapon.json", "Weapon"), ("Boss.json", "Monster")):
                (folder / name).write_text(json.dumps({root: []}), encoding="utf-8")
            sources = PDS.SourceSet(folder)
            graph = PDS.DependencyGraph(sources)
            self.assertEqual(len(sources.definitions["Buff"]["A"]), 2, "fault injection: both colliding candidates survive")
            self.assertEqual(graph.resolution("Buff", "A"), "ambiguous")
            self.assertEqual(graph.closure(["A"])["dependencyCompleteness"], "unresolved")

    # -- real source fixtures -----------------------------------------------
    def test_arsenal_sword_passive_preserves_exact_source_mechanics(self) -> None:
        cand = self.sources.definitions["Buff"]["AttackUp4EnemiesIsDisabled2"][0]
        text = PDS.source_text(cand.node)
        self.assertIn('"behaviors":["ExtraAttackScalor"]', text)
        self.assertIn('"attackerCondition":"2EnemiesDisabled","scalor":0.15', text)
        closure = self.graph.closure(["AttackUp4EnemiesIsDisabled2"])
        self.assertIn("MonsterConditions/2EnemiesDisabled", closure["nodes"])
        self.assertEqual(closure["dependencyCompleteness"], "complete")
        self.assertNotIn("MonsterConditions/Kills1", closure["nodes"])

    def test_stack_names_are_membership_nodes_not_buff_ids(self) -> None:
        members = self.sources.stack_members()
        self.assertIn("AttackUp4EnemiesIsDisabled2", members["AttackBoosted"])
        closure = self.graph.closure(["StunRandomEntranceA"]) if "StunRandomEntranceA" in self.sources.definitions["Buff"] else None
        if closure:
            for nid in closure["nodes"]:
                if nid.startswith("StackName/"):
                    self.assertIn("members", closure["nodes"][nid])
        # Damage-type tokens are not edges even where they coincide with Buff IDs.
        edges = PDS.typed_edges("Buff", PDS.parse_exact(b'{"behaviorOverrides":[{"cancelFromDamageTypes":["Poison"]}]}')[0])
        self.assertEqual(edges, [])

    def test_gold_greataxe_private_and_shared_dependencies_invalidate_selectively(self) -> None:
        import tempfile
        base_w = self.base["weapons"]
        for name in ("GoldGreataxe01", "GoldGreataxe02", "ArsenalSword01"):
            self.assertIn(name, base_w)
        with tempfile.TemporaryDirectory() as tmp:
            folder = _raw_copy(Path(tmp))
            _replace_in_candidate(folder, "Buff.json", "Buff", "AttackUp3Target1Kill", b"0.1", b"0.2")
            d = _digests(folder)["weapons"]
            self.assertNotEqual(d["GoldGreataxe01"], base_w["GoldGreataxe01"], "private Buff change invalidates its own state")
            self.assertEqual(d["GoldGreataxe02"], base_w["GoldGreataxe02"], "other state unaffected by a private Buff change")
            self.assertEqual(d["ArsenalSword01"], base_w["ArsenalSword01"])
        with tempfile.TemporaryDirectory() as tmp:
            folder = _raw_copy(Path(tmp))
            kills1 = PDS.source_text(PDS.SourceSet(folder).definitions["MonsterConditions"]["Kills1"][0].node)
            token = b'"' + kills1.split('"')[1].encode() + b'"'
            _replace_in_candidate(folder, "MonsterConditions.json", "MonsterConditions", "Kills1", token, b'"testOnlyFaultInjection":1,' + token)
            d = _digests(folder)["weapons"]
            self.assertNotEqual(d["GoldGreataxe01"], base_w["GoldGreataxe01"], "shared condition invalidates state 01")
            self.assertNotEqual(d["GoldGreataxe02"], base_w["GoldGreataxe02"], "shared condition invalidates state 02")
            self.assertEqual(d["ArsenalSword01"], base_w["ArsenalSword01"], "closure without Kills1 stays stable")

    def test_beast_soldier_evolved_form_private_vs_shared(self) -> None:
        import tempfile
        base_c = self.base["characters"]
        with tempfile.TemporaryDirectory() as tmp:
            folder = _raw_copy(Path(tmp))
            first_key = PDS.source_text(PDS.SourceSet(folder).definitions["Buff"]["SpiritLossRevengeA"][0].node).split('"')[1].encode()
            _replace_in_candidate(folder, "Buff.json", "Buff", "SpiritLossRevengeA", b'"' + first_key + b'"', b'"testOnlyFaultInjection":1,"' + first_key + b'"')
            d = _digests(folder)["characters"]
            self.assertEqual(d["BeastSoldier01"], base_c["BeastSoldier01"], "01 does not carry SpiritLossRevengeA")
            self.assertNotEqual(d["BeastSoldier02"], base_c["BeastSoldier02"])
        with tempfile.TemporaryDirectory() as tmp:
            folder = _raw_copy(Path(tmp))
            first_key = PDS.source_text(PDS.SourceSet(folder).definitions["Buff"]["AddWeaponPrefGreatAxe"][0].node).split('"')[1].encode()
            _replace_in_candidate(folder, "Buff.json", "Buff", "AddWeaponPrefGreatAxe", b'"' + first_key + b'"', b'"testOnlyFaultInjection":1,"' + first_key + b'"')
            d = _digests(folder)["characters"]
            self.assertNotEqual(d["BeastSoldier01"], base_c["BeastSoldier01"])
            self.assertNotEqual(d["BeastSoldier02"], base_c["BeastSoldier02"])

    def test_numeric_spelling_and_format_changes_follow_the_byte_contract(self) -> None:
        import tempfile
        base_w = self.base["weapons"]
        with tempfile.TemporaryDirectory() as tmp:
            folder = _raw_copy(Path(tmp))
            before = PDS.SourceSet(folder).definitions["Buff"]["AttackUp3Target1Kill"][0]
            _replace_in_candidate(folder, "Buff.json", "Buff", "AttackUp3Target1Kill", b"0.1", b"0.10")
            after = PDS.SourceSet(folder).definitions["Buff"]["AttackUp3Target1Kill"][0]
            self.assertEqual(before.canonical_content_hash(), after.canonical_content_hash(), "same value")
            self.assertNotEqual(before.raw_token_hash(), after.raw_token_hash(), "provenance refreshes")
            self.assertNotEqual(before.token_stream_hash(), after.token_stream_hash(), "token-only change is classifiable")
            d = _digests(folder)["weapons"]
            self.assertNotEqual(d["GoldGreataxe01"], base_w["GoldGreataxe01"], "accepted v2.1 byte contract: spelling change rehashes dependents")
            self.assertEqual(d["GoldGreataxe02"], base_w["GoldGreataxe02"])
        with tempfile.TemporaryDirectory() as tmp:
            folder = _raw_copy(Path(tmp))
            # Moving an unchanged object (an unrelated earlier record grows) must not invalidate it.
            _replace_in_candidate(folder, "Buff.json", "Buff", "RelationshipFlatAttack50", b'"StatOnly"', b'"StatOnly", "StatOnly"')
            d = _digests(folder)["weapons"]
            self.assertEqual(d["GoldGreataxe01"], base_w["GoldGreataxe01"], "byte offsets never enter entry digests")

    def test_cycles_terminate_and_missing_references_mark_partial(self) -> None:
        a = PDS.parse_exact(b'{"behaviorOverrides":[{"selfBuffs":["B"]}]}')[0]
        b = PDS.parse_exact(b'{"behaviorOverrides":[{"selfBuffs":["A"],"conditions":"MissingCondition"}]}')[0]

        class FakeSources:
            definitions = {"Buff": {"A": [PDS.Candidate("Buff", "A", "t", "/Buff/A", 0, a, b"")],
                                    "B": [PDS.Candidate("Buff", "B", "t", "/Buff/B", 0, b, b"")]},
                           "MonsterConditions": {}}
            identities: Dict[str, set] = {}

            @staticmethod
            def stack_members() -> Dict[str, List[str]]:
                return {}

        graph = PDS.DependencyGraph(FakeSources())  # type: ignore[arg-type]
        graph.node_material = lambda ns, ident: {"resolution": graph.resolution(ns, ident)}  # type: ignore[assignment]
        closure = graph.closure(["A"])
        self.assertIn("Buff/A", closure["nodes"])
        self.assertIn("Buff/B", closure["nodes"])
        self.assertIn({"from": "Buff/B", "candidateOrdinal": "0", "fieldPointer": "/behaviorOverrides/0/selfBuffs/0",
                       "to": "Buff/A", "role": "record", "keyRef": False}, closure["edges"], "cycle edge retained")
        self.assertEqual(closure["missing"], ["MonsterConditions/MissingCondition"])
        self.assertEqual(closure["dependencyCompleteness"], "partial")

    def test_digests_are_deterministic_and_independent_of_traversal_order(self) -> None:
        again = _digests(RAW)
        self.assertEqual(again, self.base)
        refs = [("0", "AttackUp3Target1Kill"), ("1", "AttackUp4EnemiesIsDisabled2")]
        g1 = PDS.DependencyGraph(self.sources)
        g2 = PDS.DependencyGraph(self.sources)
        list(reversed([g2.closure([r]) for _, r in reversed(refs)]))  # warm caches in reverse order
        self.assertEqual(g1.entry_digest(refs)[0], g2.entry_digest(refs)[0])

    def test_accessories_and_passive_less_entries_get_no_passive_material(self) -> None:
        self.assertEqual(PDS.passive_dependency_digests(RAW, "accessories"), {})
        rows = [r for _, r in self.sources.occurrence_rows["characters"] if not self.sources.passive_refs(r)]
        self.assertTrue(rows)
        for row in rows:
            self.assertNotIn(row.get("name").value, self.base["characters"])

    def _validate_registry_copy(self, mutate) -> List[str]:
        import tempfile
        try:
            from . import validate_entries as VE
        except ImportError:
            import validate_entries as VE
        registry_path = ENTRIES / "runtime" / "passive_definition_registry.json"
        if not registry_path.exists():
            self.skipTest("registry not generated in this checkout")
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp) / "entries"
            (base / "runtime").mkdir(parents=True)
            registry = read_json(registry_path)
            original = json.loads(json.dumps(registry))
            mutate(registry)
            # A no-op must preserve source numeric tokens, not round-trip them
            # through Python float before the exact source-payload check.
            text = registry_path.read_text(encoding="utf-8") if registry == original else json.dumps(registry)
            (base / "runtime" / "passive_definition_registry.json").write_text(text, encoding="utf-8")
            (base / "runtime" / "optimizer_runtime_manifest.json").write_text((ENTRIES / "runtime" / "optimizer_runtime_manifest.json").read_text(encoding="utf-8"), encoding="utf-8")
            errors: List[str] = []
            warnings: List[str] = []
            VE.validate_passive_registry(REPO, base, errors, warnings)
            self.assertEqual(warnings, [])
            return errors

    def test_validator_accepts_the_generated_registry(self) -> None:
        self.assertEqual(self._validate_registry_copy(lambda r: None), [])

    def test_validator_rejects_swapped_occurrences_with_unchanged_count(self) -> None:
        # Fault injection (review finding A1): duplicate one occurrence and drop another; the count stays equal.
        def corrupt(registry: Dict[str, Any]) -> None:
            occ = registry["occurrences"]
            occ[1] = dict(occ[0])
        errors = self._validate_registry_copy(corrupt)
        self.assertTrue(any("Occurrence mismatch" in e for e in errors), errors)

    def test_validator_rejects_wrong_passive_at_a_position(self) -> None:
        def corrupt(registry: Dict[str, Any]) -> None:
            occ = registry["occurrences"][5]
            other = next(o for o in registry["occurrences"] if o["passiveId"] != occ["passiveId"])
            occ["passiveId"] = other["passiveId"]
            occ["ref"] = other["ref"]
        errors = self._validate_registry_copy(corrupt)
        self.assertTrue(any("Occurrence mismatch" in e for e in errors), errors)

    def test_validator_rejects_registry_built_from_external_source(self) -> None:
        # Review finding A2: a registry from a non-repository raw folder cannot be verified and must fail.
        def corrupt(registry: Dict[str, Any]) -> None:
            registry["sourceRoot"] = "external"
        errors = self._validate_registry_copy(corrupt)
        self.assertTrue(any("sourceRoot" in e for e in errors), errors)

    def test_validator_rejects_incorrect_raw_field(self) -> None:
        def corrupt(registry: Dict[str, Any]) -> None:
            registry["occurrences"][0]["rawField"] = "passiveSkills"
        errors = self._validate_registry_copy(corrupt)
        self.assertTrue(any("Occurrence mismatch" in e for e in errors), errors)

    def test_validator_rejects_fatal_source_diagnostics(self) -> None:
        def corrupt(registry: Dict[str, Any]) -> None:
            registry["sourceDiagnostics"].append({"kind": "source_parse_error", "file": "apkfiles/Buff.json"})
        errors = self._validate_registry_copy(corrupt)
        self.assertTrue(any("Fatal source diagnostics" in e for e in errors), errors)

    def test_extract_pipeline_forwards_raw_input_to_registry_step(self) -> None:
        import subprocess
        import sys
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            env = dict(__import__("os").environ, PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8")
            proc = subprocess.run([sys.executable, str(Path(__file__).resolve().parent / "run_safe_new_data_ingest.py"), "--extract", "--raw", tmp, "--dry-run"],
                                  capture_output=True, text=True, encoding="utf-8", env=env, cwd=str(REPO))
            self.assertEqual(proc.returncode, 0, proc.stdout[-2000:] + proc.stderr[-2000:])
            lines = [l for l in proc.stdout.splitlines() if l.startswith("COMMAND:") and "build_passive_definition_registry.py" in l]
            self.assertEqual(len(lines), 1, proc.stdout[-2000:])
            self.assertIn("--input", lines[0])
            self.assertIn(str(Path(tmp)), lines[0])

    def test_external_input_is_labeled_external_not_apkfiles(self) -> None:
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            folder = _raw_copy(Path(tmp))
            sources = PDS.SourceSet(folder, REPO)
            self.assertEqual(sources.source_root(), "external")
            self.assertTrue(all(path.startswith("external/") for path in sources.files))
        self.assertEqual(PDS.SourceSet(RAW, REPO).source_root(), "apkfiles")

    def test_source_cache_refreshes_when_a_raw_file_changes_in_process(self) -> None:
        import tempfile, os, time
        with tempfile.TemporaryDirectory() as tmp:
            folder = _raw_copy(Path(tmp))
            PDS.clear_cache()
            before = PDS.passive_dependency_digests(folder, "weapons")["GoldGreataxe01"]
            _replace_in_candidate(folder, "Buff.json", "Buff", "AttackUp3Target1Kill", b"0.1", b"0.3")
            st = (folder / "Buff.json").stat()
            os.utime(folder / "Buff.json", ns=(st.st_atime_ns, st.st_mtime_ns + 1_000_000_000))
            after = PDS.passive_dependency_digests(folder, "weapons")["GoldGreataxe01"]
            PDS.clear_cache()
            self.assertNotEqual(before, after, "no stale digest after an in-process source change")

    def test_registry_is_isolated_from_page_loading(self) -> None:
        manifest = (ENTRIES / "runtime" / "optimizer_runtime_manifest.json").read_text(encoding="utf-8")
        self.assertNotIn("passive_definition_registry", manifest)
        self.assertNotIn("passive_definition_registry", (REPO / "sw.js").read_text(encoding="utf-8"))
        for page in ("index.html", "roster.html", "optimizer.html"):
            self.assertNotIn("passive_definition_registry", (REPO / page).read_text(encoding="utf-8"))
        registry_path = ENTRIES / "runtime" / "passive_definition_registry.json"
        if registry_path.exists():
            registry = read_json(registry_path)
            self.assertFalse(registry["mechanicModeled"])
            self.assertEqual(registry["summary"]["definitionResolution"]["missing"], 0)
            for occ in registry["occurrences"]:
                self.assertFalse(occ["mechanicModeled"])
                self.assertEqual(occ["legacyHeuristicBehavior"], "preserved")


class PassiveReviewRegressionTests(unittest.TestCase):
    """Discriminating fault fixtures for the independent review's F1-F4 findings."""

    @staticmethod
    def fixtures(folder: Path, buffs: bytes, monsters: bytes = b'{"Monster":[]}') -> None:
        folder.mkdir(parents=True, exist_ok=True)
        for filename, root in (("MonsterConditions.json", "MonsterConditions"), ("AttackScalor.json", "AttackScalor"),
                               ("BattleBehavior.json", "BattleBehavior"), ("AbilityEffect.json", "AbilityEffect")):
            (folder / filename).write_text(json.dumps({root: {}}), encoding="utf-8")
        (folder / "Buff.json").write_bytes(buffs)
        (folder / "Monster.json").write_bytes(monsters)
        (folder / "Weapon.json").write_bytes(b'{"Weapon":[]}')
        (folder / "Boss.json").write_bytes(b'{"Monster":[]}')

    def test_condition_key_reference_is_a_real_pointer_with_separate_flag(self) -> None:
        import tempfile
        from build_passive_definition_registry import build_registry
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "apkfiles"
            self.fixtures(raw, b'{"Buff":{"A":{"applyConditions":"Cond"}}}',
                          b'{"Monster":[{"name":"Unit","passives":["A"]}]}')
            condition = {"enemyTeamMonsterConditionMatchesNeeded": {"A/B~C": 2}}
            (raw / "MonsterConditions.json").write_text(json.dumps({"MonsterConditions": {"Cond": condition, "A/B~C": {}}}), encoding="utf-8")
            registry, _ = build_registry(Path(tmp), raw)
            edge = registry["definitions"]["MonsterConditions"]["Cond"]["edges"][0]
            self.assertTrue(edge["keyRef"])
            self.assertEqual(edge["fieldPointer"], "/enemyTeamMonsterConditionMatchesNeeded/A~1B~0C")
            value = condition
            for token in edge["fieldPointer"].split("/")[1:]:
                value = value[token.replace("~1", "/").replace("~0", "~")]
            self.assertEqual(value, 2, "the pointer resolves to the source member; keyRef describes the key")
            self.assertEqual(edge["targetId"], "A/B~C")

    def test_ambiguous_stack_assignment_propagates_and_changes_digest(self) -> None:
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            before = b'{"Buff":{"Root":{"buffStackNames":["StackX"]},"A":{"stackName":"StackX"}}}'
            self.fixtures(raw, before)
            graph = PDS.DependencyGraph(PDS.SourceSet(raw))
            digest = graph.entry_digest([("0", "Root")])[0]
            (raw / "Buff.json").write_bytes(before[:-2] + b',"A":{"stackName":"StackY"}}}')
            changed = PDS.DependencyGraph(PDS.SourceSet(raw))
            other_digest, closure = changed.entry_digest([("0", "Root")])
            self.assertEqual(closure["nodes"]["StackName/StackX"]["members"], ["A"])
            self.assertEqual(closure["nodes"]["StackName/StackX"]["ambiguousMembers"], ["A"])
            self.assertEqual(closure["nodes"]["StackName/StackX"]["resolution"], "ambiguous")
            self.assertEqual(closure["dependencyCompleteness"], "unresolved")
            self.assertNotEqual(digest, other_digest, "same union membership must not hide conflicting assignments")

    def test_remove_buffs_only_uses_the_direct_override_name(self) -> None:
        source = b'{"behaviors":["RemoveBuffs"],"behaviorOverrides":[{"name":"Direct","nested":{"name":"Incidental"},"items":[{"name":"AlsoIncidental"}]}]}'
        edges = PDS.typed_edges("Buff", PDS.parse_exact(source)[0])
        stacks = [(ptr, target) for ptr, ns, target, _, _ in edges if ns == "StackName"]
        self.assertEqual(stacks, [("/behaviorOverrides/0/name", "Direct")])

    def test_duplicate_field_accessor_never_selects_first_or_last(self) -> None:
        node, diagnostics, _ = PDS.parse_exact(b'{"stackName":"First","stackName":"Last"}')
        self.assertEqual(len(diagnostics), 1)
        self.assertEqual([v.text() for _, v in node.pairs()], ["First", "Last"])
        with self.assertRaisesRegex(PDS.ExactJSONError, "ambiguous duplicate field"):
            node.get("stackName")

    def test_fatal_sources_produce_no_digest_and_preserve_existing_output(self) -> None:
        import tempfile, subprocess, sys
        writer = Path(__file__).with_name("build_passive_definition_registry.py")
        for damage in ("parse", "missing_file", "wrong_root", "duplicate_fields"):
            with self.subTest(damage=damage), tempfile.TemporaryDirectory() as tmp:
                raw = Path(tmp) / "apkfiles"
                self.fixtures(raw, b'{"Buff":{"A":{}}}', b'{"Monster":[{"name":"Unit","passives":["A"]}]}')
                if damage == "parse":
                    (raw / "Buff.json").write_bytes(b'{"Buff":{"A":{"x":NaN}}}')
                elif damage == "wrong_root":
                    (raw / "Buff.json").write_bytes(b'{"Wrong":{}}')
                elif damage == "duplicate_fields":
                    (raw / "Buff.json").write_bytes(b'{"Buff":{"A":{"duration":1,"duration":2}}}')
                else:
                    (raw / "Buff.json").unlink()
                with self.assertRaises(PDS.ExactJSONError):
                    PDS.DependencyGraph(PDS.SourceSet(raw)).entry_digest([("0", "A")])
                with self.assertRaises(PDS.ExactJSONError):
                    PDS.passive_dependency_digests(raw, "characters")
                output = Path(tmp) / "existing_registry.json"
                original = b'{"previous":"must survive"}\n'
                output.write_bytes(original)
                result = subprocess.run([sys.executable, str(writer), "--input", str(raw), "--output", str(output)],
                                        capture_output=True, text=True, encoding="utf-8", cwd=REPO)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("existing output preserved", result.stderr)
                self.assertEqual(output.read_bytes(), original)
                self.assertEqual(list(output.parent.glob(".passive-registry-*")), [])

    def test_object_table_pointer_and_passive_skills_field_match_independent_join(self) -> None:
        import tempfile
        from build_passive_definition_registry import build_registry
        from validate_entries import expected_passive_occurrences, occurrence_key
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            raw = repo / "apkfiles"
            self.fixtures(raw, b'{"Buff":{"A":{}}}',
                          b'{"Monster":{"unit/~":{"passiveSkills":{"0":"A"}},"empty":{"passives":{},"passiveSkills":["A"]},"null":{"passives":null,"passiveSkills":["A"]},"nameNull":{"name":null,"passiveSkills":["A"]},"nameNumber":{"name":42,"passiveSkills":["A"]}}}')
            registry, _ = build_registry(repo, raw)
            self.assertEqual(len(registry["occurrences"]), 3)
            occurrence = registry["occurrences"][0]
            self.assertEqual(occurrence["sourceId"], "unit/~")
            self.assertEqual(occurrence["rawPointer"], "/Monster/unit~1~0")
            self.assertEqual(occurrence["rawField"], "passiveSkills")
            self.assertEqual({o["sourceId"] for o in registry["occurrences"]}, {"unit/~", "nameNull", "nameNumber"})
            self.assertEqual([occurrence_key(o) for o in registry["occurrences"]], expected_passive_occurrences(repo))

    def test_registry_integrity_rejects_unverifiable_or_forged_authority(self) -> None:
        import tempfile, copy
        from build_passive_definition_registry import build_registry, render
        from validate_entries import validate_passive_registry
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            raw = repo / "apkfiles"
            base = raw / "entries"
            self.fixtures(raw, b'{"Buff":{"A":{"value":1}}}', b'{"Monster":[{"name":"Unit","passives":["A"]}]}')
            registry, slots = build_registry(repo, raw)
            path = base / "runtime" / "passive_definition_registry.json"
            path.parent.mkdir(parents=True)
            cases = ["valid", "no_sources", "missing_source", "extra_source", "source_hash", "empty_range", "negative_range",
                     "past_end_range", "bool_range", "text_range", "unknown_file", "wrong_pointer", "wrong_hash",
                     "wrong_canonical", "wrong_source", "no_definitions", "no_candidates", "wrong_digest", "wrong_edges", "wrong_resolution"]
            for case in cases:
                with self.subTest(case=case):
                    data = copy.deepcopy(registry)
                    candidate = data["definitions"]["Buff"]["A"]["candidates"][0]
                    if case == "no_sources": data["sourceFiles"] = {}
                    elif case == "missing_source": data["sourceFiles"].pop("apkfiles/Buff.json")
                    elif case == "extra_source": data["sourceFiles"]["../unapproved"] = {"sha256": "0" * 64}
                    elif case == "source_hash": data["sourceFiles"]["apkfiles/Buff.json"]["sha256"] = "0" * 64
                    elif case == "empty_range": candidate["byteRange"] = []
                    elif case == "negative_range": candidate["byteRange"] = [-1, 1]
                    elif case == "past_end_range": candidate["byteRange"] = [0, 10**9]
                    elif case == "bool_range": candidate["byteRange"] = [False, True]
                    elif case == "text_range": candidate["byteRange"] = ["0", "1"]
                    elif case == "unknown_file": candidate["file"] = "../unapproved"
                    elif case == "wrong_pointer": candidate["pointer"] = "/Buff/Other"
                    elif case == "wrong_hash": candidate["rawTokenHash"] = "0" * 64
                    elif case == "wrong_canonical": candidate["canonicalContentHash"] = "0" * 64
                    elif case == "wrong_source": candidate["source"] = {"value": 2}
                    elif case == "no_definitions": data["definitions"] = {}
                    elif case == "no_candidates": data["definitions"]["Buff"]["A"]["candidates"] = []
                    elif case == "wrong_digest": data["entryDependencyDigests"]["characters"]["Unit"] = "0" * 64
                    elif case == "wrong_edges": data["definitions"]["Buff"]["A"]["edges"] = [{"fake": True}]
                    elif case == "wrong_resolution": data["occurrences"][0]["definitionResolution"] = "missing"
                    path.write_text(render(data, slots), encoding="utf-8")
                    errors, warnings = [], []
                    result = validate_passive_registry(repo, base, errors, warnings)
                    self.assertEqual(warnings, [])
                    if case == "valid":
                        self.assertEqual(errors, [])
                        self.assertEqual(result["integrityChecked"], 1)
                        self.assertEqual(result["status"], "checked")
                    else:
                        self.assertTrue(errors, (case, result))
                        self.assertEqual(result["status"], "failed")

    def test_freshness_requires_generation_and_validation_in_this_run(self) -> None:
        from argparse import Namespace
        from run_safe_new_data_ingest import passive_registry_freshness, PASSIVE_REGISTRY_STEP
        args = Namespace(dry_run=False, skip_post_checks=False)
        writer = {"label": PASSIVE_REGISTRY_STEP, "returnCode": 0, "status": "ok"}
        validator = {"label": "validate_entries.py", "returnCode": 0, "status": "ok"}
        cases = [([], "not_refreshed_pipeline_stopped_before_registry"),
                 ([writer], "generated_unvalidated"),
                 ([dict(writer, returnCode=1, status="failed")], "refresh_failed"),
                 ([writer, dict(validator, returnCode=1, status="failed")], "validation_failed"),
                 ([writer, validator], "validated")]
        for steps, expected in cases:
            with self.subTest(expected=expected):
                result = passive_registry_freshness(steps, args)
                self.assertEqual(result["state"], expected)
                self.assertEqual(result["validated"], expected == "validated")
                self.assertEqual(result["refreshed"], expected == "validated")
        for flag in ("dry_run", "skip_post_checks"):
            result = passive_registry_freshness([writer, validator], Namespace(**{**vars(args), flag: True}))
            self.assertFalse(result["generated"])
            self.assertFalse(result["validated"])
            self.assertFalse(result["refreshed"])

    def test_registry_derived_status_claims_match_raw_and_legacy_authorities(self) -> None:
        import tempfile, copy
        from build_passive_definition_registry import build_registry, render
        from validate_entries import validate_passive_registry
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            raw = repo / "apkfiles"
            self.fixtures(raw, b'{"Buff":{"A":{"applyConditions":"Missing"}}}', b'{"Monster":[{"name":"Unit","passives":["A"]}]}')
            legacy_dir = raw / "entries/characters/entries"
            legacy_dir.mkdir(parents=True)
            (legacy_dir / "Unit.json").write_text(json.dumps({"sourceId": "Unit", "resolved": {"passives": {"A": {"found": True}}}}), encoding="utf-8")
            registry, slots = build_registry(repo, raw)
            path = raw / "entries/runtime/passive_definition_registry.json"
            path.parent.mkdir(parents=True)
            cases = ["valid", "summary_count", "summary_status", "summary_categories", "summary_definitions", "summary_digests",
                     "global_scope", "occurrence_scope", "heuristic", "localization", "unresolved_extra", "unresolved_missing", "diagnostics", "bad_diagnostics", "null_diagnostics"]
            for case in cases:
                with self.subTest(case=case):
                    data = copy.deepcopy(registry)
                    if case == "summary_count": data["summary"]["occurrences"] = 9999
                    elif case == "summary_status": data["summary"]["dependencyCompleteness"]["complete"] = 1
                    elif case == "summary_categories": data["summary"]["occurrencesByCategory"]["characters"] = 2
                    elif case == "summary_definitions": data["summary"]["definitionsReached"]["Buff"] = 2
                    elif case == "summary_digests": data["summary"]["entriesWithPassiveDigest"]["characters"] = 2
                    elif case == "global_scope": data["modelingScope"] = "entire_v6"
                    elif case == "occurrence_scope": data["occurrences"][0]["modelingScope"] = "entire_v6"
                    elif case == "heuristic": data["occurrences"][0]["legacyHeuristicBehavior"] = "removed"
                    elif case == "localization": data["occurrences"][0]["localizationFound"] = False
                    elif case == "unresolved_extra": data["unresolved"].append({"kind": "missing_reference", "node": "Fake"})
                    elif case == "unresolved_missing": data["unresolved"] = []
                    elif case == "diagnostics": data["sourceDiagnostics"].append({"kind": "fabricated"})
                    elif case == "bad_diagnostics": data["sourceDiagnostics"] = [7]
                    elif case == "null_diagnostics": data["sourceDiagnostics"] = None
                    path.write_text(render(data, slots), encoding="utf-8")
                    errors, warnings = [], []
                    result = validate_passive_registry(repo, raw / "entries", errors, warnings)
                    if case == "valid":
                        self.assertEqual(errors, [])
                        self.assertEqual(result["status"], "checked")
                    else:
                        self.assertTrue(errors, case)
                        self.assertEqual(result["status"], "failed")

    def test_external_input_cannot_replace_canonical_output(self) -> None:
        import tempfile
        from unittest.mock import patch
        import build_passive_definition_registry as writer
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "repo"
            raw = Path(tmp) / "external"
            self.fixtures(raw, b'{"Buff":{}}')
            output = repo / writer.OUTPUT_REL
            output.parent.mkdir(parents=True)
            original = b'{"trusted":"keep exactly"}\n'
            output.write_bytes(original)
            with patch.object(writer, "find_repo_root", return_value=repo), patch("sys.argv", [str(writer.__file__), "--input", str(raw)]):
                self.assertNotEqual(writer.main(), 0)
            self.assertEqual(output.read_bytes(), original)
            alternate = Path(tmp) / "external-inspection.json"
            with patch.object(writer, "find_repo_root", return_value=repo), patch("sys.argv", [str(writer.__file__), "--input", str(raw), "--output", str(alternate)]):
                self.assertEqual(writer.main(), 0)
            self.assertEqual(read_json(alternate)["sourceRoot"], "external")
            self.assertEqual(output.read_bytes(), original)

    def test_external_ingest_is_rejected_before_any_pipeline_write(self) -> None:
        import tempfile
        from unittest.mock import patch
        import run_safe_new_data_ingest as runner
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "repo"
            external = Path(tmp) / "external"
            external.mkdir()
            output = repo / runner.PASSIVE_REGISTRY_REL
            output.parent.mkdir(parents=True)
            original = b'{"trusted":"unchanged"}\n'
            output.write_bytes(original)
            with patch.object(runner, "find_repo_root", return_value=repo), patch.object(runner, "run_command") as run, patch("sys.argv", [str(runner.__file__), "--extract", "--raw", str(external)]):
                self.assertEqual(runner.main(), 2)
                run.assert_not_called()
            self.assertEqual(output.read_bytes(), original)
            self.assertFalse((repo / runner.REPORT_REL).exists())

    def test_cache_detects_same_size_same_mtime_and_nested_source_changes(self) -> None:
        import tempfile, os
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            self.fixtures(raw, b'{"Buff":{"A":{"value":0.1}}}', b'{"Monster":[{"name":"Unit","passives":["A"]}]}')
            nested = raw / "nested"
            nested.mkdir()
            buff = nested / "Buff.json"
            (raw / "Buff.json").rename(buff)
            PDS.clear_cache()
            before = PDS.passive_dependency_digests(raw, "characters")["Unit"]
            stat = buff.stat()
            buff.write_bytes(buff.read_bytes().replace(b"0.1", b"0.2"))
            os.utime(buff, ns=(stat.st_atime_ns, stat.st_mtime_ns))
            self.assertEqual(buff.stat().st_size, stat.st_size)
            self.assertEqual(buff.stat().st_mtime_ns, stat.st_mtime_ns)
            after = PDS.passive_dependency_digests(raw, "characters")["Unit"]
            PDS.clear_cache()
            fresh = PDS.passive_dependency_digests(raw, "characters")["Unit"]
            self.assertNotEqual(before, after)
            self.assertEqual(after, fresh)
            PDS.clear_cache()

    def test_passive_key_order_matches_legacy_and_mixed_maps_fail_closed(self) -> None:
        import tempfile
        from build_apk_entry_folders import ordered_values
        from build_passive_definition_registry import build_registry
        from validate_entries import expected_passive_occurrences
        for mapping in ({"2": "A", "0": "B", "01": "C", "1": "D"}, {"z": "A", "a": "B"}):
            with self.subTest(mapping=mapping), tempfile.TemporaryDirectory() as tmp:
                repo = Path(tmp)
                raw = repo / "apkfiles"
                self.fixtures(raw, b'{"Buff":{}}', json.dumps({"Monster": [{"name": "Unit", "passives": mapping}]}).encode())
                sources = PDS.SourceSet(raw, repo)
                refs = sources.passive_refs(sources.occurrence_rows["characters"][0][1])
                self.assertEqual([pid for _, pid in refs], ordered_values(mapping))
                self.assertEqual([(t[3], t[4]) for t in expected_passive_occurrences(repo)], refs)
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            raw = repo / "apkfiles"
            mapping = {"alpha": "A", "1": "B", "0": "C"}
            self.fixtures(raw, b'{"Buff":{}}', json.dumps({"Monster": [{"name": "Unit", "passives": mapping}]}).encode())
            with self.assertRaises(TypeError): ordered_values(mapping)
            for operation in (lambda: PDS.passive_dependency_digests(raw, "characters"),
                              lambda: expected_passive_occurrences(repo), lambda: build_registry(repo, raw)):
                with self.assertRaisesRegex(PDS.ExactJSONError, "mixed numeric/text"):
                    operation()


class AccessoryFlatStatsTests(unittest.TestCase):
    def normalized(self, item, category="accessories"):
        from build_apk_entry_folders import normalize_entry
        return normalize_entry(item, category, 1, None, {"Localizable": {}}, {})

    def test_flat_stats_populate_normalized_and_top_level_without_mutating_raw(self):
        raw = {"name": "Armor01", "flatAttack": 20, "flatMaxHp": 120, "flatSpeed": 4}
        snapshot = dict(raw)
        entry = self.normalized(raw)
        self.assertEqual(entry["stats"], {"atk": 20, "hp": 120, "spd": 4, "cost": None})
        self.assertEqual([entry[key] for key in ("atk", "hp", "spd")], [20, 120, 4])
        self.assertEqual(raw, snapshot)
        self.assertEqual(entry["raw"], snapshot)

    def test_zero_precedence_and_null_fallback_match_raw_first_stat_engine(self):
        raw = {"name": "Fixture", "flatAttack": 0, "baseAttack": 50, "flatMaxHp": None, "baseMaxHp": 60, "flatSpeed": 0, "speed": 7, "cost": 0}
        self.assertEqual(self.normalized(raw)["stats"], {"atk": 0, "hp": 60, "spd": 0, "cost": 0})
        self.assertEqual(self.normalized({"name": "Missing"})["stats"], {"atk": None, "hp": None, "spd": None, "cost": None})

    def test_nonaccessory_normalization_stays_on_existing_base_fields(self):
        raw = {"name": "Fixture", "flatAttack": 20, "flatMaxHp": 120, "flatSpeed": 4, "baseAttack": 1, "baseMaxHp": 2, "speed": 3}
        for category in ("characters", "weapons", "bosses"):
            self.assertEqual(self.normalized(raw, category)["stats"], {"atk": 1, "hp": 2, "spd": 3, "cost": None})

    def test_only_accessory_dependency_changes_and_old_marker_is_invalidated(self):
        import tempfile
        from build_apk_entry_folders import build_source_marker, category_script_version, display_authority, existing_marker_matches, localize_character, sha256_data
        raw = {"name": "Fixture", "flatAttack": 20}
        resolvers = {"Localizable": {}}
        for category in ("characters", "weapons", "accessories", "bosses"):
            legacy_dependencies = {"abilities": {}, "characterLocalization": localize_character({}, "Fixture", "Fixture") if category == "characters" else None, "leaderCondition": None}
            if category != "characters":
                legacy_dependencies["displayAuthority"] = display_authority(raw, category, resolvers)
            marker = build_source_marker(raw, category, "Fixture", 1, None, resolvers)
            legacy_marker = {**marker, "dependencyHash": sha256_data(legacy_dependencies)}
            expected_source = {"category": category, "internalId": "Fixture", "order": 1, "displayName": None, "raw": raw, "scriptVersion": category_script_version(category)}
            self.assertEqual(marker["sourceHash"], sha256_data(expected_source))
            self.assertEqual(marker != legacy_marker, category == "accessories")
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "entry.json"
                path.write_text(json.dumps({"_build": legacy_marker}), encoding="utf-8")
                self.assertEqual(existing_marker_matches(path, marker, False), category != "accessories")
                path.write_text(json.dumps({"_build": marker}), encoding="utf-8")
                self.assertTrue(existing_marker_matches(path, marker, False))

    def test_all_source_accessories_reach_entries_bundle_and_runtime_with_exact_stats(self):
        from build_apk_entry_folders import extract_list
        raw_rows = extract_list(read_json(REPO / "apkfiles" / "Equipment.json"), "accessories")
        expected = {row["name"]: row for row in raw_rows}
        index = read_json(ENTRIES / "accessories" / "index.json")["entries"]
        entry_rows = [read_json(ENTRIES / "accessories" / row["file"]) for row in index]
        bundles = bundle_entries("accessories.bundle.json")
        runtime = read_json(ENTRIES / "runtime" / "optimizer_runtime_accessories.json")["data"]
        for name, rows in (("entries", entry_rows), ("bundle", bundles), ("runtime", list(runtime.values()))):
            self.assertEqual({row["sourceId"] for row in rows}, set(expected), name)
            self.assertEqual(len(rows), len(expected), name)
            for row in rows:
                raw = expected[row["sourceId"]]
                self.assertEqual(row["raw"], raw, (name, row["sourceId"]))
                stats = {"atk": raw["flatAttack"], "hp": raw["flatMaxHp"], "spd": raw["flatSpeed"], "cost": raw.get("cost")}
                self.assertEqual(row["stats"], stats, (name, row["sourceId"]))
                self.assertEqual({key: row[key] for key in stats}, stats, (name, row["sourceId"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
