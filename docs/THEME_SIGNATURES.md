# Theme animation signatures

The page paints three layers in order: original background art, decorative animation, then main content. The animation spans the page rather than being confined to foreground gutters. Navigation, dialogs and menus remain above it. The isolated body owns the two negative decorative stacking levels; no new stacking context is imposed on application content.

Reading panels use an 84% theme-colored backing. Controls and menus retain solid backings where needed. The primary ink at 90% opacity is checked against all eight RGB-corner underlays, including pure white, at a minimum 4.5:1 ratio. Secondary normal text uses the same theme ink. Mobile panel blur is disabled. Actual rendered styles and stacking are also checked; the numerical palette check is not a claim that every image pixel has been sampled.

## Dedicated motifs

Nine technology themes use an original full-page motherboard: `miraidon`, `cyber`, and the seven console finishes. One static SVG contains varied trace widths, 45-degree bends, vias, pads, chip outlines with pin rows, transistor outlines and other passive components. Strokes without travelling packets stay energized. The SVG and HTML packets share host-pixel coordinates, with distance-proportional keyframes. No official schematics or logos are copied.

Miraidon alone uses a shared charge cycle with constant-distance packet travel and two desktop/one phone local releases at actual packet waypoints. Short trace highlights follow the same PCB geometry; field rings expand when their packet arrives. Cyber and the seven console profiles retain their independently phased original packets.

Zygarde uses filled organic cells, not a technical hex grid. Twenty-four cells (ten on phones) have deterministic positions and varied sizes from 18 to 110 pixels. Each grows while fading in and shrinks while fading out. The old outlined cells and circuit links are retired. Subtle local gathering now accompanies the original growth cycle.

Both engines receive separate child hosts inside one shared animation stage. Theme switching clears the module, its resize observer and pending debounce timer. The controller owns the 700px density bucket; the motherboard owns bounded, debounced geometry redraws within that bucket. The separate 480px breakpoint selects artwork files.

## Project Legendary

Twenty-seven Pokémon use original SVG vignettes with two or three co-located, independently animated layers, duplicated at two desktop anchors and shown once on phones. The original wind and earthquake engines remain active; mobile quake rendering pairs the four geometry bands into two paint groups, retaining all cracks and three quake positions. Zygarde and Miraidon retain their dedicated engines. No new network assets or application-state ownership. Animation direction and sequence are artistic interpretations, not reproduced canonical battle effects.

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
| hooh | rainbow, sacred-feathers, sacred-fire; 22s cycle | 11 / 7 | [Identity](THEME_MOTION.md#hooh) |
| lugia | pressure, aeroblast; 20s cycle + retained signature engine/accents | 29 / 14 | [Identity](THEME_MOTION.md#lugia) |
| suicune | purification, north-wind, cleared-water; 18s cycle | 11 / 7 | [Identity](THEME_MOTION.md#suicune) |
| groudon | drought, continental-rise; 20s cycle + retained signature engine/accents | 34 / 15 | [Identity](THEME_MOTION.md#groudon) |
| kyogre | ocean-swell, pressure; 20s cycle + retained signature engine/accents | 23 / 12 | [Identity](THEME_MOTION.md#kyogre) |
| rayquaza | clear-sky, air-lock; 20s cycle + retained signature engine/accents | 29 / 14 | [Identity](THEME_MOTION.md#rayquaza) |
| shinyprimalgroudon | desolate-sun, magma-veins; 18s cycle + retained signature engine/accents | 34 / 15 | [Identity](THEME_MOTION.md#shinyprimalgroudon) |
| shinyprimalkyogre | primordial-sea, golden-pressure, primal-markings; 18s cycle + retained signature engine/accents | 29 / 14 | [Identity](THEME_MOTION.md#shinyprimalkyogre) |
| shinymegarayquaza | delta-vortex, gold-tendrils; 17s cycle + retained signature engine/accents | 29 / 14 | [Identity](THEME_MOTION.md#shinymegarayquaza) |
| dialga | time-dial, rewinding-hand, time-echo; 24s cycle | 11 / 7 | [Identity](THEME_MOTION.md#dialga) |
| palkia | space-grid, spatial-rift, spatial-plane; 23s cycle | 11 / 7 | [Identity](THEME_MOTION.md#palkia) |
| giratina | inverted-terrain, distortion-seam, reversed-orbit; 25s cycle | 11 / 7 | [Identity](THEME_MOTION.md#giratina) |
| arceus | creation-ring, gathering-light, formed-world; 26s cycle | 11 / 7 | [Identity](THEME_MOTION.md#arceus) |
| reshiram | turboblaze, blue-flare, warm-plume; 19s cycle | 11 / 7 | [Identity](THEME_MOTION.md#reshiram) |
| zekrom | teravolt-generator, bolt-strike; 16s cycle + retained signature engine/accents | 12 / 7 | [Identity](THEME_MOTION.md#zekrom) |
| blackkyurem | frozen-plates, freeze-shock, ice-pressure; 19s cycle | 11 / 7 | [Identity](THEME_MOTION.md#blackkyurem) |
| whitekyurem | ice-shell, ice-burn, steam; 20s cycle | 11 / 7 | [Identity](THEME_MOTION.md#whitekyurem) |
| xerneas | life-branches, seven-color-crown, life-dispersal; 24s cycle | 11 / 7 | [Identity](THEME_MOTION.md#xerneas) |
| yveltal | oblivion, y-shaped-drain, cocoon; 24s cycle | 11 / 7 | [Identity](THEME_MOTION.md#yveltal) |
| zygarde | Organic filled cells (24/10) | 29 / 14 | [Identity](THEME_MOTION.md#zygarde) |
| solgaleo | solar-core, solar-prominences, sunsteel-ray; 24s cycle | 11 / 7 | [Identity](THEME_MOTION.md#solgaleo) |
| lunala | lunar-disc, moon-shadow, moonlight-rays; 26s cycle | 11 / 7 | [Identity](THEME_MOTION.md#lunala) |
| ultranecrozma | light-absorption, ultra-prism, photon-geyser; 20s cycle | 11 / 7 | [Identity](THEME_MOTION.md#ultranecrozma) |
| zacian | crowned-sword, behemoth-blade; 17s cycle + retained signature engine/accents | 29 / 14 | [Identity](THEME_MOTION.md#zacian) |
| zamazenta | crowned-shield, incoming-force, deflection; 19s cycle | 11 / 7 | [Identity](THEME_MOTION.md#zamazenta) |
| eternatus | dynamax-absorption, skeletal-core, dynamax-cannon; 24s cycle | 11 / 7 | [Identity](THEME_MOTION.md#eternatus) |
| koraidon | orichalcum-sun, collision-course, primal-dust; 18s cycle | 11 / 7 | [Identity](THEME_MOTION.md#koraidon) |
| miraidon | Full-page motherboard (12/5 packets); Hadron waypoint rings and trace releases (2+2/1+1) | 21 / 11 | [Identity](THEME_MOTION.md#miraidon) |
| terapagos | stellar-shell, terastal-refraction, stellar-spectrum; 26s cycle | 11 / 7 | [Identity](THEME_MOTION.md#terapagos) |
| sunrise | heat: sunbeam (3/1; 22s); burst: sun (3/1; 26s) | 11 / 6 | [Identity](THEME_MOTION.md#sunrise) |

Technical references: [animation performance](https://web.dev/articles/animations-and-performance), [compositor layers](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count), [flash thresholds](https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html).
