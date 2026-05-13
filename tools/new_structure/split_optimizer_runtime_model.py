#!/usr/bin/env python3
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict

ROOT_MARKERS = ["apkfiles", "tools"]
RUNTIME_REL = "apkfiles/entries/runtime"
SOURCE_FILE = "optimizer_runtime_model.json"

CHUNKS = {
    "characters": "optimizer_runtime_characters.json",
    "characterEntries": "optimizer_runtime_character_entries.json",
    "weapons": "optimizer_runtime_weapons.json",
    "accessories": "optimizer_runtime_accessories.json",
    "bosses": "optimizer_runtime_bosses.json",
    "tags": "optimizer_runtime_tags.json",
    "optimizerKnowledge": "optimizer_runtime_knowledge.json",
}


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for folder in [cur, *cur.parents]:
        if all((folder / marker).exists() for marker in ROOT_MARKERS):
            return folder
    raise SystemExit("ERROR: Could not locate repo root")


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)


def write_json(path: Path, data: Any, compact: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(data, ensure_ascii=False, indent=2)
    path.write_text(text + "\n", encoding="utf-8", newline="\n")


def count_payload(value: Any) -> int:
    if isinstance(value, dict):
        return len(value)
    if isinstance(value, list):
        return len(value)
    return 1 if value is not None else 0


def main() -> int:
    repo = find_repo_root(Path.cwd())
    runtime_dir = repo / RUNTIME_REL
    source_path = runtime_dir / SOURCE_FILE
    model = load_json(source_path)
    generated_at = int(time.time())

    manifest: Dict[str, Any] = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "sourceGeneratedAt": model.get("generatedAt"),
        "source": SOURCE_FILE,
        "runtimeFlags": model.get("runtimeFlags", {}),
        "chunks": {},
    }

    for key, filename in CHUNKS.items():
        payload = model.get(key, {} if key != "optimizerKnowledge" else {"sources": []})
        chunk = {
            "schemaVersion": 1,
            "generatedAt": generated_at,
            "chunk": key,
            "count": count_payload(payload),
            "data": payload,
        }
        write_json(runtime_dir / filename, chunk, compact=True)
        manifest["chunks"][key] = {
            "file": filename,
            "count": chunk["count"],
        }

    write_json(runtime_dir / "optimizer_runtime_manifest.json", manifest, compact=False)
    print(json.dumps({"status": "ok", "chunks": manifest["chunks"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
