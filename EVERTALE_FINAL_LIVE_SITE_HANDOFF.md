# Evertale Optimizer Final Live Site Handoff

Date: 2026-06-12
Project: Finalized Zip / Evertale Optimizer
Repo: TheRealNodder/Evertale-Optimizer

This handoff preserves the logic, current state, fixes already pushed, remaining risks, and the exact next work needed so the next session can continue without re-mutating stable areas.

---

## 1. Hard instruction from user

Do not mutate stable paths unless the user explicitly asks.

Current stable areas that should not be touched casually:

- Generated data order logic that was already fixed.
- Master Control workflow unless new raw files are uploaded or user requests a pipeline change.
- Four-digit handle ordering rule.
- Parent-child/duo map rules.
- Sorting/data-order resolver path unless a verified regression is found.
- Raw entries, generated bundles, and validation reports unless running Master Control intentionally.

When changing UI behavior, keep the patch scoped to the exact visible behavior requested.

---

## 2. Current ordering rule and why it matters

The authoritative order for entries is the four-digit number at the beginning of the entry handle or file name.

Examples:

- `0001_...` is older.
- `0738_VictoriaRegular01.json` is newer.
- `0740_LupinRegular01.json` is newer than Victoria.

Rule:

- Smaller number = older entry.
- Larger number = newer entry.
- Newest Added must sort by highest four-digit order first.
- Oldest Added must sort by lowest four-digit order first.

Important fix already pushed:

- `data-loader.js` now preserves this order during normalization.
- Character family merge now uses the highest form order as the family order.
- `explorer_character_order.json` must only be treated as display/canonical name support, not newest-order authority.

Do not revert this.

---

## 3. Master Control / GitHub Actions status

The GitHub Actions workflow was created so the user can run Master Control manually only.

User workflow goal:

- User uploads new raw files.
- User manually runs GitHub Action.
- Action runs Master Control.
- It generates new entries, bundles, maps, reports, and commits output.

Do not make the workflow automatic unless user specifically asks.

The workflow succeeded after validator patches. The previous failure came from weapon family collapsing being treated as invalid. That was fixed by accepting weapon family-mode bundles.

Current expected run mode for a new raw drop:

```text
Actions → Evertale Master Control → Run workflow → extract_force
```

Only run workflow when:

- New raw files are uploaded/committed.
- The user explicitly wants the pipeline rebuilt.
- The Python extraction path is patched and needs generated outputs refreshed.

Do not run workflow for CSS/JS-only UI work.

---

## 4. Validator / weapon family-mode fix

Problem that was fixed:

Validation failed because weapons had raw/index count higher than visible family count.

Old error pattern:

```text
[weapons] Strict bundle count mismatch: index=833, bundle=355
[weapons] Strict bundle missing strictIndexOnly=true
[catalog] Category count mismatch for weapons: expected=833, actual=355
```

Correct interpretation:

- Weapons intentionally collapse raw/state rows into one visible card per weapon family.
- Bosses are strict-index.
- Weapons are not strict-index.

Patched validators:

- `tools/new_structure/validate_entries.py`
- root `validate_entries.py`

Current intended constants/logic:

```python
STRICT_INDEX_CATEGORIES = {"bosses"}
WEAPON_FAMILY_MODE = "weapon_family_handle_source_of_truth"
```

Do not undo this unless weapon bundle generation is redesigned.

---

## 5. Victoria and Lupin ingest status

The successful Action produced entries for Victoria and Lupin.

Confirmed generated files:

```text
Victoria:
apkfiles/entries/characters/entries/0738_VictoriaRegular01.json
apkfiles/entries/characters/entries/0739_VictoriaRegular02.json

Lupin:
apkfiles/entries/characters/entries/0740_LupinRegular01.json
apkfiles/entries/characters/entries/0741_LupinRegular02.json
```

Validation after successful run:

```text
characters: 741
errors: []
```

If they do not show on page, first suspect caching or UI filter/sort, not extraction.

---

## 6. Cache/versioning fixes pushed

Issue:

Generated entries existed, but the browser/GitHub Pages could keep loading old bundles because `live-data-config.js` and script query strings were stale.

Patched:

- `live-data-config.js`
- `index.html`
- `test-catalog-v2.html`
- `roster.html`
- `optimizer.html`

Important current cache versions:

```text
live-data-config.js?v=4
data-loader.js?v=4
catalog-sort.js?v=8
catalog-force-sort.js?v=2
catalog-v2-lite.js?v=15
leader-skill-resolver.js?v=2
test-catalog-v2-mobile-detail.css?v=4
test-catalog-v2-desktop-structure.js?v=1 currently in HTML, but file was patched after that and should be bumped to v=2 when possible.
```

Note:

A previous attempt to bump `test-catalog-v2-desktop-structure.js?v=1` to `v=2` in `test-catalog-v2.html` was blocked by connector safety because it required resending the full HTML. Next session should do a minimal/targeted patch if needed.

---

## 7. Sorting/UI resolver fixes pushed

Multiple sorting layers existed:

- `catalog.js`
- `catalog-sort.js`
- `catalog-force-sort.js`
- `catalog-v2-lite.js`
- `data-loader.js`

Important fixes already pushed:

### `data-loader.js`

Deep fix:

- Added/used `handleFromFile(file)`.
- Added/used `entryOrder(entry)`.
- Added/used `maxEntryOrder(rows)`.
- Normalization preserves:
  - `fileHandleOrder`
  - `sourceOrder`
  - `visualOrder`
  - `order`
- Merged character families receive the highest form order.
- `sortCharactersByMap()` now sorts by `entryOrder` descending, not canonical explorer map order.

### `catalog-sort.js`

- Newest and Oldest sort globally by order.
- A-Z/Z-A may keep category grouping.

### `catalog-force-sort.js`

Final UI guard:

- Runs after render and mutation.
- Applies visible-card sort by selected dropdown mode.
- Defaults first catalog load to Characters.
- Keeps All option available for manual user selection.
- Injects title-stack runtime CSS.

---

## 8. V2 desktop layout status

Primary V2 page:

```text
test-catalog-v2.html
```

Desktop structure patch:

```text
test-catalog-v2-desktop-structure.js
```

Current intended desktop V2 behavior:

- Left sticky sidebar becomes selected character info module.
- Top sticky area becomes filters/search/sort bar.
- Detail popup is not needed on desktop because the info module is sticky on the left.
- Desktop card grid targets four cards per row on wide desktop.
- Falls back to three cards on narrower desktop widths.
- Mobile behavior remains handled by mobile files.

Current desktop sticky selected-info module intent:

- It should fill visible page height.
- Portrait should be longer.
- Portrait should use `object-fit: contain` so it is fully visible.
- Stats should show as four matching badges.
- Details area has four buttons:
  - Description
  - Leader
  - Active
  - Passive
- Detail text should render in its own scrollable module.

Important note:

The script file `test-catalog-v2-desktop-structure.js` has been patched with these module behaviors. HTML may still load it as `?v=1`; bump to `?v=2` if browser does not pick it up.

---

## 9. Mobile title/name issue

Issue:

On mobile, the title was being pushed to the side because `.nameBlock` used a three-column grid for the info button and name, but `.unitTitle` was not explicitly assigned to a row/column.

Patched file:

```text
test-catalog-v2-mobile-detail.css
```

Current rule intent:

```text
nameBlock = two-row grid
row 1 left = info button
row 1 center = unitName
row 2 full width = unitTitle
```

HTML cache bumped:

```text
test-catalog-v2-mobile-detail.css?v=4
```

---

## 10. Desktop/mobile detail popup status

Mobile:

- Uses info/detail button.
- Opens popover-style detail card.
- Outside/backdrop close was improved.

Desktop:

- User requested to replace desktop detail popup with sticky selected-info sidebar.
- Desktop detail popups should be hidden or unnecessary because the selected info module is persistent.

Files involved:

- `test-catalog-v2-mobile-detail.css`
- `test-catalog-v2-detail-fix.js`
- `test-catalog-v2-desktop-structure.js`

Do not expand the card itself to show details on desktop. Use the independent sticky module instead.

---

## 11. Current critical unfinished item: leader skill extraction from Localizable_English

User’s current priority:

> Leader skills are not being extracted from Localizable_English. Old legacy files have leader-skill data/maps. Python must be fixed so it searches the specific wording/keys and populates leader_skill_localization.json correctly.

Current Python extractor:

```text
tools/new_structure/extract_localizable_groups.py
root extract_localizable_groups.py
```

It outputs:

```text
apkfiles/entries/localization/localizable_groups.json
apkfiles/entries/localization/localizable_groups_by_category.json
apkfiles/entries/localization/leader_skill_localization.json
apkfiles/entries/localization/localizable_group_report.json
```

Current repo issue:

```text
apkfiles/entries/localization/leader_skill_localization.json
```

is effectively empty in the current repo output.

Existing Python extractor logic already has leader-skill detection patterns:

- `ELEMENT_WORD_RE`
- `LEADER_STAT_RE`
- `LEADER_COMBO_RE`
- `LEADER_BASE_RE`
- `is_true_leader_skill_text()`
- `build_leader_skill_map()`

But this detection is apparently too narrow or looking at the wrong Localizable key family.

Legacy files found:

```text
legacy/legacy_unused/data/leader_skills.json
legacy/legacy_unused/scraper/build_leader_skills_from_characters.mjs
legacy/legacy_unused/scraper/merge_leader_skills_into_items.mjs
legacy/legacy_unused/scraper/merge_leader_ skills_from_characters.mjs
legacy/legacy_unused/scraper/merge_leader_skill_assignments_into_characters.mjs
```

Legacy data sample:

```json
{
  "character": "Thor Apocalyptic Thunder God",
  "element": "Storm",
  "name": "Storm HP Up",
  "description": "Allied Storm element units have their mac HP increased by 10%"
}
```

Legacy mapping logic to preserve conceptually:

- Build a leader skill list/map from readable character leader skill fields when available.
- Merge assignments by unit key or name/title.
- Template map can use `(leaderSkillKey, conditionKey)` -> readable text.

Key legacy insight from `merge_leader_skill_assignments_into_characters.mjs`:

- It stores `leaderSkillKey` and `leaderSkillConditionKey` on characters.
- It optionally maps `(leaderSkillKey, conditionKey)` to readable text from `leader_skills.json`.
- It tries matching by `unitKey`, then by `(name, secondName/title)`.

Important runtime reality:

Character entries carry raw fields like:

```text
refs.leaderBuff
refs.leaderBuffCondition
raw.leaderBuff
raw.leaderBuffCondition
```

The extractor should build a localization map keyed by the same IDs used in those fields. The frontend resolver should only be fallback. The Python output should be authoritative.

---

## 12. Recommended leader-skill fix plan

Patch only leader-skill extraction first. Do not touch UI or sorting.

### Step A: Inspect Localizable_English key shape

Search raw `Localizable_English` for:

```text
leaderBuff
Leader
AttackAndHPUp
HPUp
AttackUp
ATK
Allied
element units
```

Need identify exact key base patterns.

Potential key names may not be obvious like `AttackAndHPUp6DeathNameKey`. Search by values instead:

```text
Allied Fire element units
Allied Water element units
Allied Storm element units
Allied Earth element units
Allied Light element units
Allied Dark element units
Attack increased
max HP increased
```

### Step B: Fix `split_key()` / leader detection if suffix parsing misses keys

Current `split_key()` uses known suffixes like:

```text
NameKey
DescriptionKey
AffectedKey
TitleKey
```

If Localizable uses another suffix for leader skills, add it to `KNOWN_SUFFIXES`.

### Step C: Build leader map from raw Localizable rows by value patterns too

Do not rely only on base-name regex. Add a second pass that scans all grouped rows or raw rows for descriptions matching leader-skill text:

Required phrases:

```text
Allied .* element units
have their Attack increased
have their max HP increased
ATK & HP
Attack increased by
HP increased by
```

Then produce:

```json
skills[base] = {
  "id": base,
  "name": name/title or decoded name,
  "description": description or affected text,
  "affected": affected,
  "rawKeys": [...],
  "source": "Localizable_English"
}
```

### Step D: Generate aliases for raw leaderBuff IDs

Because characters reference IDs like `AttackAndHPUp6Death`, but Localizable may have variants or condition keys, add aliasing:

- exact base
- base without suffix/prefix variants
- condition-joined key if found
- normalized key match

Possible derived map fields:

```json
aliases: {
  "AttackAndHPUp6Death": "<localized-base-id>",
  "AttackUp6Earth": "<localized-base-id>"
}
```

Then `leader-skill-resolver.js` can lookup exact first, aliases second.

### Step E: Integrate into Master Control

Current pipeline already runs `extract_localization` during `--extract`. Need verify it calls:

```text
tools/new_structure/extract_localizable_groups.py
```

Patch that file, and mirror root `extract_localizable_groups.py` only if root duplicate still exists and can be called by someone manually.

### Step F: Re-run workflow after Python patch

After Python patch only, run:

```text
Actions → Evertale Master Control → Run workflow → extract_force
```

Expected output:

```text
apkfiles/entries/localization/leader_skill_localization.json
```

should no longer be empty, and report should show leaderSkillCount > 0.

---

## 13. Frontend leader-skill fallback already patched

`leader-skill-resolver.js` was strengthened as a temporary frontend fallback.

It now:

- Loads `leader_skill_localization.json`.
- Looks for localized exact match.
- If missing, decodes IDs like `AttackAndHPUp6Death` into readable text.
- Reads:
  - `leaderBuff`
  - `leaderBuffCondition`
  - `refs.leaderBuff`
  - `raw.leaderBuff`

But this is not sufficient for final quality. Python extraction must be fixed so the map is authoritative from Localizable_English.

---

## 14. Files touched in the latest UI patch sequence

Recent UI files touched:

```text
catalog-title-stack.css
catalog-force-sort.js
index.html
test-catalog-v2.html
test-catalog-v2-mobile-detail.css
test-catalog-v2-detail-fix.js
test-catalog-v2-desktop-structure.js
leader-skill-resolver.js
data-loader.js
roster.html
optimizer.html
live-data-config.js
catalog-sort.js
catalog-v2-lite.js
```

Do not treat all these as needing further work. Many are stable now.

---

## 15. Known blocked/minor incomplete item

The cache bump for `test-catalog-v2-desktop-structure.js` from `v=1` to `v=2` was attempted but blocked once by the connector because it required resending full HTML.

Current HTML likely still contains:

```html
<script defer src="./test-catalog-v2-desktop-structure.js?v=1"></script>
```

The script file itself has the new logic. If the desktop sticky module does not update after hard refresh, do a minimal cache bump only.

Safe minimal next change:

```text
Replace:
./test-catalog-v2-desktop-structure.js?v=1

With:
./test-catalog-v2-desktop-structure.js?v=2
```

No other HTML changes needed.

---

## 16. User’s current finishing priorities

Likely remaining before live push tonight:

1. Fix Python leader-skill extraction from Localizable_English.
2. Run Master Control Action `extract_force` after patch.
3. Confirm `leader_skill_localization.json` has nonzero `count`.
4. Confirm V2 selected-info module displays Leader skill text from generated map.
5. Confirm Victoria/Lupin visible and ordered by newest.
6. Confirm mobile title is under name.
7. Confirm desktop selected-info sticky module and filters behave acceptably.
8. Only then discuss live push/final polish.

---

## 17. Exact guidance for next assistant/session

Start next session by doing this:

1. Fetch `tools/new_structure/extract_localizable_groups.py`.
2. Fetch root `extract_localizable_groups.py` if it still exists.
3. Search repo for Localizable_English file path.
4. Search raw/localizable values for exact leader wording.
5. Patch extractor to build leader map from raw values and aliases.
6. Update report with `leaderSkillCount` and samples.
7. Commit patch.
8. Tell user to run GitHub Action, or run it if user asks.

Do not start with CSS. Current blocker is Python leader-skill extraction.

---

## 18. Useful commands if working locally

```bash
python MASTER_CONTROL.py --extract --force
```

Then inspect:

```bash
cat apkfiles/entries/localization/leader_skill_localization.json
cat apkfiles/entries/localization/localizable_group_report.json
cat apkfiles/entries/reports/entry_pipeline_report.json
cat apkfiles/entries/reports/validation_report.json
```

Expected:

```text
validation errors: []
leaderSkillCount > 0
leader_skill_localization.json count > 0
```

---

## 19. Summary of logic to transfer

The main lesson from this session:

- Visual fixes alone are not enough if resolver layers strip or override data.
- The four-digit handle is the authoritative entry ordering source.
- Generated bundles and runtime maps must preserve that order before UI sorting.
- Leader skills must be extracted at Python time from `Localizable_English`; frontend decode is only a fallback.
- Desktop V2 should use sticky selected-info module instead of card-expanding detail behavior.
- Mobile V2 should keep popup behavior and title-under-name structure.
- Use cache query bumps after JS/CSS changes, but avoid mutating unrelated HTML.

End of handoff.
