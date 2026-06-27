# Evertale Entry Pipeline

All repository Python tooling now lives in `tools/new_structure`.

## What creates public Catalog data

`MASTER_CONTROL.py` is the single launcher. It locates the repository from the
script's own path, so it can be started from the repository root, from
`tools/new_structure`, or from another working directory.

The public-data chain is:

1. `build_apk_entry_folders.py` reads `Monster.json`, `Weapon.json`,
   `Equipment.json`, and `Boss.json`, then creates category entry files and
   indexes under `apkfiles/entries`.
2. `sync_category_order_canonical.py` preserves existing order and appends new
   characters, weapons, accessories, and bosses.
3. `build_entry_bundles.py` creates the four category bundles and
   `catalog.bundle.json` consumed by the website.
4. `validate_entries.py` checks that indexes and public bundles agree.
5. `update_live_data_config_version.py` changes the browser cache token when
   the generated Catalog bundle changes.

Use `--extract` when the four raw APK JSON files changed. The default command
only rebuilds public outputs from entry files that already exist.

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
