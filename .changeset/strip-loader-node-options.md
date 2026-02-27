---
'@laufen/engine': patch
---

Strip loader-related flags (`--import`, `--loader`, `--experimental-loader`, `--require`) from `NODE_OPTIONS` before spawning child processes, preventing external loaders from breaking top-level await in pre-bundled ESM scripts.
