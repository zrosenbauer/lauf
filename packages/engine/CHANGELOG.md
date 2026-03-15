# @laufen/engine

## 1.2.0

### Minor Changes

- 278f67c: Add namespaced context API and filesystem helpers

  - Add `ctx.dir.*` namespace for paths (root, package, workspace)
  - Add `ctx.fs.*` filesystem helpers (readFile, writeFile, copyFile, mkdir, rm, exists, stat)
  - Deprecate `ctx.root` and `ctx.packageDir` (use `ctx.dir.root` and `ctx.dir.package` instead)
  - Add documentation and examples for creating reusable utility libraries

- b8990a3: Add package management for script dependencies

  Scripts can now declare npm packages that are automatically installed to a cache directory (`~/.lauf/packages/<hash>/`) without polluting project dependencies. Packages are available via type-safe `ctx.import()` method.

  **Key features:**

  - Workspace-level packages in `lauf.config.ts` available to all scripts
  - Script-level packages in script config (overrides workspace packages)
  - Auto-detection of package manager (pnpm, npm, yarn, bun)
  - Cache reuse based on package set hash
  - Type-safe imports with automatic `.lauf/packages.d.ts` generation
  - Cross-process locking to prevent concurrent installations
  - Externals integration with esbuild
  - Runtime validation of packages field

  **Usage:**

  ```typescript
  // lauf.config.ts
  export default defineConfig({
    packages: {
      rimraf: "^6.0.0",
      execa: "^9.0.0",
    },
  });

  // script.ts
  export default lauf({
    description: "Example package-managed script",
    packages: {
      chalk: "^5.0.0",
    },
    async run(ctx) {
      const { default: chalk } = await ctx.import("chalk");
      const { rimraf } = await ctx.import("rimraf");
      ctx.logger.info(chalk.blue("Styled text!"));
    },
  });
  ```

- 8566488: Add `--watch` mode to `lauf run`

  - Add `--watch` / `-w` flag to `lauf run` to rerun scripts automatically on file changes
  - Add `ctx.watch` to `ScriptContext` with `enabled`, `changedFiles`, and `patterns`
  - Add `watch` field to `ScriptConfig` for per-script watch configuration
  - Add `watch` field to `LaufConfig` for global watch configuration
  - New `WatchConfig` and `WatchContext` types exported from `@laufen/engine` and `laufen`

## 1.1.0

### Minor Changes

- 059c490: Make `args` optional on `ScriptConfig` so scripts without arguments can omit it

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
