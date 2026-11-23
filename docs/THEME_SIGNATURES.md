# Theme animation signatures

The 72 illustrated scene themes use one reusable peripheral overlay and sixteen shared primitives. Each profile selects authored shapes, trajectories, phases and densities. The seven Elemental themes retain their separate renderer and original artwork; particle densities are reduced, two phone atmosphere spins stop, and Thunderwake receives one localized branch accent. This pass changes animation, not optimizer behavior or artwork.

Pokémon identities and form qualifications remain documented with primary references in [Theme visual references and motion](THEME_MOTION.md). The effects below are original visual interpretations, not canonical attack animations. Circuitry represents futuristic electrical motion; it does not assert that a Pokémon contains computer hardware. Shiny palettes do not imply shiny-exclusive powers. No form transformations are introduced.

The eight version themes (`gold` through `platinum`) express Johto, Hoenn and Sinnoh environments. The six mineral themes express crystal and surface optics. Console finishes retain original orthogonal routes rather than copied circuitry or logos.

## Behavior and limits

- Circuits use static tracks and luminous packets that follow each authored corner. Keyframe travel offsets are proportional to segment lengths; propulsion profiles can accelerate within a segment.
- Hex cells have two independently animated edge groups: they separate, then close. Positions and phases repeat deterministically after remounting.
- Electrical branches use a localized, staggered charge/discharge envelope with a twelve-second cycle and no full-screen flash. Generator charging completes before discharge.
- The new scene signatures reserve five existing animated art/layer surfaces on desktop and four on phones. Every independently animated cell edge, packet and branch is counted. The targets are at most 40 desktop and 16 phone animations in the complete 72-scene composition; the global ceiling is 60.
- Standalone overlay periods are 6–30 seconds, plus 2.4-second continuous rain travel. The existing compiled SVG layer schema remains 6–24 seconds. These are separate schemas. Rain travel is not a luminance flash.
- Hidden tabs and optimizer searches pause the existing controller. Animations off and system reduced motion stop movement, retain static cells/tracks, and hide travelling packets and drifting foreground particles. Existing artwork and composed static scene layers remain visible.
- Shapes are decorative, non-focusable and click-through. Geometry, clipping, gradients and shadows are static. Animated properties are transform and opacity; no rendering loop or per-frame DOM allocation is added.
- Browser frame timing, paint/compositing, readability and physical-phone performance require measurement; the property choices alone are not a performance certification.

Technical references: [Animation performance](https://web.dev/articles/animations-and-performance), [compositor layers](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count), [flash thresholds](https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html).

## Per-theme overlay catalog

Counts are desktop / phone objects. A hex object contains two animated edges; an arc contains three animated branches. Other objects animate once. Static child geometry is additional DOM, not an additional moving object. Existing scene surfaces are included in the conservative total.

| Theme | Primary and accent (objects; period) | Conservative total desktop / phone | References |
| --- | --- | --- | --- |
| cinderfall | Dedicated Elemental renderer; 10 phone particles | 36 / 14 | [Identity](THEME_MOTION.md#cinderfall) |
| undertow | Dedicated Elemental renderer; 10 phone particles | 34 / 14 | [Identity](THEME_MOTION.md#undertow) |
| frostbite | Dedicated Elemental renderer; 10 phone particles | 36 / 14 | [Identity](THEME_MOTION.md#frostbite) |
| thunderwake | Dedicated storm renderer; 24/10 rain particles and one localized electrical branch (3/1 animated segments) | 33 / 15 | [Identity](THEME_MOTION.md#thunderwake) |
| worldroot | Dedicated Elemental renderer; 10 phone particles | 34 / 14 | [Identity](THEME_MOTION.md#worldroot) |
| dawnspire | Dedicated Elemental renderer; 10 phone particles | 30 / 14 | [Identity](THEME_MOTION.md#dawnspire) |
| voidcrown | Dedicated Elemental renderer; 10 phone particles | 34 / 14 | [Identity](THEME_MOTION.md#voidcrown) |
| spring | fall: petal (16/6; 13s); burst: flower (3/1; 22s) | 24 / 11 | [Identity](THEME_MOTION.md#spring) |
| summer | heat: sunbeam (3/1; 19s); glint: droplet (8/3; 10s) | 16 / 8 | [Identity](THEME_MOTION.md#summer) |
| autumn | fall: leaf (18/7; 13s); gust: leaf (3/1; 21s) | 26 / 12 | [Identity](THEME_MOTION.md#autumn) |
| winter | fall: snow (20/8; 16s); prism: frost (2/1; 25s) | 27 / 13 | [Identity](THEME_MOTION.md#winter) |
| newyear | burst: firework (4/1; 18s); fall: confetti (12/5; 11s) | 21 / 10 | [Identity](THEME_MOTION.md#newyear) |
| valentine | rise: heart (10/4; 14s); orbit: ribbon (3/1; 20s) | 18 / 9 | [Identity](THEME_MOTION.md#valentine) |
| stpatrick | fall: clover (14/6; 14s); prism: gold (2/1; 20s) | 21 / 11 | [Identity](THEME_MOTION.md#stpatrick) |
| easter | fall: blossom (14/6; 14s); burst: flower (3/1; 22s) | 22 / 11 | [Identity](THEME_MOTION.md#easter) |
| independence | burst: firework (5/2; 20s); glint: star (6/2; 10s) | 16 / 8 | [Identity](THEME_MOTION.md#independence) |
| halloween | swell: fog (3/1; 24s); heat: lantern (4/2; 19s) | 12 / 7 | [Identity](THEME_MOTION.md#halloween) |
| thanksgiving | fall: leaf (14/6; 15s); gust: wheat (3/1; 24s) | 22 / 11 | [Identity](THEME_MOTION.md#thanksgiving) |
| christmas | fall: snow (18/7; 16s); glint: light (6/2; 12s) | 29 / 13 | [Identity](THEME_MOTION.md#christmas) |
| midnight | glint: star (12/5; 8s); ripple: water (3/1; 18s) | 20 / 10 | [Identity](THEME_MOTION.md#midnight) |
| aurora | swell: aurora (4/2; 23s); glint: star (6/2; 14s) | 15 / 8 | [Identity](THEME_MOTION.md#aurora) |
| sakura | fall: blossom (20/8; 14s); gust: ribbon (3/1; 22s) | 28 / 13 | [Identity](THEME_MOTION.md#sakura) |
| ocean | swell: wave (4/2; 20s); ripple: foam (3/1; 14s) | 12 / 7 | [Identity](THEME_MOTION.md#ocean) |
| ember | rise: ember (14/6; 11s); heat: coal (2/1; 18s) | 21 / 11 | [Identity](THEME_MOTION.md#ember) |
| royal | prism: gold (4/2; 22s); ripple: water (3/1; 16s) | 12 / 7 | [Identity](THEME_MOTION.md#royal) |
| cyber | trace: network (5/2; 10s); arc: electric (2/1; 12s) | 16 / 9 | [Identity](THEME_MOTION.md#cyber) |
| forest | fall: leaf (10/4; 17s); glint: seed (8/3; 12s) | 23 / 11 | [Identity](THEME_MOTION.md#forest) |
| cosmic | orbit: star (6/2; 26s); swell: nebula (3/1; 24s) | 14 / 7 | [Identity](THEME_MOTION.md#cosmic) |
| quartz | prism: crystal (5/2; 21s); glint: facet (4/2; 18s) | 14 / 8 | [Identity](THEME_MOTION.md#quartz) |
| gold | swell: sunlight (2/1; 18s); gust: leaf (4/2; 13s) | 11 / 7 | [Identity](THEME_MOTION.md#gold) |
| silver | swell: fog (2/1; 18s); ripple: water (2/1; 12s) | 9 / 6 | [Identity](THEME_MOTION.md#silver) |
| ruby | gust: dust (5/2; 12s); swell: terrain (2/1; 18s) | 12 / 7 | [Identity](THEME_MOTION.md#ruby) |
| sapphire | swell: wave (3/1; 18s); ripple: foam (2/1; 12s) | 10 / 6 | [Identity](THEME_MOTION.md#sapphire) |
| emerald | swell: corridor (3/1; 18s); gust: leaf (4/2; 12s) | 12 / 7 | [Identity](THEME_MOTION.md#emerald) |
| amethyst | prism: cluster (5/2; 22s); glint: facet (5/2; 16s) | 15 / 8 | [Identity](THEME_MOTION.md#amethyst) |
| diamond | fall: snow (6/3; 14s); prism: frost (2/1; 18s) | 13 / 8 | [Identity](THEME_MOTION.md#diamond) |
| pearl | ripple: water (3/1; 16s); swell: reflection (2/1; 20s) | 10 / 6 | [Identity](THEME_MOTION.md#pearl) |
| platinum | swell: fog (2/1; 22s); fall: snow (4/2; 15s) | 11 / 7 | [Identity](THEME_MOTION.md#platinum) |
| opal | prism: opal (5/2; 20s); glint: soft (4/2; 15s) | 14 / 8 | [Identity](THEME_MOTION.md#opal) |
| topaz | prism: facet (4/2; 19s); heat: amber (2/1; 20s) | 11 / 7 | [Identity](THEME_MOTION.md#topaz) |
| jade | prism: jade (3/1; 25s); ripple: water (3/1; 20s) | 11 / 6 | [Identity](THEME_MOTION.md#jade) |
| obsidian | prism: fracture (4/2; 24s); heat: coal (2/1; 24s) | 11 / 7 | [Identity](THEME_MOTION.md#obsidian) |
| crimsonblack | trace: shell (4/2; 12s); prism: shell (2/1; 20s) | 11 / 7 | [Identity](THEME_MOTION.md#crimsonblack) |
| cobaltblack | trace: corner (4/2; 13s); gust: reflection (2/1; 20s) | 11 / 7 | [Identity](THEME_MOTION.md#cobaltblack) |
| metallicrose | trace: opposed (3/2; 15s); prism: rose (2/1; 22s) | 10 / 7 | [Identity](THEME_MOTION.md#metallicrose) |
| bronzexl | trace: corner (3/2; 17s); prism: bronze (2/1; 25s) | 10 / 7 | [Identity](THEME_MOTION.md#bronzexl) |
| blackwhitedsi | trace: opposed (4/2; 12s); prism: split (2/1; 18s) | 11 / 7 | [Identity](THEME_MOTION.md#blackwhitedsi) |
| galaxystyle | trace: network (3/2; 15s); glint: star (7/3; 12s) | 15 / 9 | [Identity](THEME_MOTION.md#galaxystyle) |
| superfamicom | trace: retro (4/2; 14s); glint: button (4/2; 22s) | 13 / 8 | [Identity](THEME_MOTION.md#superfamicom) |
| hooh | burst: feather (5/2; 18s); rise: feather (8/3; 13s) | 18 / 9 | [Identity](THEME_MOTION.md#hooh) |
| lugia | swell: pressure (3/1; 22s); gust: wing (5/2; 9s) | 13 / 7 | [Identity](THEME_MOTION.md#lugia) |
| suicune | swell: cleansing (3/1; 12s); swell: aurora (2/1; 19s) | 10 / 6 | [Identity](THEME_MOTION.md#suicune) |
| groudon | heat: fault (4/2; 15s); burst: fissure (3/1; 20s) | 12 / 7 | [Identity](THEME_MOTION.md#groudon) |
| kyogre | swell: wave (4/2; 22s); fall: rain (14/6; 11s) | 23 / 12 | [Identity](THEME_MOTION.md#kyogre) |
| rayquaza | gust: serpent (7/3; 8s); orbit: air (3/1; 18s) | 15 / 8 | [Identity](THEME_MOTION.md#rayquaza) |
| shinyprimalgroudon | heat: magma (5/2; 12s); burst: fissure (4/1; 18s) | 14 / 7 | [Identity](THEME_MOTION.md#shinyprimalgroudon) |
| shinyprimalkyogre | swell: pressure (4/2; 22s); prism: primal (3/1; 18s) | 12 / 7 | [Identity](THEME_MOTION.md#shinyprimalkyogre) |
| shinymegarayquaza | gust: tendril (7/3; 12s); burst: ray (4/1; 20s) | 16 / 8 | [Identity](THEME_MOTION.md#shinymegarayquaza) |
| dialga | swell: terrace (3/1; 20s); clock: ticks (1/1; 24s) | 9 / 6 | [Identity](THEME_MOTION.md#dialga) |
| palkia | rift: space (2/1; 18s); orbit: pearl (4/2; 14s) | 11 / 7 | [Identity](THEME_MOTION.md#palkia) |
| giratina | invert: shard (10/4; 14s); rift: fold (2/1; 21s) | 17 / 9 | [Identity](THEME_MOTION.md#giratina) |
| arceus | heat: stair (3/1; 24s); invert: order (5/2; 24s) | 13 / 7 | [Identity](THEME_MOTION.md#arceus) |
| reshiram | heat: turbine (3/1; 16s); rise: flame (10/4; 11s) | 18 / 9 | [Identity](THEME_MOTION.md#reshiram) |
| zekrom | trace: generator (3/1; 12s); arc: generator (3/1; 12s) | 17 / 8 | [Identity](THEME_MOTION.md#zekrom) |
| blackkyurem | arc: ice (3/1; 12s); fall: ice (10/4; 14s) | 24 / 11 | [Identity](THEME_MOTION.md#blackkyurem) |
| whitekyurem | heat: iceheat (4/2; 16s); rise: steam (7/3; 14s) | 16 / 9 | [Identity](THEME_MOTION.md#whitekyurem) |
| xerneas | burst: antler (5/2; 20s); glint: life (7/3; 13s) | 17 / 9 | [Identity](THEME_MOTION.md#xerneas) |
| yveltal | invert: drain (10/4; 16s); heat: shadow (2/1; 22s) | 17 / 9 | [Identity](THEME_MOTION.md#yveltal) |
| zygarde | hex: cell (8/4; 12s); trace: cell-link (2/1; 18s) | 23 / 13 | [Identity](THEME_MOTION.md#zygarde) |
| solgaleo | heat: corona (3/1; 18s); burst: sun (4/2; 22s) | 12 / 7 | [Identity](THEME_MOTION.md#solgaleo) |
| lunala | orbit: crescent (1/1; 27s); swell: moon-shadow (2/1; 22s) | 8 / 6 | [Identity](THEME_MOTION.md#lunala) |
| ultranecrozma | prism: ray (5/2; 16s); burst: prism (4/1; 22s) | 14 / 7 | [Identity](THEME_MOTION.md#ultranecrozma) |
| zacian | gust: blade (5/2; 10s); prism: blade (2/1; 19s) | 12 / 7 | [Identity](THEME_MOTION.md#zacian) |
| zamazenta | ripple: shield (4/2; 15s); gust: deflect (2/1; 21s) | 11 / 7 | [Identity](THEME_MOTION.md#zamazenta) |
| eternatus | heat: core (2/1; 18s); arc: energy (3/1; 12s) | 16 / 8 | [Identity](THEME_MOTION.md#eternatus) |
| koraidon | gust: dust (6/3; 12s); swell: grass (3/1; 16s) | 14 / 8 | [Identity](THEME_MOTION.md#koraidon) |
| miraidon | trace: propulsion (4/2; 12s); arc: junction (2/1; 12s) | 15 / 9 | [Identity](THEME_MOTION.md#miraidon) |
| terapagos | prism: stellar (5/2; 20s); orbit: facet (4/2; 24s) | 14 / 8 | [Identity](THEME_MOTION.md#terapagos) |
| sunrise | heat: sunbeam (3/1; 22s); burst: sun (3/1; 26s) | 11 / 6 | [Identity](THEME_MOTION.md#sunrise) |

## Specific identity checks

Zygarde uses split cellular outlines rather than leaves. Miraidon uses coordinated orthogonal electrical travel; Cyber uses independent network phases. Zekrom uses irregular generator conductors followed by a branching discharge. Black Kyurem conducts electricity through visible ice fractures, while White Kyurem retains a cold shell around warm internal light and rising vapor. Koraidon uses dust and grass motion.

Dialga combines stepped environmental light bands with one restrained tick-bearing ring. Palkia opens a spatial seam; Giratina uses opposing fragment directions. Xerneas grows branching light outward; Yveltal draws fragments inward. Arceus uses ordered stair illumination, Lunala a crescent and passing moon shadow, and Terapagos sequential crystal-face refraction.

The official [Zygarde entry](https://sg.portal-pokemon.com/pokedex/0718/) describes its assembled pieces and ecosystem role. The official [Koraidon/Miraidon announcement](https://press.pokemon.com/en-AU/MEDIA-ALERT-DETAILS-REVEALED-ABOUT-THE-LEGENDARY-POKEMON-KORAIDON-AND-) establishes the sunlight/electric-terrain distinction. [Reshiram](https://sg.portal-pokemon.com/pokedex/0643/) and [Zekrom](https://sg.portal-pokemon.com/pokedex/0644/) distinguish fire/truth from lightning/ideals. Timing and geometry are design choices.
