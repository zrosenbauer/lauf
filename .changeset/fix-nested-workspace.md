---
'@laufen/engine': minor
'laufen': minor
---

fix: scope script discovery to current package and add ctx.dirs.workspace

**Breaking:** `ctx.dir` renamed to `ctx.dirs` (plural). Update all scripts: `ctx.dir.root` -> `ctx.dirs.root`, `ctx.dir.package` -> `ctx.dirs.package`.

- `ctx.dirs.workspace` resolves to the workspace package where `lauf` was invoked (not the script's package)
- Run handler now scopes interactive script discovery to the current package (consistent with list handler)
- Added `LAUF_WORKSPACE_DIR` env var to pass workspace context through the execution pipeline
- Deprecated `ctx.root` and `ctx.packageDir` in favor of `ctx.dirs.root` and `ctx.dirs.package`
