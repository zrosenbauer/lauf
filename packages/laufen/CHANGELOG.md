# laufen

## 1.1.0

### Minor Changes

- 059c490: Make `args` optional on `ScriptConfig` so scripts without arguments can omit it

### Patch Changes

- 622dde7: Fix MODULE_TYPELESS_PACKAGE_JSON warning when loading `.ts` config files by providing a jiti-backed import function to c12, bypassing its native `import()` attempt
- Updated dependencies [059c490]
  - @laufen/engine@1.1.0

## 1.0.0

### Major Changes

- f76ef79: ## Consolidate env API

  Consolidate the environment variable API into a single `env` field and `sandbox` boolean.

  **BREAKING CHANGES**:

  - `envFile` config option removed — use the `dotenv()` helper inside an `env` function instead
  - `envMode` config option removed — replaced by `sandbox: boolean` (default: `true`)
  - `ScriptConfig.env` now accepts a function `(ctx: EnvContext) => Record<string, string>` in addition to a static record
  - `dotenv()` now returns an `EnvFn` instead of `Record<string, string>` — use `env: dotenv()` directly instead of wrapping in a function

  New features:

  - `sandbox` config option (`true` = isolated, `false` = full `process.env`)
  - `env` accepts an async function with `EnvContext` for dynamic env resolution
  - `dotenv()` standalone helper exported from `laufen` for loading `.env` files
  - `EnvFn` type alias exported from both `@laufen/engine` and `laufen`
  - `EnvContext` type exported from both `@laufen/engine` and `laufen`
  - `resolveEnvValue()` helper exported from `@laufen/engine`
  - `infisical()` helper + `InfisicalConfig` type for loading secrets from Infisical CLI

  Merge priority (later overwrites earlier): base (sandbox) < config `env` < script `env` < CLI `--env`

### Patch Changes

- 6c56370: Fix `laufen info <script>` and `laufen run <script> --help` failing in two ways:

  - Add `createRequire` banner to esbuild bundled output so CJS dependencies (e.g. `dotenv`) work inside ESM bundles without crashing on "Dynamic require of 'fs' is not supported".
  - Pre-process argv to detect `run <script> --help` and strip the help flag before Clerc parses, preventing Clerc's global `helpPlugin` from intercepting and showing generic command help instead of script-level help.
  - Render single-package `lauf list` output with the package name as a header instead of a nested `└──` branch.
  - Add trailing newline to help output for better CLI readability.

- Updated dependencies [f76ef79]
- Updated dependencies [6c56370]
- Updated dependencies [3e51f44]
  - @laufen/engine@1.0.0

## 0.2.0

### Minor Changes

- 67b04dc: Extract `@laufen/engine` package from `laufen` CLI to provide a standalone execution
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

### Patch Changes

- 4de4044: fix: skip prompting for args with Zod `.default()` values

  Zod 4's `toJSONSchema()` includes defaulted fields in the `required` array, which caused the CLI to prompt for args that already have defaults. The prompt filter now checks for a `default` key in the JSON Schema property and skips those fields, letting `safeParse()` apply the default during validation.

- e4fabbb: chore: upgrade all dependencies to latest stable versions
- Updated dependencies [67b04dc]
  - @laufen/engine@0.2.0

## 0.1.5

### Patch Changes

- 028d3c6: Render `<root>` as top-level heading in script tree with its scripts and sub-packages nested beneath it

## 0.1.4

### Patch Changes

- 3f05779: Display root workspace package as `<root>` instead of its package.json name in script listings

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
