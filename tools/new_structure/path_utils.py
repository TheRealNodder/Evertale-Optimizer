from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

DEFAULT_ROOT_MARKERS = ("apkfiles", "tools")


def find_repo_root(start: Path | None = None, markers: Iterable[str] = DEFAULT_ROOT_MARKERS) -> Path:
    current = (start or Path(__file__)).expanduser().resolve()
    if current.is_file():
        current = current.parent

    marker_tuple = tuple(markers)
    for folder in (current, *current.parents):
        if all((folder / marker).exists() for marker in marker_tuple):
            return folder

    marker_text = ", ".join(marker_tuple)
    raise SystemExit(f"ERROR: Could not locate Evertale-Optimizer repo root from {current} using markers: {marker_text}")


def resolve_repo_path(repo_root: Path, value: str | Path | None, default: str | Path) -> Path:
    raw = Path(default if value is None else value).expanduser()
    if raw.is_absolute():
        return raw.resolve()
    return (repo_root / raw).resolve()


def read_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def write_json(path: Path, data: Any, *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(data, ensure_ascii=False, indent=2)
    path.write_text(text + "\n", encoding="utf-8", newline="\n")
