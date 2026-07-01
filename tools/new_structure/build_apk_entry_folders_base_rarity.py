#!/usr/bin/env python3
"""
Base-form rarity wrapper for build_apk_entry_folders.py.

This keeps the large APK entry builder intact, but replaces the old family
rarity inference before the builder runs. The old logic used max(stars,
evolvedStars), which could promote evolved N/R/SR families into higher tiers.

Run directly or through run_universal_apk_builder.py.
"""
from __future__ import annotations

from typing import Any, Dict, List

import build_apk_entry_folders as builder


def _safe_int(value: Any) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


def _stars_to_rarity(base_stars: int) -> str:
    if base_stars >= 5:
        return "SSR"
    if base_stars == 4:
        return "SR"
    if base_stars == 3:
        return "R"
    return "N"


def infer_family_rarity(forms: List[Dict[str, Any]]) -> str:
    """Infer rarity from the true base form, not evolvedStars.

    Priority:
    1. Use the explicit Family01/base form when available.
    2. Fall back to the lowest numbered raw form.
    3. Fall back to the minimum positive stars in the family.
    4. Return N when nothing usable exists.

    evolvedStars is intentionally ignored for rarity classification. It is a
    form/evolution display signal, not the family rarity authority.
    """
    if not forms:
        return "N"

    base_forms = []
    numbered_forms = []
    positive_stars = []

    for item in forms:
        if not isinstance(item, dict):
            continue
        internal_id = builder.get_internal_id(item)
        form_number = builder.form_number_from_internal_id(internal_id)
        stars = _safe_int(item.get("stars"))
        if stars > 0:
            positive_stars.append(stars)
        if form_number == 1:
            base_forms.append(item)
        if form_number is not None:
            numbered_forms.append((form_number, item))

    if base_forms:
        return _stars_to_rarity(_safe_int(base_forms[0].get("stars")))

    if numbered_forms:
        numbered_forms.sort(key=lambda row: row[0])
        return _stars_to_rarity(_safe_int(numbered_forms[0][1].get("stars")))

    if positive_stars:
        return _stars_to_rarity(min(positive_stars))

    return "N"


builder.infer_family_rarity = infer_family_rarity
builder.SCRIPT_VERSION = "7-base-form-rarity"


if __name__ == "__main__":
    raise SystemExit(builder.main())
