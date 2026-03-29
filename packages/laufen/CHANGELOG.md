# laufen

## 1.3.0

### Minor Changes

- 5a6c6e9: Change default script file extension from `*.lauf.ts` to `*.ts` across blueprints, create, init, and config defaults. Fix blueprint templates not being found at runtime by moving them next to the template module and using tsdown's copy feature.
- ead12d1: fix: scope script discovery to current package and add ctx.dirs.workspace

  **Breaking:** `ctx.dir` renamed to `ctx.dirs` (plural). Update all scripts: `ctx.dir.root` -> `ctx.dirs.root`, `ctx.dir.package` -> `ctx.dirs.package`.

  - `ctx.dirs.workspace` resolves to the workspace package where `lauf` was invoked (not the script's package)
  - Run handler now scopes interactive script discovery to the current package (consistent with list handler)
  - Added `LAUF_WORKSPACE_DIR` env var to pass workspace context through the execution pipeline
  - Deprecated `ctx.root` and `ctx.packageDir` in favor of `ctx.dirs.root` and `ctx.dirs.package`

### Patch Changes

- Updated dependencies [ead12d1]
  - @laufen/engine@1.3.0

## 1.2.1

### Patch Changes

- 9b1540f: Update all dependencies to latest versions and remove unused `chalk` package
- Updated dependencies [9b1540f]
  - @laufen/engine@1.2.1

## 1.2.0

### Minor Changes

- b381c06: Add `lauf blueprint` command for scaffolding pre-built script templates

  - `lauf blueprint` lists available blueprints
  - `lauf blueprint <name>` scaffolds a blueprint into the project's scripts directory
  - Available blueprints: `clean` (remove build artifacts and caches) and `copy` (copy files matching glob patterns)
  - `clean` supports `--build`, `--cache`, `--npm`, `--nuke`, and `--dryRun` flags for granular control
  - `copy` uses a configurable `COPY_PATTERNS` constant and supports `--to` and `--dryRun` flags

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

### Patch Changes

- Updated dependencies [278f67c]
- Updated dependencies [b8990a3]
- Updated dependencies [8566488]
  - @laufen/engine@1.2.0

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
