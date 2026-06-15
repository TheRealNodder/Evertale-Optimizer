# V2 Desktop Sidebar Revert Notes

This file records the layout state before applying the concept-inspired sidebar sheen/gradient pass.

## Safe revert target

The current desktop sidebar layout authority before the sheen pass is:

- `test-catalog-v2-desktop-sidebar-authority.js`
- SHA before sheen pass: `2a696b7219b0acfd02109c43e4b52611079b55c8`

The current HTML loader before the sheen pass is:

- `test-catalog-v2.html`
- SHA before sheen pass: `493c01afc365b52a6e67c43408f9a470380a3a82`

## Current loaded desktop authority chain before sheen pass

`test-catalog-v2.html` loads:

```html
<script defer src="./test-catalog-v2-desktop-sidebar-authority.js?v=1"></script>
```

The old separated patch files were already deleted in Pass 3 and are not part of the active layout:

- `test-catalog-v2-desktop-portrait-window.js`
- `test-catalog-v2-desktop-sidebar-fill.js`
- `test-catalog-v2-desktop-stationary-scroll.js`
- `test-catalog-v2-desktop-sidebar-clean.js`
- `test-catalog-v2-smart-badges.js`

## Revert method

To return to the pre-sheen desktop sidebar layout:

1. Restore `test-catalog-v2-desktop-sidebar-authority.js` to SHA `2a696b7219b0acfd02109c43e4b52611079b55c8`.
2. Restore `test-catalog-v2.html` to SHA `493c01afc365b52a6e67c43408f9a470380a3a82` only if the script version was bumped for the sheen pass.

## Protected behavior

The revert should preserve:

- Pass 1 badge authority: `test-catalog-v2-source-badge-authority.js`
- mobile detail badge tabs: `test-catalog-v2-mobile-detail-badge-tabs.js`
- desktop consolidated authority file loading
- deleted unused patch files remaining deleted

## Notes

The sheen pass should only affect desktop sidebar presentation:

- outer sidebar glow and top-left shine
- element-reactive gradient using `--element-primary` and `--element-secondary`
- selected card background polish
- desktop detail tab fit within sidebar bounds

It should not change:

- mobile layout
- data generation
- sorting
- catalog card rendering
- badge source rules
- description population
- leader-skill population
- boss logic
