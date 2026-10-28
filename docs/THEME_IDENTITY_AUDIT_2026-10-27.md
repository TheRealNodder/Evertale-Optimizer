# Theme identity and accessibility pass

## Findings and changes

The old legendary effects mainly tiled straight stripes, concentric gradients,
or the same drifting particle pattern. Their metadata described distinct powers,
but the rendered shapes often did not communicate those identities. The old
tests checked profile existence, not complete visual compositions or contrast.

`legendary-scenes.js` now supplies original SVG compositions for all 29 legendary
profiles: an individual crest, an environment, and a bounded motion vocabulary.
These are fan-created vector interpretations, not extracted game assets or a
claim to reproduce official in-game effects exactly. No image-generation API,
external artwork dependency, live network request, canvas loop, or random
full-screen stripe generator is required. The shared script is about 15 KB.

| Themes | Visual vocabulary |
| --- | --- |
| Ho-Oh, Lugia, Suicune | Feather crest / sunrise; broad wing crest / sea air; diamond crest / aurora and clean water |
| Groudon / shiny Primal | Armored crest, anchored volcanic terrain, branching molten fractures, rising embers |
| Kyogre / shiny Primal | Fin/body markings, broad ocean swells, falling rain, deep blue or magenta/cyan materials |
| Rayquaza / shiny Mega | Serpentine crest, upper-atmosphere cloud currents, green or black/gold identity |
| Dialga, Palkia, Giratina, Arceus | Stepped temporal clock; spatial seam / pearl forms; broken reverse-floating planes; ordered creation ring |
| Reshiram, Zekrom, Kyurem forms | Feather/turbine; angular electric generator; faceted ice with separate electric or warm energy |
| Xerneas, Yveltal, Zygarde | Branching spectrum antlers / roots; wing-shaped inward drain / eclipse; assembling hex cells |
| Solgaleo, Lunala, Ultra Necrozma | Radiant mane / sun; crescent wings / eclipse; hard-edged crystalline light |
| Zacian, Zamazenta, Eternatus | Sword / directional trail; shield / pressure response; skeletal energy core |
| Koraidon, Miraidon, Terapagos | Organic crest / sunlight and dust; plasma / Electric Terrain; shell facets / stellar refraction |

The matching crest is carried into the header and low-opacity panel materials.
This connects the interface to its background rather than adding unrelated
motion behind unchanged panels. Shared backdrop saturation was reduced for
legendary themes so it no longer overwhelms the illustration.

Console themes retain their seven existing hardware identities. Gloss,
metallic, bronze, split black/white, galaxy, and warm-plastic finishes are now
stationary. The generic page gradient no longer bleeds through the lower Galaxy
shell. Static Super Famicom button-color details remain enabled on mobile.

## Research boundaries

Official references informed the interpretation, not hidden gameplay assumptions:

- [Pokémon: Cause Meteorological Mayhem](https://www.pokemon.com/us/strategy/cause-meteorological-mayhem)
  describes Drizzle, Drought, Primordial Sea, Desolate Land, and Delta Stream.
- [Pokémon's Koraidon/Miraidon announcement](https://press.pokemon.com/en-AU/MEDIA-ALERT-DETAILS-REVEALED-ABOUT-THE-LEGENDARY-POKEMON-KORAIDON-AND-)
  distinguishes harsh sunlight, Electric Terrain, grounded physical motion, and
  Miraidon's hovering/electrically charged movement.
- [Nintendo's hardware colour reference](https://www.nintendo.com/en-gb/Hardware/Nintendo-3DS-Family/Nintendo-3DS/Colour-Range/Colour-Range-724589.html)
  and [Super Famicom New 3DS LL article](https://www.nintendo.com/jp/topics/article/69765b61-fc9c-11e5-8360-063b7ac45a6d)
  inform physical shell treatment and button-color relationships.

Several individual Pokédex detail pages returned iframe-only responses. Their
unavailable text was not treated as verified new evidence. Artistic choices are
explicitly interpretations, not quotations or assertions about exact aura VFX.

## Accessibility and lifecycle

- Declared text/background and selected-control palettes are checked at 4.5:1
  for all 79 profiles. This is a palette check, not a claim that every rendered
  pixel or disabled control has received a full WCAG audit.
- Corrected black-on-black selected text under Yveltal; adapted on-accent text
  for each palette; darkened Easter's lavender surface where no single text
  color could contrast adequately against both its old background and surface.
- Legendary headings use readable interface ink rather than assuming every
  decorative body/detail color is readable as text.
- OS reduced-motion changes are handled live. SVG descendants stop animating
  while the document is hidden; reduced-motion CSS removes their animations.
- Mobile reduces particle counts, preserves static theme identity, and does not
  impose a desktop-width illustration on the page's layout.
- Switching themes replaces one scene in one inert compositor, with no stale
  legendary SVG retained on console/element/calendar themes.
- Rain travels off-screen before looping; embers fade before reset.

## Verification

Commands:

```text
node --check legendary-scenes.js
node --check seasonal-theme.js
node --check theme-auto-route-authority.js
node tools/test-theme-runtime.mjs
node tools/validate-current-runtime.js --strict
node tools/run_optimizer_v6_foundation_tests.js
node tools/validate-recovered-formulas.mjs
git diff --check
```

Theme checks cover all 79 profiles, all 29 scene definitions, scene selection and
cleanup, deterministic bounded geometry, absence of remote/executable SVG
content, reduced-motion changes, and palette contrast. The existing 59 optimizer
fixtures and stat-formula check still pass. The pre-existing Node module-type
notice for `tools/stat-engine.js` remains unrelated to this theme work.

Browser QA used the reusable `tools/theme-gallery.html` and its isolated
`tools/theme-preview.html` samples for all four groups. The gallery deliberately
loads no roster or optimizer data. Production checks cover the desktop catalog,
mobile roster and optimizer (390 CSS pixels), live Kyogre → Groudon → Galaxy
switching, theme persistence across navigation, and reduced-motion emulation.
The mobile roster/optimizer had no horizontal document overflow.

Theme preference/browser emulation changes used for QA are reset before handoff.
The final gallery is left open as a review surface, not a replacement for the
normal site menu.

## Changed files

```text
index.html
optimizer.html
roster.html
seasonal-theme.js
style.css
theme-auto-route-authority.js
theme-effects.css
legendary-scenes.js
tools/test-theme-runtime.mjs
tools/validate-current-runtime.js
tools/theme-gallery.html
tools/theme-preview.html
docs/THEME_IDENTITY_AUDIT_2026-10-27.md
```

Page changes only update theme-asset cache revisions. Raw/generated APK data,
optimizer scoring/search, team constraints, stat formulas, roster profiles,
card state handling, and unrelated TRON code are unchanged.
