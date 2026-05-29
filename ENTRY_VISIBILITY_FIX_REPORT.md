# Entry Visibility Fix Report

## Cause

The raw entry files were present, but the runtime bundle files were stale.

Confirmed raw entries:

- Characters: 737
- Weapons: 827
- Accessories: 106
- Bosses: 413
- Character families: 421

The missing newest entries were present under:

```text
apkfiles/entries/characters/entries/
apkfiles/entries/bosses/entries/
apkfiles/entries/weapons/entries/
apkfiles/entries/accessories/entries/
```

but the live site reads the fast bundle files under:

```text
apkfiles/entries/bundles/
```

Those bundles had not been regenerated, so the site could not see the newest content.

## Fixed

Regenerated:

```text
apkfiles/entries/bundles/characters.bundle.json
apkfiles/entries/bundles/character_families.bundle.json
apkfiles/entries/bundles/weapons.bundle.json
apkfiles/entries/bundles/accessories.bundle.json
apkfiles/entries/bundles/bosses.bundle.json
apkfiles/entries/bundles/catalog.bundle.json
apkfiles/entries/reports/bundle_report.json
```

## Verified New Tail Entries

Characters now include:

```text
0734_LudmillaBallet01.json
0735_LudmillaBallet02.json
0736_YandereMaidBallet01.json
0737_YandereMaidBallet02.json
```

Character families now include:

```text
LudmillaBallet
YandereMaidBallet
```

Bosses now include:

```text
0406_LudmillaBalletBoss01.json
0407_LudmillaBalletBoss03.json
0408_YandereMaidBalletBoss01.json
0409_YandereMaidBalletBoss03.json
0410_VictoriaRegularBoss01.json
0411_VictoriaRegularBoss03.json
0412_LupinRegularBoss01.json
0413_LupinRegularBoss03.json
```

Weapons now include:

```text
0825_RibbonHammer01.json
0826_RibbonHammer02.json
0827_RibbonHammer03.json
```

Accessories now include:

```text
0106_VictoriaCrown01.json
```

## After Deploy

Clear browser cache or hard refresh GitHub Pages:

```text
Ctrl + Shift + R
```

If using service worker/cache, unregister the service worker once from browser devtools.
