import json
from pathlib import Path

BASE = Path("apkfiles/entries")

errors = []
checked = 0

for category in ["characters", "weapons", "accessories", "bosses"]:
    index_path = BASE / category / "index.json"
    if not index_path.exists():
        errors.append(f"Missing index: {category}")
        continue

    index = json.loads(index_path.read_text(encoding="utf-8"))
    for entry in index.get("entries", []):
        checked += 1
        file_path = BASE / entry["file"]
        if not file_path.exists():
            errors.append(f"Missing file: {entry['file']}")
            continue

        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
        except Exception as e:
            errors.append(f"Invalid JSON: {entry['file']} -> {e}")
            continue

        if "name" not in data:
            errors.append(f"Missing name: {entry['file']}")

        if "_build" not in data:
            errors.append(f"Missing build marker: {entry['file']}")

print(f"Checked: {checked}")
print(f"Errors: {len(errors)}")

report_path = BASE / "reports" / "validation_report.json"
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps({"errors": errors}, indent=2), encoding="utf-8")

print("Report written to", report_path)
