# APK Files Workspace

This folder is the workspace for the new Evertale Optimizer data structure.

## Folder roles

```text
apkfiles/
  entries/        Generated entry output. Do not place raw APK JSON here.
  raw/            Raw APK/server JSON source files, when added later.
  bridge/         Compatibility files for connecting generated data to the old/current website.
  maps/           ID maps, image maps, lookup maps, and resolver maps.
  bundles/        ZIP exports and packaged generated datasets.
  reports/        Repo-level validation reports.
```

## Current status

`entries/` is the generated output folder. It should contain:

```text
entries/
  characters/
  weapons/
  accessories/
  bosses/
  resolvers/
  reports/
  README.md
```

The raw files are not supposed to live in `entries/`. Keep raw files separate in `raw/` or in a local input folder and run the builder.

## Builder scripts

```text
tools/new_structure/build_apk_entry_folders.py
tools/new_structure/run_universal_apk_builder.py
```

Universal run:

```powershell
python tools/new_structure/run_universal_apk_builder.py
```

Direct run:

```powershell
python tools/new_structure/build_apk_entry_folders.py --input apkfiles/raw --output apkfiles/entries
```

## Important rule

Do not overwrite old website files from this folder. The old/current website files remain under `data/` until the new structure is fully wired in.
