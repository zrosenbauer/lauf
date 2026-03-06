---
'@laufen/engine': minor
'laufen': minor
---

Add namespaced context API and filesystem helpers

- Add `ctx.dir.*` namespace for paths (root, package, workspace)
- Add `ctx.fs.*` filesystem helpers (readFile, writeFile, copyFile, mkdir, rm, exists, stat)
- Deprecate `ctx.root` and `ctx.packageDir` (use `ctx.dir.root` and `ctx.dir.package` instead)
- Add documentation and examples for creating reusable utility libraries
