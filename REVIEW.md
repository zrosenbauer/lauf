# Lauf Code Review

Comprehensive review of the `lauf` CLI tool across 5 dimensions: architecture, security, code quality, testing, and developer experience.

---

## Critical Findings (6)

### C1. Naming split: "laufen" vs "lauf"

**Category: DX**

The npm package is `laufen`, the CLI binary is `lauf`, configs support both `lauf.config.ts` and `laufen.config.ts`, the `lauf()` function is imported from `'laufen'`, and generated scripts use `.lauf.ts` suffixes while the discovery system also strips `.laufen`. This fractured naming creates a confusing mental model for new users. Pick one name and commit.

**Files:** `package.json:2`, `config-discovery.ts:10`, `discovery.ts:135-143`

### C2. Arbitrary code execution via config loading

**Category: Security**

The c12 library dynamically imports `lauf.config.ts` files, executing arbitrary TypeScript at import time. Combined with the upward directory walk (up to `.git` root or 20 dirs), any `lauf` command in a repo with a malicious config triggers RCE. This is inherent to TypeScript configs but should be explicitly documented, and a `--no-config` escape hatch considered.

**Files:** `config.ts:77-96`, `config-discovery.ts:94-109`

### C3. `lauf create` suggests wrong run command

**Category: DX**

After scaffolding a script, the success hint suggests `lauf run scripts/my-script` (a relative path), but `run` expects a qualified name like `@my-org/pkg/my-script`. The suggestion will fail.

**File:** `handlers/create.ts:76`

### C4. `.lauf.ts` convention is undocumented and conflicts with README

**Category: DX**

`lauf create` generates `*.lauf.ts` files. The discovery system strips `.lauf`/`.laufen` suffixes. But the README Quick Start shows plain `.ts` files, and the examples use plain `.ts`. A manually-created `scripts/foo.ts` and a generated `scripts/foo.lauf.ts` would both resolve to the same script name, creating ambiguity.

**Files:** `handlers/create.ts:57`, `discovery.ts:135-143`

### C5. OxLint overrides disable most FP rules for all production code

**Category: Code Quality**

The `.oxlintrc.json` override for `**/handlers/**`, `**/runtime/**`, `**/lib/**`, `**/utils/**` disables `no-let`, `no-loop-statements`, `no-throw-statements`, `immutable-data`, `no-expression-statements`, and `functional-parameters`. This covers nearly every source file. The project's functional programming rules exist only as documentation, not as enforced constraints.

**File:** `.oxlintrc.json:93-105`

### C6. `safeParseJSON` without schema performs unchecked `as T` cast

**Category: Code Quality / Type Safety**

When called without a Zod schema (the common path), `safeParseJSON<T>` blindly casts `unknown` to `T`. Every call site trusts the JSON structurally matches the generic parameter with zero runtime validation. This undermines the "typed" positioning.

**File:** `utils/json.ts:29`

---

## High Findings (8)

### H1. Environment variable inheritance exposes credentials via `lauf list`

**Category: Security**

The `list` command spawns child processes to extract script descriptions. These inherit the full parent environment (`...process.env`). A malicious script could read `process.env` during module initialization and exfiltrate secrets. For metadata extraction, strip the env to only `PATH`, `HOME`, `NODE_PATH`, and `LAUF_*`.

**Files:** `runtime/runner.ts:55`, `handlers/list.ts:204`

### H2. Script name path traversal in `create` handler

**Category: Security**

The `create` handler validates the target directory against the config root, but does NOT validate the final file path (which includes the user-provided name). A name like `../../etc/passwd` would write outside the intended directory. The `wx` flag prevents overwrites but not creation in unexpected locations.

**File:** `handlers/create.ts:56-58`

### H3. `as never` casts in `prompts.ts` bypass all type checking

**Category: Code Quality**

Two `as never` casts completely suppress TypeScript's type system. These work around a `@clack/prompts` typing issue but are the most unsafe pattern in the codebase.

**File:** `runtime/context/prompts.ts:28,42`

### H4. Duplicated `extractSchemaFields`, `resolveType`, and `JsonSchemaProperty`

**Category: Code Quality**

These are copy-pasted between `utils/help.ts` and `utils/prompt-args.ts` with subtle divergences (e.g., `resolveType` falls back to `'unknown'` vs `'string'`). Should be extracted to a shared `utils/schema.ts`.

**Files:** `utils/help.ts:108-129`, `utils/prompt-args.ts:35-56`

### H5. Five different error tuple shapes

**Category: Architecture**

The codebase uses `HandlerResult<T>`, `PromptResult<T>`, `[Error, null] | [null, T]`, `[unknown, null] | [null, T]`, and `[string, null] | [null, string]` for error tuples. This lack of a unified `Result<E, T>` type means callers must know which shape each function returns.

**Files:** `lib/result.ts`, `types.ts:102`, `lib/config.ts:66`, `utils/fs.ts`, `lib/paths.ts:25`

### H6. Zero integration tests, zero E2E tests

**Category: Testing**

Every test file mocks all dependencies. There are no tests exercising config-loading + discovery + execution as a pipeline, and no tests running the actual CLI binary. Despite 100% line coverage, this suite would not catch wiring bugs between modules.

### H7. Auto-prompting of missing required args is undocumented

**Category: DX**

When a required arg is not provided via CLI flags, the executor interactively prompts for it. This is a significant DX feature that is not mentioned anywhere in the README.

**File:** `utils/prompt-args.ts`

### H8. `run()` return type offers no way to signal failure

**Category: DX**

`run: (ctx) => void | Promise<void>` gives script authors no way to indicate failure except `process.exit(1)`. The examples do exactly this, contradicting the functional style.

**File:** `types.ts:234`

---

## Medium Findings (14)

### M1. Config validation failure silently falls back to defaults

Uses `console.warn` (not `p.log.warn`) and returns defaults when a config file exists but is invalid. The user may not notice their config was ignored.

**File:** `lib/config.ts:89-96`

### M2. `list.ts` handler does too much (231 lines)

Contains config loading, discovery, subprocess spawning for metadata, NODE_PATH assembly, JSON parsing, deduplication, and display formatting. The `loadDescriptions` function should be extracted to `runtime/`.

**File:** `handlers/list.ts`

### M3. Arg parser embedded in `run.ts` handler

80+ lines of CLI parsing logic (`parseRawArgs`, `coerce`, `isSafeKey`) belong in `utils/`, not in a handler.

**File:** `handlers/run.ts:167-223`

### M4. Direct `process.cwd()` in every handler

Every handler reads `process.cwd()` as an ambient side-effect, making handlers harder to test and preventing programmatic use from a different directory.

**Files:** All handlers

### M5. Env-var IPC has OS size limits

`LAUF_ARGS` and `LAUF_SCRIPT_PATHS` are JSON-serialized into environment variables, which have OS-level size limits (~128-256KB). Large monorepos with many scripts could hit this.

**Files:** `runtime/runner.ts:59`, `handlers/list.ts:206`

### M6. `process.argv` parsing is brittle

`sliceArgvAfter` hard-codes `process.argv.slice(3)` and searches for the script name by exact match. This breaks with different invocation paths (e.g., `npx`).

**File:** `handlers/run.ts:137-145`

### M7. Two independent upward-walking mechanisms

Config discovery walks to `.git` root (max 20 dirs). Workspace detection walks to filesystem root (max 200 dirs). These could land on different root directories in edge cases.

**Files:** `config-discovery.ts`, `workspace.ts`

### M8. Workspace cache is a hidden global singleton

Module-level mutable closure captures `process.cwd()` at first access. The `resetWorkspaceCache()` export exists solely as a testing workaround.

**File:** `lib/workspace.ts:218-233`

### M9. Executor path has no source fallback

`runner.ts` only looks for `dist/runtime/executor.mjs`. Unlike `list.ts` (which falls back to `src/`), `lauf run` fails if the package isn't built.

**File:** `runtime/runner.ts:11`

### M10. Config load errors expose raw Error objects

Messages like `Failed to load lauf config: ${configError}` render as `Failed to load lauf config: Error: ...` with redundant `Error:` prefix.

**Files:** `handlers/run.ts:30`, `handlers/list.ts:52`, `handlers/info.ts:19`, `handlers/create.ts:41`

### M11. Glob pattern validation incomplete on Windows

`isValidPattern` checks for `/` prefix but not `path.isAbsolute()`, missing Windows absolute paths (`C:\...`). No null byte check. No symlink resolution in `filterToWorkspace`.

**File:** `lib/discovery.ts:18-28`

### M12. Ternary operators in production code

Ternaries in `discovery.ts:171` and `list.ts:198` violate the no-ternary rule. The linter override allows them, but the written rules prohibit them.

### M13. Mutable state in production code

`runner.ts` mutates a `settled` flag, `workspace.ts` mutates cache state, `list.ts` mutates a `Set`. The `list.ts` case could use `es-toolkit`'s `uniqBy`.

**Files:** `runtime/runner.ts:72-96`, `lib/workspace.ts:218-233`, `handlers/list.ts:70-77`

### M14. `process.exit` mocking inconsistency in tests

`executor.test.ts` mocks `process.exit` as a no-op (code continues past exit), while `index.test.ts` uses a sentinel throw (which actually halts). The no-op approach creates unrealistic execution contexts.

---

## Low / Note Findings (16)

### L1. `HandlerResult` is not `readonly` while `PromptResult` is

**File:** `lib/result.ts:13` vs `types.ts:102`

### L2. `handleHelp` import name should be `handleInfo`

The handler file is `info.ts`, the command is `info`, but the import alias is `handleHelp`.

**File:** `index.ts:12`

### L3. Identical `resolveHelpScript` / `resolveRunScript` functions

Same function with different names in `info.ts` and `run.ts`. Should be shared.

**Files:** `handlers/info.ts:45-64`, `handlers/run.ts:71-90`

### L4. `getWorkspaceRoot` re-exported inconsistently

Imported from `workspace.ts` by some files and from `paths.ts` by others.

**File:** `lib/paths.ts:11`

### L5. Config loaded twice per `lauf run` invocation

Parent loads config to resolve scripts, child loads it again for logger/spinner.

**Files:** `handlers/run.ts:28`, `runtime/executor.ts:118`

### L6. `discoverAllConfigs` does not exclude `node_modules`

The `fg.sync` call has `dot: false` but no explicit `node_modules` exclusion.

**File:** `lib/config-discovery.ts:121-129`

### L7. `spinner` config option not documented in README

### L8. Unused exports in `utils/fs.ts`

`safeExistsSync` and `safeWriteFileSync` are never imported by production code.

### L9. No example demonstrates `ctx.prompts` usage

### L10. `NodeJS.ErrnoException` cast without `instanceof` guard

**Files:** `handlers/init.ts:38`, `handlers/create.ts:67`

### L11. Security lint rules disabled for core code

`security/detect-non-literal-fs-filename` and `security/detect-object-injection` are off for all production code.

**File:** `.oxlintrc.json:93-104`

### L12. Delegation-only tests provide low regression value

Logger, spinner, and prompts tests (~300 lines total) only verify calls are forwarded to mocked dependencies.

### L13. No snapshot tests for CLI output formatting

### L14. Fatal bootstrap error is not actionable

`index.ts:22` says "please log an issue on github" without providing the URL or suggesting local remediation.

### L15. Arg validation errors in executor don't name which script failed

**File:** `runtime/executor.ts:114`

### L16. Executor error message exposes absolute path instead of qualified name

**File:** `runtime/executor.ts:82`

---

## Recommendations (Priority Order)

### P0 -- Ship blockers

1. Fix the `lauf create` run suggestion to use qualified script names (C3)
2. Document or decide the `.lauf.ts` convention (C4)
3. Document the config-as-code trust model (C2)

### P1 -- High impact

4. Settle the "lauf" vs "laufen" naming (C1)
5. Strip env for metadata extraction in `lauf list` (H1)
6. Validate final file path in `create` handler (H2)
7. Extract shared schema utilities to `utils/schema.ts` (H4)
8. Add integration and E2E tests (H6)
9. Document auto-prompting of missing args (H7)

### P2 -- Quality improvements

10. Tighten OxLint overrides to per-line disables (C5)
11. Require schema in `safeParseJSON` or add an explicit unsafe overload (C6)
12. Unify error tuple types into a single `Result<E, T>` (H5)
13. Extract arg parser from `run.ts` to `utils/argv.ts` (M3)
14. Extract `loadDescriptions` from `list.ts` to `runtime/` (M2)
15. Make `run()` able to return a failure status (H8)

### P3 -- Polish

16. Replace `console.warn` with `p.log.warn` in config.ts (M1)
17. Fix error messages to use `safeParseError()` consistently (M10)
18. Add `path.isAbsolute()` check in glob validation (M11)
19. Deduplicate `resolveHelpScript`/`resolveRunScript` (L3)
20. Add snapshot tests for CLI output (L13)
