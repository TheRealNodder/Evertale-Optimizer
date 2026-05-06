# Character Family Runtime Design

## Goal

Keep raw extraction flexible while giving the website one clean character card per family.

The raw APK data may contain one, two, or three physical monster entries for a character. The website should not depend on that count. Instead, it should build a merged family runtime object with the expected awaken states.

---

## Recommended Shape

Each character family should become one runtime card:

```json
{
  "id": "SnowWhite",
  "family": "SnowWhite",
  "name": "Snow White",
  "title": "Queen of Dreams",
  "states": [
    {
      "state": "base",
      "stars": 5,
      "sourceId": "SnowWhite01",
      "image": "https://ik.imagekit.io/r8fsa98s9/characters/SnowWhite01.png",
      "title": "Queen of Dreams",
      "description": "...SnowWhite01DescriptionKey..."
    },
    {
      "state": "evolved",
      "stars": 6,
      "sourceId": "SnowWhite02",
      "image": "https://ik.imagekit.io/r8fsa98s9/characters/SnowWhite02.png",
      "title": "Queen of Dreams",
      "description": "...SnowWhite02DescriptionKey..."
    },
    {
      "state": "final",
      "stars": 6,
      "sourceId": "SnowWhite03",
      "image": "https://ik.imagekit.io/r8fsa98s9/characters/SnowWhite03.png",
      "title": "Queen of Dreams",
      "description": "...SnowWhite03DescriptionKey..."
    }
  ]
}
```

---

## Localization Source

Use `Localizable_English.txt` as the reliable future source.

Required keys:

```text
<InternalId>NameKey
<InternalId>SecondNameKey
<InternalId>DescriptionKey
```

Examples:

```text
SnowWhite01NameKey
SnowWhite01SecondNameKey
SnowWhite01DescriptionKey
SnowWhite02NameKey
SnowWhite02SecondNameKey
SnowWhite02DescriptionKey
SnowWhite03NameKey
SnowWhite03SecondNameKey
SnowWhite03DescriptionKey
```

---

## Expected States By Rarity

### SSR

```text
01 = base / 5 star
02 = evolved / 6 star
03 = final awakened
```

### SR

```text
01 = base / 3 star
02 = evolved / 4 star
```

### N/R

```text
01 only
```

---

## Important Rule

The website should not require all three raw Monster.json entries to exist.

For SSR, it should still build three display states from localization and ImageKit naming:

```text
Family01
Family02
Family03
```

If stats/skills only exist for two forms, the missing form can inherit the nearest available stats/skills while keeping its own image/title/description.

---

## Why This Works Better

This avoids the problem where the APK only has two physical character entries but Localizable_English has three descriptions.

The final website object becomes stable:

```text
one card
three state buttons
three images
three descriptions
per-state stats/skills when available
fallback stats/skills when missing
```

---

## Next Implementation Target

Add a generated family-level runtime file:

```text
apkfiles/entries/characters/families/<Family>.json
```

or bundle equivalent:

```text
apkfiles/entries/bundles/character_families.bundle.json
```

This can be created from:

```text
characters/entries/*.json
Localizable_English.txt
ImageKit naming rules
rarity rules
```

The loader can then read the family runtime object directly instead of rebuilding all of it in browser JavaScript.
