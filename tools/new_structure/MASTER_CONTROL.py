#!/usr/bin/env python3
"""Universal Master Control for the Evertale extraction/ingest pipeline.

Local no-argument launches open a small three-choice GUI. Explicit CLI flags
keep their existing behavior, and CI/GitHub Actions never open the GUI.
"""
from __future__ import annotations

import argparse
import json
import os
import queue
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Dict, List

from path_utils import configure_utf8_stdio, find_repo_root, resolve_repo_path

MASTER_SCHEMA_VERSION = 4
SAFE_INGEST_REL = "tools/new_structure/run_safe_new_data_ingest.py"
REPORT_REL = "apkfiles/entries/reports/master_control_report.json"


def subprocess_env() -> Dict[str, str]:
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env.setdefault("PYTHONUTF8", "1")
    return env


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def run_step(repo: Path, label: str, command: List[str], dry_run: bool = False) -> Dict[str, Any]:
    started = time.time()
    result: Dict[str, Any] = {
        "label": label,
        "command": command,
        "dryRun": dry_run,
        "startedAt": int(started),
        "cwd": str(repo),
        "encoding": "utf-8/errors=replace",
    }
    print(f"\n[MASTER CONTROL] {label}")
    print("[MASTER CONTROL] Command:", " ".join(command))
    print("[MASTER CONTROL] CWD:", repo)

    if dry_run:
        result.update({"returnCode": 0, "durationSeconds": 0, "skipped": True})
        return result

    proc = subprocess.run(
        command,
        cwd=str(repo),
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        env=subprocess_env(),
    )
    stdout = proc.stdout or ""
    stderr = proc.stderr or ""
    result.update({
        "returnCode": proc.returncode,
        "durationSeconds": round(time.time() - started, 3),
        "stdoutTail": stdout[-6000:],
        "stderrTail": stderr[-6000:],
    })
    if stdout:
        print(stdout)
    if stderr:
        print(stderr, file=sys.stderr)
    if proc.returncode != 0:
        raise RuntimeError(f"Step failed: {label} returned {proc.returncode}")
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="MASTER CONTROL: safely ingest existing data or extract fresh Evertale game JSON."
    )
    parser.add_argument("--extract", action="store_true", help="Extract fresh game JSON before rebuilding.")
    parser.add_argument("--input", help="Optional extraction input folder. Defaults to ./apkfiles.")
    parser.add_argument("--raw", dest="input", help=argparse.SUPPRESS)
    parser.add_argument("--force", action="store_true", help="Redo all extraction output. Requires --extract.")
    parser.add_argument("--no-resume", action="store_true", help="Ignore partial extraction markers. Requires --extract.")
    parser.add_argument("--full-audit", action="store_true", help="Compatibility flag for older callers.")
    parser.add_argument("--dry-run", action="store_true", help="Print planned steps without running them.")
    parser.add_argument("--gui", action="store_true", help="Open the local three-choice GUI.")
    parser.add_argument("--no-gui", action="store_true", help="Run the default safe ingest in the console.")
    return parser


def validate_args(args: argparse.Namespace) -> None:
    if args.gui and args.no_gui:
        raise SystemExit("ERROR: --gui and --no-gui cannot be used together.")
    if args.force and not args.extract:
        raise SystemExit("ERROR: --force requires --extract.")
    if args.no_resume and not args.extract:
        raise SystemExit("ERROR: --no-resume requires --extract.")


def build_safe_ingest_command(repo: Path, args: argparse.Namespace) -> List[str]:
    command = [sys.executable, str(repo / SAFE_INGEST_REL)]
    if args.extract:
        command.append("--extract")
        command.extend(["--raw", str(resolve_repo_path(repo, args.input, "apkfiles"))])
    elif args.input:
        raise SystemExit("ERROR: --input requires --extract.")
    if args.force:
        command.append("--force")
    if args.full_audit:
        command.append("--full-audit")
    if args.no_resume:
        command.append("--no-resume")
    if args.dry_run:
        command.append("--dry-run")
    return command


def run_master_control(repo: Path, args: argparse.Namespace) -> int:
    validate_args(args)
    safe_ingest = repo / SAFE_INGEST_REL
    if not safe_ingest.exists():
        raise FileNotFoundError(f"Missing safe ingest runner: {safe_ingest}")

    mode = "extract-force-redo-all" if args.extract and args.force else "extract-from-apkfiles" if args.extract else "fast-safe-rebuild"
    report: Dict[str, Any] = {
        "schemaVersion": MASTER_SCHEMA_VERSION,
        "generatedAt": int(time.time()),
        "repoRoot": str(repo),
        "launchedFrom": str(Path.cwd()),
        "mode": mode,
        "inputFolder": str(resolve_repo_path(repo, args.input, "apkfiles")) if args.extract else None,
        "dryRun": bool(args.dry_run),
        "resume": not args.no_resume,
        "subprocessEncoding": "utf-8/errors=replace",
        "steps": [],
        "notes": [
            "The launcher works from the repo root, tools/new_structure, or another working directory.",
            "Local no-argument runs open the GUI; explicit flags retain CLI behavior.",
            "GitHub Actions and other CI environments never open the GUI.",
            "Safe Ingest rebuilds the existing apkfiles data without extraction.",
            "Extract reads fresh source JSON and preserves unchanged-entry skips.",
            "Extract Force (Redo all) passes --force to rebuild all extraction output.",
        ],
    }

    try:
        command = build_safe_ingest_command(repo, args)
        report["steps"].append(run_step(repo, "safe-new-data-ingest", command, dry_run=args.dry_run))
        report["ok"] = True
    except Exception as exc:
        report["ok"] = False
        report["error"] = str(exc)
        write_json(repo / REPORT_REL, report)
        print(f"[MASTER CONTROL] FAILED: {exc}", file=sys.stderr)
        return 1

    write_json(repo / REPORT_REL, report)
    print(f"\n[MASTER CONTROL] OK. Report written to {REPORT_REL}")
    return 0


def ci_environment() -> bool:
    return any(str(os.environ.get(name, "")).lower() in {"1", "true", "yes"} for name in ("CI", "GITHUB_ACTIONS"))


def gui_args(parser: argparse.ArgumentParser, mode: str) -> argparse.Namespace:
    choices = {
        "safe": ["--no-gui"],
        "extract": ["--extract"],
        "force": ["--extract", "--force"],
    }
    return parser.parse_args(choices[mode])


def launch_gui(repo: Path, parser: argparse.ArgumentParser) -> int:
    try:
        import tkinter as tk
        from tkinter import messagebox, ttk
    except Exception as exc:
        print(f"[MASTER CONTROL] GUI unavailable ({exc}); running Safe Ingest in the console.")
        return run_master_control(repo, parser.parse_args(["--no-gui"]))

    root = tk.Tk()
    root.title("Evertale Optimizer — Master Control")
    root.geometry("520x330")
    root.minsize(460, 300)
    root.columnconfigure(0, weight=1)

    frame = ttk.Frame(root, padding=22)
    frame.grid(row=0, column=0, sticky="nsew")
    frame.columnconfigure(0, weight=1)
    ttk.Label(frame, text="Master Control", font=("Segoe UI", 18, "bold")).grid(row=0, column=0, sticky="w")
    ttk.Label(frame, text=f"Repository: {repo}", wraplength=470).grid(row=1, column=0, sticky="w", pady=(2, 14))

    status = tk.StringVar(value="Choose one operation.")
    results: queue.Queue[tuple[int, str, str]] = queue.Queue()
    buttons: List[Any] = []

    def set_buttons(enabled: bool) -> None:
        for button in buttons:
            button.configure(state="normal" if enabled else "disabled")

    def start(mode: str, label: str) -> None:
        set_buttons(False)
        status.set(f"Running {label}… This window will stay responsive.")

        def worker() -> None:
            try:
                code = run_master_control(repo, gui_args(parser, mode))
                error = ""
            except Exception as exc:
                code, error = 1, str(exc)
            results.put((code, label, error))

        threading.Thread(target=worker, daemon=True).start()

    options = [
        ("Safe Ingest", "Rebuild safely from the JSON already in apkfiles.", "safe"),
        ("Extract", "Extract fresh JSON, then run the safe ingest pipeline.", "extract"),
        ("Extract Force (Redo all)", "Force extraction and rebuild every output.", "force"),
    ]
    for row, (label, description, mode) in enumerate(options, start=2):
        button = ttk.Button(frame, text=label, command=lambda m=mode, l=label: start(m, l))
        button.grid(row=row * 2, column=0, sticky="ew", pady=(0, 2))
        ttk.Label(frame, text=description, wraplength=470).grid(row=row * 2 + 1, column=0, sticky="w", pady=(0, 9))
        buttons.append(button)

    ttk.Separator(frame).grid(row=10, column=0, sticky="ew", pady=(4, 8))
    ttk.Label(frame, textvariable=status, wraplength=470).grid(row=11, column=0, sticky="w")

    def poll_results() -> None:
        try:
            code, label, error = results.get_nowait()
        except queue.Empty:
            root.after(150, poll_results)
            return
        set_buttons(True)
        if code == 0:
            status.set(f"{label} completed. Report: {REPORT_REL}")
            messagebox.showinfo("Master Control", f"{label} completed successfully.")
        else:
            detail = f" ({error})" if error else ""
            status.set(f"{label} failed{detail}. See {REPORT_REL} for details.")
            messagebox.showerror("Master Control", f"{label} failed{detail}. Check the report for details.")
        root.after(150, poll_results)

    root.after(150, poll_results)
    root.mainloop()
    return 0


def main() -> int:
    configure_utf8_stdio()
    parser = build_parser()
    argv = sys.argv[1:]
    args = parser.parse_args(argv)
    validate_args(args)
    repo = find_repo_root(Path(__file__).resolve())

    if args.gui or (not argv and not ci_environment()):
        return launch_gui(repo, parser)
    return run_master_control(repo, args)


if __name__ == "__main__":
    raise SystemExit(main())
