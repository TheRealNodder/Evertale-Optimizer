# Optimizer Legacy

This folder keeps older optimizer engines that are still useful as fallbacks or references.

Current legacy file:

- `optimizerEngineV4.js`
- `optimizer-v4-fallback-loader.js`

`optimizer.html` loads the fallback loader first, then loads V5 directly. V4 is retained as an explicit fallback if V5 cannot load; V5 runtime errors are reported instead of silently substituting V4 results.
