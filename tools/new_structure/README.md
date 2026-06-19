# Evertale Entry Pipeline

All repository Python tooling now lives in `tools/new_structure`.

## Main Commands

Safe rebuild from existing `apkfiles/entries`:

```powershell
python tools/new_structure/MASTER_CONTROL.py
```

Extract fresh game data from `apkfiles` and rebuild runtime outputs:

```powershell
python tools/new_structure/MASTER_CONTROL.py --extract
```

Ignore partial resume markers but keep unchanged-entry hash skips:

```powershell
python tools/new_structure/MASTER_CONTROL.py --extract --no-resume
```

Rebuild every extracted entry from raw files:

```powershell
python tools/new_structure/MASTER_CONTROL.py --extract --force
```

## Resume Markers

Extraction writes category markers in `apkfiles/entries/_markers`.

- Default extraction resumes after the last partial marker.
- Existing entries with matching `_build` hashes are skipped.
- `--no-resume` ignores partial markers.
- `--force` rebuilds all extraction outputs.

The master script resolves the main repo from its own file path, so it can be launched from the repo root or from nested folders.
