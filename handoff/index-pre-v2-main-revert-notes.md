# Index Pre-V2 Main Revert Notes

This file records the live `index.html` state before promoting `test-catalog-v2` to the main catalog site.

## Safe revert target

- File: `index.html`
- SHA before V2 promotion: `f4a8d6dce729a8e8b9236b6c1f87304d771d6a51`

## Previous live catalog chain

The pre-V2 main catalog loaded:

```html
<script src="./seasonal-theme.js"></script>
<script src="./site-menu.js?v=3"></script>
<script src="./image-cache-reset.js?v=1"></script>
<script src="./live-data-config.js?v=4"></script>
<script src="./data-loader.js?v=4"></script>
<script src="./leader-skill-resolver.js?v=1"></script>
<script src="./duo-source-collapse.js?v=4"></script>
<script src="./catalog.js?v=1770583867"></script>
<script src="./catalog-sort.js?v=8"></script>
<script src="./duo-sort-bypass.js?v=3"></script>
<script src="./catalog-state-restore.js?v=2"></script>
<script src="./catalog-ui-align.js?v=1"></script>
<script src="./catalog-force-sort.js?v=2"></script>
```

## Promotion goal

Promote the finalized `test-catalog-v2` UI and behavior into `index.html` while keeping:

- `roster.html` unchanged for now
- `optimizer.html` unchanged for now
- Python pipeline untouched
- generated data untouched
- stat-test untouched

## Revert method

To revert the main catalog back to the old live catalog, restore `index.html` to SHA:

`f4a8d6dce729a8e8b9236b6c1f87304d771d6a51`
