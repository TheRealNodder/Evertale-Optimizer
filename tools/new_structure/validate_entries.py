import json
from pathlib import Path

# =========================================================
# Universal Entry Validator v2
# =========================================================
# Run this from ANYWHERE inside the Evertale-Optimizer repo.
#
# Fixes:
# - Correctly handles index paths like entries/0001_Name.json
# - Validates apkfiles/entries/<category>/entries/*.json
# - Writes validation report to apkfiles/entries/reports/
#
# Usage:
#   python validate_entries_v2.py
# =========================================================

ROOT_MARKERS = ["apkfiles", "tools"]
CATEGORIES = ["characters", "weapons", "accessories", "bosses"]


def find_repo_root(start: Path):
    current = start.resolve()
    for folder in [current] + list(current.parents):
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    return None


def resolve_entry_path(base: Path, category_dir: Path, rel_file: str) -> Path:
    """
    Index files currently store paths like:
      entries/0001_Name.json

    Those paths are relative to:
      apkfiles/entries/<category>/

    So characters/index.json entry "entries/0001_X.json" means:
      apkfiles/entries/characters/entries/0001_X.json
    """
    rel = rel_file.replace("\\", "/").strip()

    if rel.startswith("entries/"):
        return category_dir / rel

    category_relative = category_dir / rel
    if category_relative.exists():
        return category_relative

    return base / rel


def validate():
    start = Path.cwd()
    repo_root = find_repo_root(start)

    if not repo_root:
        print("ERROR: Could not locate Evertale-Optimizer repo root.")
        print("Run this from anywhere inside the repo folder.")
        return 1

    base = repo_root / "apkfiles" / "entries"

    if not base.exists():
        print(f"ERROR: Missing entries folder:\n{base}")
        return 1

    errors = []
    warnings = []
    checked = 0
    category_counts = {}

    print("=" * 60)
    print("Evertale Optimizer Entry Validator v2")
    print("=" * 60)
    print(f"Repo Root : {repo_root}")
    print(f"Entries   : {base}")
    print()

    for category in CATEGORIES:
        print(f"Checking category: {category}")

        category_dir = base / category
        index_path = category_dir / "index.json"

        if not category_dir.exists():
            errors.append(f"[{category}] Missing category folder: {category_dir}")
            category_counts[category] = 0
            continue

        if not index_path.exists():
            errors.append(f"[{category}] Missing index.json")
            category_counts[category] = 0
            continue

        try:
            index_data = json.loads(index_path.read_text(encoding="utf-8"))
        except Exception as e:
            errors.append(f"[{category}] Invalid index.json -> {e}")
            category_counts[category] = 0
            continue

        entries = index_data.get("entries", [])

        if not isinstance(entries, list):
            errors.append(f"[{category}] entries is not a list")
            category_counts[category] = 0
            continue

        category_counts[category] = len(entries)

        for entry in entries:
            checked += 1

            rel_file = entry.get("file")
            source_id = entry.get("sourceId", "UNKNOWN")

            if not rel_file:
                errors.append(f"[{category}] Missing file field in index for sourceId={source_id}")
                continue

            entry_path = resolve_entry_path(base, category_dir, rel_file)

            if not entry_path.exists():
                errors.append(f"[{category}] Missing entry file: {rel_file} -> checked {entry_path}")
                continue

            try:
                data = json.loads(entry_path.read_text(encoding="utf-8"))
            except Exception as e:
                errors.append(f"[{category}] Invalid JSON: {rel_file} -> {e}")
                continue

            for field in ["name", "category", "internal"]:
                if field not in data:
                    errors.append(f"[{category}] Missing '{field}' in {rel_file}")

            if "_build" not in data:
                warnings.append(f"[{category}] Missing _build marker: {rel_file}")

            if "image" not in data:
                warnings.append(f"[{category}] Missing image field: {rel_file}")

            if "refs" not in data:
                warnings.append(f"[{category}] Missing refs field: {rel_file}")

            if "resolved" not in data:
                warnings.append(f"[{category}] Missing resolved field: {rel_file}")

    print()
    print("=" * 60)
    print("Validation Complete")
    print("=" * 60)
    print(f"Checked Entries : {checked}")
    print(f"Errors          : {len(errors)}")
    print(f"Warnings        : {len(warnings)}")
    print()

    print("Category Counts:")
    for category, count in category_counts.items():
        print(f"- {category}: {count}")

    report = {
        "validatorVersion": 2,
        "repoRoot": str(repo_root),
        "entriesRoot": str(base),
        "checked": checked,
        "categoryCounts": category_counts,
        "errors": errors,
        "warnings": warnings,
    }

    reports_dir = base / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    report_path = reports_dir / "validation_report.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print()
    print(f"Validation report written to:\n{report_path}")

    if errors:
        print()
        print("Top Errors:")
        for err in errors[:20]:
            print("-", err)

    if warnings:
        print()
        print("Top Warnings:")
        for warn in warnings[:20]:
            print("-", warn)

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(validate())
