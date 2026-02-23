# laufen

## 0.1.3

### Patch Changes

- 1d4a91c: Display root workspace package as `<root>` instead of its package.json name in script listings

## 0.1.2

### Patch Changes

- ba60760: Include root workspace package scripts in `lauf list` output for monorepos

## 0.1.1

### Patch Changes

- 35e96aa: Render `lauf list` output as a directory tree and filter root workspace package

  - Display scripts in a `├──`/`└──` tree hierarchy grouped by package instead of flat headers
  - Exclude workspace root package scripts in monorepo contexts to avoid duplication
  - Fix `no-shadow` lint error in runner tests (`p` → `filePath`)
  - Add `coverage/` to `.gitignore`
  - Add `scripts/` to oxlint/oxfmt ignore lists
  - Include `scripts/*.ts` in root lauf config
  - Add `sync-pkg-meta` pre-commit hook and script
  - Add defensive `v8 ignore` comments for unreachable branches
  - Fix `resolveTsx` return type assertions in path tests
  - Improve `create` handler test assertions

## 0.1.0

### Minor Changes

- b0858bc: Initial release of lauf — a typed script runner for monorepos. Discover, validate, and execute TypeScript scripts with Zod-powered arguments.
  - **Config-driven** — `lauf.config.ts` at your workspace root defines script glob patterns and optional logger overrides; scaffold one with `lauf init`
  - **Workspace-agnostic** — auto-detects pnpm, npm, yarn, bun, lerna, and single-package projects
  - **Automatic script discovery** — scans every workspace package for scripts matching configured patterns
  - **Zod-powered validation** — define arguments with Zod schemas for runtime validation and full TypeScript inference; CLI flags are automatically coerced to correct types
  - **Isolated execution** — each script runs in its own child process via `tsx`
  - **Rich script context** — every script receives a logger, spinner, and interactive prompts (text, confirm, select, multiselect, password, path) powered by `@clack/prompts`
  - **Built-in scaffolding** — `lauf create` generates a ready-to-run script from a starter template
  - **Script help** — `lauf info` displays a script's typed arguments, descriptions, and defaults without executing it
  - **Tiny API surface** — one function (`lauf()`), one schema library (`z`), one convention (`scripts/` directory)
