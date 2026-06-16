# Legacy catalog test files

These files were moved out of the live root after checking live `index.html` references.

Moved here because they were not loaded by the live Catalog page:

- `test-catalog-v2-awaken-state-stability.js`
- `test-catalog-v2-data-merge.js`
- `test-catalog-v2-duo-merge.js`

Do not delete the remaining `test-catalog-v2-*` support files in the root until `index.html` no longer references them. The live Catalog still depends on those files even though their names still include `test`.
