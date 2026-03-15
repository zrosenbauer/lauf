---
'@laufen/engine': minor
'laufen': minor
---

Add `--watch` mode to `lauf run`

- Add `--watch` / `-w` flag to `lauf run` to rerun scripts automatically on file changes
- Add `ctx.watch` to `ScriptContext` with `enabled`, `changedFiles`, and `patterns`
- Add `watch` field to `ScriptConfig` for per-script watch configuration
- Add `watch` field to `LaufConfig` for global watch configuration
- New `WatchConfig` and `WatchContext` types exported from `@laufen/engine` and `laufen`
