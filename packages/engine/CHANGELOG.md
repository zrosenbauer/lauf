# @laufen/engine

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

- 3e51f44: Strip loader-related flags (`--import`, `--loader`, `--experimental-loader`, `--require`) from `NODE_OPTIONS` before spawning child processes, preventing external loaders from breaking top-level await in pre-bundled ESM scripts.

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
