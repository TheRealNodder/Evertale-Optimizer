# Recognizable Pokémon themes — 2026-10-28

## What changed

The 29 character themes now use recognizable, locally served character artwork,
not an abstract crest as their main identity. A responsive encounter banner and
header icon identify the selected character. Existing weather/environment SVGs
remain background atmosphere; their abstract foreground crests are hidden.

Each theme has its own three-color luminous frame palette. Cards use an
opacity-breathing gradient overlay; scrollable grid panels and sidebars use a
pulsing box outline, so their frames do not scroll across the content. Frames
are pointer-inert and decorative. Sidebars keep their existing positioning.
The intentionally flattened optimizer control container is not framed twice.

Examples:

| Character | Frame signature |
| --- | --- |
| Groudon | Red, magma gold, crimson |
| Kyogre | Ocean blue, red markings, cyan |
| Rayquaza | Emerald, gold, red |
| Shiny Primal Groudon | Gold, orange, silver against black |
| Shiny Primal Kyogre | Gold, pink energy, pale silver against black |
| Shiny Mega Rayquaza | Gold, red, mint against black |
| Dialga / Palkia | Blue/cyan/silver / pearl/pink/violet |
| Zacian / Zamazenta | Cyan/gold/pink / crimson/gold/cyan |

The complete palettes are in `pokemon-theme-presence.js`. The earlier magenta
body/cyan-energy interpretation of Shiny Primal Kyogre was corrected against
its actual black-and-gold form artwork.

Only visible frames animate, using IntersectionObserver. Motion pauses when
the document is hidden. Live OS reduced-motion changes disable character,
card-frame, and panel-outline animation without removing theme identity.
Newly rendered cards are decorated automatically; replaced card contents get
their single frame restored. Theme switches reuse one banner.

## Artwork provenance and rights

Source collection: [PokeAPI/sprites](https://github.com/PokeAPI/sprites),
`official-artwork`. Form discovery uses the public
[PokéAPI](https://pokeapi.co/docs/v2). This is an unofficial fan presentation,
not an official Pokémon site, endorsement, or claim to ownership.

Pokémon and character artwork belong to their respective rights holders.
Attribution does not transfer artwork rights or establish a commercial license.
The banner includes a visible source-credit link.

`assets/themes/pokemon/artwork-sources.json` records all 29 source URLs, exact
forms, shiny flags, dimensions, byte sizes, and SHA-256 receipts. All files are
475 × 475 PNGs; the collection totals 4,453,096 bytes. Ordinary pages request
only the selected theme's local image, not the entire collection. The browser
does not call PokéAPI or GitHub to retrieve theme artwork at runtime.

`tools/sync-pokemon-theme-art.mjs` is an explicit development-only importer.
It fails if exact requested form/shiny artwork is unavailable. It reuses a local
asset only when its source/form/shiny receipt and checksum match. Primal, Mega,
Ultra, crowned sword/shield, and Stellar forms are selected explicitly.

## Changed files

- `index.html`, `roster.html`, `optimizer.html`: shared theme cache revisions.
- `seasonal-theme.js`: Shiny Primal Kyogre palette and descriptive correction.
- `theme-auto-route-authority.js`: ordered presentation-module loading.
- `theme-effects.css`: banner, art, frame/outline pulses, responsive/motion rules.
- `pokemon-theme-presence.js`: local art identity, banner/frame lifecycle.
- `assets/themes/pokemon/artwork-sources.json` and its 29 named PNG assets.
- `tools/sync-pokemon-theme-art.mjs`: exact-form asset importer.
- `tools/test-theme-runtime.mjs`: asset receipts, palettes, lifecycle regressions.
- `tools/validate-current-runtime.js`: current shared asset revisions.
- `tools/theme-preview.html`: dynamic individual preview; optional still mode.
- `tools/theme-gallery.html`: 29-character static contact sheet.
- This report.

No optimizer search/scoring, raw APK/generated data, formulas, roster profiles,
or unrelated console/elemental theme implementation was changed.

## Validation commands and results

```text
node tools/sync-pokemon-theme-art.mjs
node --check pokemon-theme-presence.js
node --check theme-auto-route-authority.js
node --check seasonal-theme.js
node --check tools/sync-pokemon-theme-art.mjs
node tools/validate-current-runtime.js --strict
node tools/test-theme-runtime.mjs
node tools/run_optimizer_v6_foundation_tests.js
node tools/validate-recovered-formulas.mjs
git diff --check
```

Results: exact-form import 29/29; strict runtime validation passed; theme suite
passed across 79 profiles, including 29 local-art identities and receipts;
V6 fixtures passed 40 foundation + 13 Story + 6 platoon = 59/59; formula
validation passed. Formula validation retains the existing Node
`MODULE_TYPELESS_PACKAGE_JSON` warning. `npm run validate:js` could not launch
because this shell exposes Node 24.22.1 but no `npm` command; its four underlying
Node validation scripts were therefore run directly and passed.

Local server: `python -m http.server 4173 --bind 127.0.0.1`.
Git checks: `git status --short --branch`, `git remote -v`, `git log -3 --oneline`,
`git fetch origin main`, and `git rev-list --left-right --count HEAD...origin/main`.
Source inspection used `rg`, `Get-Content`, and focused `git diff` checks.

## Browser checks

- Actual optimizer and catalog at 1440 × 1000; Groudon at 390 × 844.
- Long Shiny Primal Groudon title and artwork at 390 × 844; no page overflow.
- Actual roster with corrected Shiny Primal Kyogre artwork and gold frames.
- Contact-sheet visual inspection of all 29 character themes.
- All 36 initially rendered catalog cards decorated; offscreen frames paused.
- All 20 platoon rows / 100 slots decorated; only visible frames active.
- Card selection and FA-state buttons remain clickable through the overlays.
- Live theme changes reuse one banner and update exact-form image URLs.
- Reduced-motion emulation disables motion and retains readable identity.
- No warning/error console messages in the checked catalog state.

Review checklist: select Groudon, Kyogre, and a shiny Primal theme; observe the
4.8-second frame pulse; scroll catalog/platoon panes; select a card and state;
check phone-width artwork/title fit; toggle the OS reduced-motion preference;
switch to a non-Pokémon theme and verify the encounter banner disappears.

These are themed fan treatments, not reproductions of official game battle VFX.
Screenshots validate composition but cannot demonstrate the animation itself.
