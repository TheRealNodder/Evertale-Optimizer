# Theme animation signatures

The page paints three layers in order: original background art, decorative animation, then main content. The animation spans the page rather than being confined to foreground gutters. Navigation, dialogs and menus remain above it. The isolated body owns the two negative decorative stacking levels; no new stacking context is imposed on application content.

Reading panels use an 84% theme-colored backing. Controls and menus retain solid backings where needed. The primary ink at 90% opacity is checked against all eight RGB-corner underlays, including pure white, at a minimum 4.5:1 ratio. Secondary normal text uses the same theme ink. Mobile panel blur is disabled. Actual rendered styles and stacking are also checked; the numerical palette check is not a claim that every image pixel has been sampled.

## Dedicated motifs

Nine technology themes use an original full-page motherboard: `miraidon`, `cyber`, and the seven console finishes. One static SVG contains varied trace widths, 45-degree bends, vias, pads, chip outlines with pin rows, transistor outlines and other passive components. Strokes without travelling packets stay energized. The SVG and HTML packets share host-pixel coordinates, with distance-proportional keyframes. No official schematics or logos are copied.

Zygarde uses filled organic cells, not a technical hex grid. Twenty-four cells (ten on phones) have deterministic positions and varied sizes from 18 to 110 pixels. Each grows while fading in and shrinks while fading out. The old outlined cells and circuit links are retired.

Both engines receive separate child hosts inside one shared animation stage. Theme switching clears the module, its resize observer and pending debounce timer. The controller owns the 700px density bucket; the motherboard owns bounded, debounced geometry redraws within that bucket. The separate 480px breakpoint selects artwork files.

## Motion contract

- At most 40 desktop / 16 phone independently animated decorative objects, including existing environment layers and artwork. The static board paths do not count as moving objects, but their DOM/render cost is measured separately.
- The motherboard contributes at most 12 / 5 packets; organic cells contribute 24 / 10 cells. Other signatures share sixteen primitive families with authored geometry, periods and phases.
- Only transform and opacity animate. No continuous JavaScript render loop is added. One bounded resize debounce belongs to each active board and is cleared when it is removed.
- Hidden tabs and optimizer searches pause the shared controller. Animations off and reduced motion stop movement; the board remains energized, packets hide, and cells hold a subdued static composition.
- Original illustrations, credited character images, theme identities, optimizer scoring and source game data are preserved.

Lore and form qualifications remain in [Theme visual references and motion](THEME_MOTION.md). Geometry and timing are original visual interpretations, not canonical attack animations. Performance on a physical phone must be measured separately from viewport emulation.

## Per-theme catalog

Counts below are conservative complete-scene desktop / phone bounds, including five / four existing scene surfaces. An arc object has three desktop animated segments and one phone segment; the conservative primitive budget reserves three on both.

| Theme | Engine and accents | Conservative desktop / phone total | References |
| --- | --- | --- | --- |
| cinderfall | Preserved Elemental renderer | 36 / 14 | [Identity](THEME_MOTION.md#cinderfall) |
| undertow | Preserved Elemental renderer | 34 / 14 | [Identity](THEME_MOTION.md#undertow) |
| frostbite | Preserved Elemental renderer | 36 / 14 | [Identity](THEME_MOTION.md#frostbite) |
| thunderwake | Preserved storm renderer + localized branch | 33 / 15 | [Identity](THEME_MOTION.md#thunderwake) |
| worldroot | Preserved Elemental renderer | 34 / 14 | [Identity](THEME_MOTION.md#worldroot) |
| dawnspire | Preserved Elemental renderer | 30 / 14 | [Identity](THEME_MOTION.md#dawnspire) |
| voidcrown | Preserved Elemental renderer | 34 / 14 | [Identity](THEME_MOTION.md#voidcrown) |
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
| cyber | Full-page motherboard (12/5 packet cap); arc: electric (2/1; 8s) | 23 / 12 | [Identity](THEME_MOTION.md#cyber) |
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
| crimsonblack | Full-page motherboard (12/5 packet cap); prism: shell (2/1; 20s) | 19 / 10 | [Identity](THEME_MOTION.md#crimsonblack) |
| cobaltblack | Full-page motherboard (12/5 packet cap); gust: reflection (2/1; 20s) | 19 / 10 | [Identity](THEME_MOTION.md#cobaltblack) |
| metallicrose | Full-page motherboard (12/5 packet cap); prism: rose (2/1; 22s) | 19 / 10 | [Identity](THEME_MOTION.md#metallicrose) |
| bronzexl | Full-page motherboard (12/5 packet cap); prism: bronze (2/1; 25s) | 19 / 10 | [Identity](THEME_MOTION.md#bronzexl) |
| blackwhitedsi | Full-page motherboard (12/5 packet cap); prism: split (2/1; 18s) | 19 / 10 | [Identity](THEME_MOTION.md#blackwhitedsi) |
| galaxystyle | Full-page motherboard (12/5 packet cap); glint: star (7/3; 12s) | 24 / 12 | [Identity](THEME_MOTION.md#galaxystyle) |
| superfamicom | Full-page motherboard (12/5 packet cap); glint: button (4/2; 22s) | 21 / 11 | [Identity](THEME_MOTION.md#superfamicom) |
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
| zekrom | trace: generator (3/1; 8s); arc: generator (3/1; 8s) | 17 / 8 | [Identity](THEME_MOTION.md#zekrom) |
| blackkyurem | arc: ice (3/1; 8s); fall: ice (10/4; 14s) | 24 / 11 | [Identity](THEME_MOTION.md#blackkyurem) |
| whitekyurem | heat: iceheat (4/2; 16s); rise: steam (7/3; 14s) | 16 / 9 | [Identity](THEME_MOTION.md#whitekyurem) |
| xerneas | burst: antler (5/2; 20s); glint: life (7/3; 13s) | 17 / 9 | [Identity](THEME_MOTION.md#xerneas) |
| yveltal | invert: drain (10/4; 16s); heat: shadow (2/1; 22s) | 17 / 9 | [Identity](THEME_MOTION.md#yveltal) |
| zygarde | Organic filled cells (24/10) | 29 / 14 | [Identity](THEME_MOTION.md#zygarde) |
| solgaleo | heat: corona (3/1; 18s); burst: sun (4/2; 22s) | 12 / 7 | [Identity](THEME_MOTION.md#solgaleo) |
| lunala | orbit: crescent (1/1; 27s); swell: moon-shadow (2/1; 22s) | 8 / 6 | [Identity](THEME_MOTION.md#lunala) |
| ultranecrozma | prism: ray (5/2; 16s); burst: prism (4/1; 22s) | 14 / 7 | [Identity](THEME_MOTION.md#ultranecrozma) |
| zacian | gust: blade (5/2; 10s); prism: blade (2/1; 19s) | 12 / 7 | [Identity](THEME_MOTION.md#zacian) |
| zamazenta | ripple: shield (4/2; 15s); gust: deflect (2/1; 21s) | 11 / 7 | [Identity](THEME_MOTION.md#zamazenta) |
| eternatus | heat: core (2/1; 18s); arc: energy (3/1; 8s) | 16 / 8 | [Identity](THEME_MOTION.md#eternatus) |
| koraidon | gust: dust (6/3; 12s); swell: grass (3/1; 16s) | 14 / 8 | [Identity](THEME_MOTION.md#koraidon) |
| miraidon | Full-page motherboard (12/5 packet cap); arc: junction (2/1; 8s) | 23 / 12 | [Identity](THEME_MOTION.md#miraidon) |
| terapagos | prism: stellar (5/2; 20s); orbit: facet (4/2; 24s) | 14 / 8 | [Identity](THEME_MOTION.md#terapagos) |
| sunrise | heat: sunbeam (3/1; 22s); burst: sun (3/1; 26s) | 11 / 6 | [Identity](THEME_MOTION.md#sunrise) |

Technical references: [animation performance](https://web.dev/articles/animations-and-performance), [compositor layers](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count), [flash thresholds](https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html).
