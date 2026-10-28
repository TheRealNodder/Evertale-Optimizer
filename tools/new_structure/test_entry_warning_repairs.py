"""Regression coverage for warning causes, not warning-count suppression."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from audit_master_field_contract import audit_display_sources, warning_summary
from build_apk_entry_folders import ability_localization, dependency_fingerprint_for_ability, display_authority, weapon_family_descriptions
from validate_entries import validate_index_order

REPO = Path(__file__).resolve().parents[2]


class EntryWarningRepairTests(unittest.TestCase):
    def check_order(self, category, rows):
        errors, warnings = [], []
        validate_index_order(category, rows, errors, warnings)
        return errors, warnings

    def test_descending_weapon_order_is_intentional_but_scrambling_is_not(self):
        rows = [{"order": n, "sourceOrder": n, "fileHandleOrder": n, "file": f"entries/{n:04d}_Weapon.json"} for n in [3, 2, 1]]
        self.assertEqual(self.check_order("weapons", rows), ([], []))
        self.assertTrue(self.check_order("weapons", [rows[1], rows[0], rows[2]])[1])

    def test_boss_catalog_positions_need_not_follow_chronological_handles(self):
        rows = [{"order": i, "sourceOrder": i, "fileHandleOrder": h, "file": f"entries/{h:04d}_Boss.json"} for i, h in enumerate([6, 7, 1], 1)]
        self.assertEqual(self.check_order("bosses", rows), ([], []))
        self.assertTrue(self.check_order("bosses", list(reversed(rows)))[1])

    def test_duplicate_orders_and_false_handle_metadata_are_errors(self):
        rows = [{"order": 1, "fileHandleOrder": 7, "file": "entries/0001_A.json"}, {"order": 1, "file": "entries/0002_B.json"}]
        errors, _ = self.check_order("characters", rows)
        self.assertEqual(len(errors), 2)

    def test_explicit_ability_aliases_resolve_each_field_without_clobbering(self):
        loc = {"VariantNameKey": "Exact Name", "BaseNameKey": "Base Name", "BaseDescriptionKey": "Gains 1 Spirit."}
        ability = {"nameKey": "Base", "descriptionKey": "Base"}
        self.assertEqual(ability_localization(loc, "Variant", ability), {"name": "Exact Name", "description": "Gains 1 Spirit."})
        self.assertEqual(ability_localization(loc, "Unknown", {}), {})
        self.assertEqual(ability_localization(loc, "Variant", {"descriptionKey": "BaseDescriptionKey"})["description"], "Gains 1 Spirit.")

    def test_weapon_description_requires_real_explicit_family_base(self):
        items = [{"name": "Sword01", "family": "Sword"}, {"name": "Sword02", "family": "Sword"}]
        loc = {"Sword01DescriptionKey": "Shared source description."}
        resolvers = {"Localizable": loc, "WeaponFamilyDescriptions": weapon_family_descriptions(items, loc)}
        derived = display_authority({"name": "Sword02", "family": "Sword", "stars": 6}, "weapons", resolvers)
        self.assertEqual(derived["description"], loc["Sword01DescriptionKey"])
        self.assertEqual(derived["fieldSources"]["description"]["sourceId"], "Sword01")
        self.assertEqual(display_authority({"name": "Swordish02"}, "weapons", resolvers)["description"], "")
        loc["Sword02DescriptionKey"] = "Form-specific description."
        self.assertEqual(display_authority(items[1], "weapons", resolvers)["description"], "Form-specific description.")

    def test_equipment_rarity_matches_existing_frontend_not_evolved_stars(self):
        resolvers = {"Localizable": {}}
        for stars, rarity in [(0, "N"), (1, "N"), (2, "N"), (3, "R"), (4, "SR"), (5, "SSR"), (6, "SSR")]:
            self.assertEqual(display_authority({"name": "Item", "stars": stars, "evolvedStars": 6}, "weapons", resolvers)["rarity"], rarity)
        self.assertIsNone(display_authority({"name": "Item"}, "accessories", resolvers)["rarity"])
        self.assertEqual(display_authority({"name": "Item", "accessoryStars": 4}, "accessories", resolvers)["rarity"], "SR")

    def test_alias_localization_is_included_in_incremental_fingerprint(self):
        resolvers = {"Ability": {"Variant": {"nameKey": "Base"}}, "Localizable": {"BaseNameKey": "Before"}}
        before = dependency_fingerprint_for_ability("Variant", resolvers)
        resolvers["Localizable"]["BaseNameKey"] = "After"
        self.assertNotEqual(before, dependency_fingerprint_for_ability("Variant", resolvers))

    def test_available_but_unpromoted_text_is_not_classified_as_source_absent(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = Path(folder)
            (repo / "apkfiles").mkdir()
            (repo / "apkfiles/Localizable_English.txt").write_text('"Unit01DescriptionKey"="Authoritative description"\n', encoding="utf-8")
            for category in ["characters", "weapons", "accessories", "bosses"]:
                root = repo / f"apkfiles/entries/{category}"
                root.mkdir(parents=True)
                rows = [{"file": "unit.json"}] if category == "characters" else []
                (root / "index.json").write_text(json.dumps({"entries": rows}), encoding="utf-8")
                if rows:
                    (root / "unit.json").write_text(json.dumps({"sourceId": "Unit01", "raw": {}}), encoding="utf-8")
            gaps, errors = audit_display_sources(repo)
            self.assertTrue(any(row["field"] == "description" and row["reason"] == "generation_gap" for row in gaps))
            self.assertTrue(any("available source authority" in error for error in errors))

    def test_generated_dojo_aliases_restore_all_form_evidence(self):
        root = REPO / "apkfiles/entries/runtime"
        evidence = json.loads((root / "optimizer_runtime_feature_evidence.json").read_text(encoding="utf-8"))
        # Runtime chunk envelopes expose their collection under data.
        evidence = evidence.get("data", evidence)
        for source_id in ["AirGenieDojo01", "FireBirdDojo01", "FireBirdDojo02"]:
            self.assertTrue(evidence.get(source_id), source_id)

    def test_generated_indexes_and_sources_have_no_recoverable_gaps(self):
        for category in ["characters", "weapons", "accessories", "bosses"]:
            rows = json.loads((REPO / f"apkfiles/entries/{category}/index.json").read_text(encoding="utf-8"))["entries"]
            self.assertEqual(self.check_order(category, rows), ([], []), category)
        gaps, errors = audit_display_sources(REPO)
        self.assertEqual(errors, [])
        self.assertTrue(all(row["reason"] == "source_unavailable" and row["sourcesChecked"] for row in gaps))

    def test_full_warning_report_retains_every_detail(self):
        report = json.loads((REPO / "apkfiles/entries/reports/master_field_contract_audit_report.json").read_text(encoding="utf-8"))
        self.assertEqual(report["warningCount"], len(report["warnings"]))
        self.assertEqual(report["warningCount"], sum(warning_summary(report["warnings"]).values()))
        self.assertEqual(report["sourceGapCount"], len(report["sourceGaps"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
