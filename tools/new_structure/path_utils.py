from __future__ import annotations

import json
import ntpath
import os
import re
import sys
from pathlib import Path
from typing import Any, Iterable

DEFAULT_ROOT_MARKERS = ("apkfiles", "tools")


def display_path(value: str | Path, repo_root: str | Path | None = None) -> str:
    """Format provenance only; never use this result for filesystem access."""
    raw = os.fspath(value)
    root = os.fspath(repo_root) if repo_root is not None else str(find_repo_root())
    windows = bool(re.match(r"^(?:[A-Za-z]:[\\/]|\\\\)", raw))
    foreign_windows = os.name != "nt" and (windows or bool(ntpath.splitdrive(root)[0]))
    if foreign_windows:
        canonical_root = ntpath.normpath(root)
        canonical = ntpath.normpath(raw if ntpath.isabs(raw) else ntpath.join(canonical_root, raw))
        try:
            inside = ntpath.commonpath([canonical, canonical_root]).casefold() == canonical_root.casefold()
        except ValueError:
            inside = False
        if inside:
            return ntpath.relpath(canonical, canonical_root).replace("\\", "/")
        basename = ntpath.basename(canonical)
        canonical = ntpath.normcase(canonical)
    else:
        resolved_root = Path(root).resolve()
        candidate = Path(raw)
        resolved = (candidate if candidate.is_absolute() else resolved_root / candidate).resolve()
        try:
            return resolved.relative_to(resolved_root).as_posix()
        except ValueError:
            pass
        canonical, basename = ntpath.normcase(str(resolved)) if os.name == "nt" else str(resolved), resolved.name
    if re.fullmatch(r"python(?:w)?(?:\d+(?:\.\d+)*)?(?:\.exe)?", basename, re.I):
        return basename.lower()
    # Outside the repo, keep only the filename. A bare user-profile folder name
    # (for example the segment after Users/ or home/) is never published.
    parts = [part for part in re.split(r"[\\/]+", canonical) if part]
    profile_names = {parts[i + 1].casefold() for i, part in enumerate(parts[:-1]) if part.casefold() in ("users", "home")}
    if not basename:
        return "external/path"
    if basename.casefold() in profile_names:
        return "external/user-profile"
    return "external/" + basename


def display_text(value: str, repo_root: str | Path | None = None) -> str:
    """Redact path-shaped fragments while retaining diagnostic prose."""
    root = os.fspath(repo_root) if repo_root is not None else str(find_repo_root())
    text = value
    # Known complete prefixes cover spaces and JSON-escaped diagnostic paths.
    canonical_root = ntpath.normpath(root) if os.name != "nt" and ntpath.splitdrive(root)[0] else str(Path(root).resolve())
    for original, replacement in [(canonical_root, "."), (sys.executable, Path(sys.executable).name)]:
        variants = {original, original.replace("\\", "/")}
        variants |= {item.replace("\\", "\\\\") for item in list(variants)}
        for variant in sorted(variants, key=len, reverse=True):
            text = re.sub(re.escape(variant) + r"(?=$|[\\/\s\"':,;)])", lambda _: replacement, text, flags=re.I if ntpath.splitdrive(original)[0] else 0)
    quoted = re.compile(r"(?P<quote>[\"'])(?P<path>[A-Za-z]:[\\/]+[^\r\n\"']+)(?P=quote)")
    text = quoted.sub(lambda match: match['quote'] + display_path(match['path'], root) + match['quote'], text)
    # Unquoted filenames may include spaces; recognize the complete filename first.
    filename = re.compile(r"(?<![\w/])[A-Za-z]:[\\/]+[^\r\n\"'<>|;:]*?\.(?:json|py|exe|txt|csv|md|zip)(?=$|[\s\"',;:)])", re.I)
    text = filename.sub(lambda match: display_path(match[0].rstrip(), root), text)
    token = re.compile(r"(?<![\w/])[A-Za-z]:[\\/]+[^\s\"'<>|,;:]+")
    return token.sub(lambda match: display_path(match[0], root), text)


def display_command(command: Iterable[str], repo_root: str | Path | None = None) -> list[str]:
    """Copy command arguments for reports without changing executable argv."""
    result = []
    for argument in command:
        value = os.fspath(argument)
        absolute = Path(value).is_absolute() or bool(re.match(r"^(?:[A-Za-z]:[\\/]|\\\\)", value))
        result.append(display_path(value, repo_root) if absolute else display_text(value, repo_root))
    return result


def display_metadata(value: Any, repo_root: str | Path | None = None) -> Any:
    """Return a display-only copy; fail rather than collapse redacted keys."""
    if isinstance(value, dict):
        result = {}
        for key, child in value.items():
            path_key = isinstance(key, str) and (bool(ntpath.splitdrive(key)[0]) or key.startswith("/"))
            safe_key = display_path(key, repo_root) if path_key else display_metadata(key, repo_root) if isinstance(key, str) else key
            if safe_key in result:
                raise ValueError("Display-path dictionary key collision")
            path_fields = {"path", "repoRoot", "entriesRoot", "bundlesRoot", "cwd", "launchedFrom", "inputFolder", "source", "target", "input", "output", "rawFile", "folder", "canonicalFile", "indexFile", "orderMap", "mapFile", "script"}
            absolute_child = isinstance(child, str) and (bool(ntpath.splitdrive(child)[0]) or child.startswith("/"))
            result[safe_key] = display_path(child, repo_root) if key in path_fields and absolute_child else display_metadata(child, repo_root)
        return result
    if isinstance(value, list):
        return [display_metadata(child, repo_root) for child in value]
    if isinstance(value, tuple):
        return tuple(display_metadata(child, repo_root) for child in value)
    if isinstance(value, Path):
        return display_path(value, repo_root)
    if isinstance(value, str):
        return display_text(value, repo_root)
    return value


def display_report(value: Any, output_path: Path) -> Any:
    """Sanitize report copies without changing data hashed by other writers."""
    return display_metadata(value) if "reports" in output_path.parts else value


def configure_utf8_stdio() -> None:
    """Keep Windows consoles from failing on localized game text."""
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (OSError, ValueError):
                pass


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
