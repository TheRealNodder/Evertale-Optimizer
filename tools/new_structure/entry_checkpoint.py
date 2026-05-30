#!/usr/bin/env python3
"""
Shared checkpoint / marker helper for entry-generation tools.

Purpose:
- Long-running entry tools can resume from the last processed entry.
- Each run overwrites one marker file per tool/category.
- Marker files live in apkfiles/entries/_markers/.

The marker is intentionally small and human-readable.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, Optional

MARKER_DIR_REL = Path("apkfiles/entries/_markers")


def marker_name(tool_name: str, category: str) -> str:
    safe_tool = "".join(ch if ch.isalnum() or ch in "_-" else "_" for ch in tool_name.strip())
    safe_category = "".join(ch if ch.isalnum() or ch in "_-" else "_" for ch in category.strip())
    return f"{safe_tool}_{safe_category}.marker.json"


def marker_path(repo_root: Path, tool_name: str, category: str) -> Path:
    return repo_root / MARKER_DIR_REL / marker_name(tool_name, category)


def load_marker(repo_root: Path, tool_name: str, category: str) -> Optional[Dict[str, Any]]:
    path = marker_path(repo_root, tool_name, category)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def write_marker(
    repo_root: Path,
    tool_name: str,
    category: str,
    *,
    status: str,
    last_key: str = "",
    last_source_id: str = "",
    last_handle: Optional[int] = None,
    last_file: str = "",
    processed_count: int = 0,
    total_count: int = 0,
    extra: Optional[Dict[str, Any]] = None,
) -> Path:
    path = marker_path(repo_root, tool_name, category)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload: Dict[str, Any] = {
        "schemaVersion": 1,
        "tool": tool_name,
        "category": category,
        "status": status,
        "lastKey": last_key,
        "lastSourceId": last_source_id,
        "lastHandle": last_handle,
        "lastFile": last_file,
        "processedCount": processed_count,
        "totalCount": total_count,
        "updatedAt": int(time.time()),
    }
    if extra:
        payload["extra"] = extra
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    return path


def should_skip_from_marker(marker: Optional[Dict[str, Any]], source_id: str, handle: Optional[int] = None) -> bool:
    """Return True when a future incremental tool wants to skip already-processed rows.

    Current renumber tools still validate the full ordered list by default. This helper is for
    future APK/list ingest tools that generate new entries and can resume from the marker.
    """
    if not marker or marker.get("status") != "partial":
        return False
    last_source = str(marker.get("lastSourceId") or "")
    last_handle = marker.get("lastHandle")
    if handle is not None and isinstance(last_handle, int):
        return handle <= last_handle
    return bool(last_source and source_id and source_id <= last_source)
