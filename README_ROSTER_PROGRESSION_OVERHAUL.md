# Roster Progression Overhaul

This patch converts roster progression from a calibration-heavy debug flow into a normal roster workflow.

## What changed

- Added `roster-profile-store.js`
  - Local-only profile storage.
  - Account/player level and fellowship settings.
  - Export/import backup support.
  - Lightweight stat estimator for optimizer scoring.
  - Does not mutate raw `apkfiles/entries`.

- Added `roster-profile-ui.js`
  - Adds a universal roster progression panel.
  - Adds Advanced toggle.
  - Adds Player Level and Fellowship controls.
  - Adds a progression editor under each roster card.
  - Saves Level, Awakened, Potential, Bonus, Mastery, and advanced Boost/Ascended.
  - Automatically marks Ascended when level > 100 and awakening is 4/4.

- Patched `roster.html`
  - Loads the profile store and roster profile UI.

- Patched `optimizer.html`
  - Loads profile store before the optimizer engine.

- Patched `optimizerEngine.js`
  - Optimizer now uses locally saved roster progression estimates when available.

- Patched `app.js`
  - Exposes roster page state for the progression overlay without changing raw data loading.

- Patched `style.css`
  - Adds responsive styling for the roster progression UI.

## Normal workflow

1. Go to Roster.
2. Set universal Player Level and Fellowship buffs.
3. Open each owned unit card.
4. Enter Level, Awakening, Potential, Bonus, and Mastery.
5. Optional: turn Advanced on for Boost and Ascended.
6. Profiles save automatically to local browser cache.
7. Go to Optimizer; it uses the saved roster data for better team ranking.

## Backup workflow

Use **Export Backup** to download a text/JSON profile backup.

Use **Import Backup** to restore it later if browser cache is cleared.

## Important

The level engine is still marked WIP because the exact hidden upstream growth table is not fully recovered yet.
The raw APK files remain untouched. The profile layer is read-only from the project perspective and only writes to browser localStorage.
