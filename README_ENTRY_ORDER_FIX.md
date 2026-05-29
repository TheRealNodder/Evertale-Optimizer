# Entry Order Fix

This patch makes the catalog treat the numeric prefix in entry file handles as the source-of-truth added order.

Example:

```text
0734_LudmillaBallet01.json
0735_LudmillaBallet02.json
0736_YandereMaidBallet01.json
0737_YandereMaidBallet02.json
```

Now `0737_*` is considered newer than stale external Explorer order maps.

## What changed

- `data-loader.js`
  - Preserves `order` / `fileHandleOrder` from bundled entry rows.
  - Merged character families now inherit the highest order from their forms.
  - Sorting uses numeric entry handle order before stale Explorer order.

- `catalog.js`
  - Carries `order` / `fileHandleOrder` into normalized catalog cards.
  - Emits `data-order` on each rendered card.

- `catalog-sort.js`
  - Reads `data-order`.
  - Fixes Newest Added / Oldest Added direction:
    - Newest = highest numeric handle first.
    - Oldest = lowest numeric handle first.

## Why

The Explorer/order override files can lag behind raw entries. When new content is appended locally, the file handle prefix is the most reliable source for "date added" ordering.
