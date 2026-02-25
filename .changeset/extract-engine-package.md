---
'laufen': minor
'@laufen/engine': minor
---

Extract `@laufen/engine` package from `laufen` CLI to provide a standalone execution
engine for script bundling, metadata extraction, and runtime context.

Key changes:

- New `@laufen/engine` package with esbuild-based TypeScript bundler, Node child
  process runner, and script context (logger, spinner, prompts)
- Replace tsx-based script execution with esbuild `bundle: true` + `format: 'esm'`
  for fully self-contained output that resolves dependencies without NODE_PATH hacks
- Metadata extractor subprocess for loading script descriptions in parallel
- Comprehensive test suite covering bundler, runner, executor, metadata, and all
  utility modules
- `laufen` CLI now depends on `@laufen/engine` for all execution concerns
