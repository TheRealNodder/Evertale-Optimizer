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

    def test_frontend_declares_and_checks_foundation_chunks(self) -> None:
        loader = (REPO / "optimizerRuntimeLoader.js").read_text(encoding="utf-8")
        bootstrap = (REPO / "optimizerRuntimeBootstrap.js").read_text(encoding="utf-8")
        for chunk in ("characters", "featureEvidence", "optimizerKnowledge", "tags"):
            self.assertIn(chunk, loader)
        self.assertIn("OPTIMIZER_FOUNDATION_CHUNKS", loader)
        self.assertIn("optimizerFoundationReady", bootstrap)

    def test_validation_reports_have_explicit_status(self) -> None:
        for name in ("validation_report.json", "master_field_contract_audit_report.json"):
            report = read_json(ENTRIES / "reports" / name)
            self.assertIn(report.get("status"), {"ok", "warning", "failed"}, name)
            self.assertIsInstance(report.get("errors"), list, name)
            self.assertIsInstance(report.get("warnings"), list, name)


if __name__ == "__main__":
    unittest.main(verbosity=2)
