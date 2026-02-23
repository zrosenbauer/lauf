# Issues

## Summary of Previous Review (Issues 31-48)

Issues 31-48 were identified in the first review. All have been addressed. The fixes are verified below, followed by new issues discovered during re-review.

### Verified Fixes

- **31. `init` handler writes config to `process.cwd()`** -- FIXED. `init.ts:23` now writes to `path.join(workspaceRoot, MANIFEST_FILE)` and logs an info message when cwd differs from workspace root (line 39-41). Test at `init.test.ts:42-69` covers both cases.
- **32. `create` handler resolves target dir relative to workspace root** -- FIXED. `resolveTargetDir` (create.ts:102-114) now resolves relative to `process.cwd()` when no `--dir` flag is provided. The success message at line 73-75 uses `path.relative(workspaceRoot, filePath)` for the display. Test at `create.test.ts:83-97` verifies cwd-relative resolution.
- **33. Script template injection via unsanitized `name`** -- FIXED. `script.ts:8-10` adds `sanitizeName()` that strips all characters except `[a-zA-Z0-9_-]`. The template function at line 39-61 applies `sanitizeName`, `escapeStringLiteral`, and `escapeTemplateLiteral`. Tests at `script.test.ts:6-37` verify stripping of quotes, backticks, `${`, path traversal, and all-invalid input.
- **34. `findScript` re-discovers all scripts on every call** -- FIXED. `findScript` (discovery.ts:122-129) now accepts an optional `scripts` parameter to avoid re-globbing. Tests at `discovery.test.ts:209-238` verify the pre-discovered path.
- **35. Config loading searches for `laufen` first** -- FIXED. `config.ts:52-77` now searches `lauf` first (primary), falling back to `laufen` only if no config file is found. Tests at `config.test.ts:22-101` verify the search order.
- **26. Unsafe type assertion in config loading** -- FIXED. `config.ts:25-29` adds a `resolvedLaufConfigSchema` Zod schema. The `validateConfig` function (line 43-49) uses `safeParse` instead of type assertions. Both `loadLaufConfig` and `safeLoadLaufConfig` validate through this schema. Tests at `config.test.ts:103-123` verify that invalid configs fall back to defaults.
- **27. Race condition on child process events** -- FIXED. `runner.ts:67-98` uses a `settled` flag to ensure only the first event (close or error) resolves the promise. Tests at `runner.test.ts:288-312` verify both orderings.
- **28. Unsafe array element type assertions in workspace detection** -- FIXED. `workspace.ts:41-43` adds `isStringArray()` guard using `arr.every((x) => typeof x === 'string')`. Applied in `extractPnpmGlobs` (line 61), `extractPackageJsonGlobs` (lines 84, 90), and `extractLernaGlobs` (line 109). Tests at `workspace.test.ts:216-240` verify rejection of non-string arrays.
- **29. Dynamic imports without path validation** -- FIXED. `executor.ts:55-65` validates that the resolved script path starts with `resolvedWorkspaceRoot + path.sep`. `metadata.ts:16-20` adds `isWithinWorkspace()` check. Both use the separator-aware check.
- **30. Unsafe JSON Schema type assertions** -- FIXED. Both `help.ts:108-129` and `prompt-args.ts:35-56` add `extractSchemaFields()` functions that validate the raw JSON Schema output with explicit type checks before using it. No more bare `as JsonSchemaObject` casts.
- **36. `LAUF_ROOT` env var shadows the constant** -- FIXED. `runner.ts:55` now uses `LAUF_WORKSPACE_ROOT` instead of `LAUF_ROOT`. `executor.ts:20` schema expects `LAUF_WORKSPACE_ROOT`. Test at `runner.test.ts:276-286` verifies the new name.
- **37. `handleResult` swallows message for exitCode 0** -- FIXED. `handler.ts:89-93` now logs the message via `p.log.info` when `exitCode === 0` and message is non-empty. Tests at `handler.test.ts:47-59` verify both cases (message present and empty).
- **38. `resolveRawArgv` may capture unrelated argv entries** -- FIXED. `sliceArgvAfter` (run.ts:141-148) now uses `process.argv.slice(2)` to skip the node binary and script path, then searches with `findIndex`. Test at `run.test.ts:454-472` verifies correct behavior.
- **39. `safeLoadLaufConfig` unsafe cast** -- FIXED. `config.ts:82-100` now uses explicit `error !== null` check and `error instanceof Error` guard, wrapping non-Error values with `new Error(String(error))`. A second `validateConfig` call ensures the returned value is valid. Tests at `config.test.ts:138-153` verify both Error and non-Error throw cases.
- **40. Workspace detection computed once at module load** -- FIXED. `workspace.ts:218-233` implements a lazy-evaluated cache via closure with `get()` and `reset()` methods. `resetWorkspaceCache()` is exported for testing. Tests at `workspace.test.ts:242-271` verify caching and cache invalidation.
- **41. `coerce` converts hex and scientific notation** -- FIXED. `run.ts:228-253` uses a strict regex `/^-?\d+(\.\d+)?$/` before calling `Number()`. Tests at `run.test.ts:365-401` verify that `0xff` and `1e10` are preserved as strings.
- **42. `list` handler requires built `dist/`** -- FIXED. `list.ts:20-21` defines both `METADATA_DIST_PATH` and `METADATA_SRC_PATH`. `resolveMetadataPath()` (lines 97-109) checks dist first, falls back to source, returns undefined if neither exists. Lines 126-131 log a clear warning when neither is found. Tests at `list.test.ts:115-165` verify the fallback and warning.
- **43. `parseRawArgs` silently drops positional arguments** -- FIXED. `parseRawArgs` (run.ts:170-226) now collects positional arguments in a separate array and logs a warning via `p.log.warn` at line 219-222. Test at `run.test.ts:326-344` verifies the warning.
- **44. No signal handling for graceful cleanup** -- FIXED. `runner.ts:110-125` adds `registerSignalForwarding()` that forwards SIGINT and SIGTERM to the child. Cleanup function removes handlers after child exits (line 69-71). Tests at `runner.test.ts:328-386` verify handler registration, cleanup, and signal forwarding.
- **45. `extractArgMeta` returns `type: 'unknown'` for nullable** -- FIXED. `help.ts:36-52` adds `extractVariantTypes()` that extracts inner types from `anyOf`/`oneOf` arrays. `resolveType` (lines 54-77) uses this for nullable schemas. Tests at `help.test.ts:76-98` verify that `z.string().nullable()` produces `string | null`.
- **46. Duplicate test file** -- Status unchanged (git artifact, not a code issue).
- **S2. Template injection** -- FIXED (same as #33 above).
- **S3. No path containment on `--dir` flag** -- FIXED. `create.ts:47-53` adds containment check after resolving target dir. Tests at `create.test.ts:224-252` verify rejection of absolute paths outside workspace and relative traversal.
- **S4. LAUF_ARGS logged in cleartext** -- FIXED. `executor.ts:51` now logs `'Invalid JSON in LAUF_ARGS: failed to parse arguments'` without the raw value.
- **S6. Unvalidated workspace globs** -- FIXED. `discovery.ts:18-26` adds `isValidPattern()` that rejects patterns starting with `..` or `/`. `filterToWorkspace()` (lines 35-41) filters discovered scripts to those within the workspace root. Tests at `discovery.test.ts:128-176` verify pattern rejection and path filtering.
- **S7. Prototype pollution in `parseRawArgs`** -- FIXED. `run.ts:150-157` adds `BLOCKED_KEYS` set and `isSafeKey()` check. `parseRawArgs` uses `Object.create(null)` for the initial accumulator (line 216). Tests at `run.test.ts:403-452` verify that `__proto__`, `constructor`, and `prototype` are filtered.
- **S8. TOCTOU race in `lauf create`** -- FIXED. `create.ts:120-122` adds `safeWriteFileExclusive()` using `fs.writeFileSync` with `{ flag: 'wx' }`. The handler (line 64) uses this instead of the separate exists-check + write. Test at `create.test.ts:120-138` verifies `EEXIST` handling.
- **S9. Script name argv matching ambiguous** -- PARTIALLY FIXED. `sliceArgvAfter` now slices from `process.argv[2:]`, addressing matching against node binary/tsx path. Subcommand collision remains (see S18 below).
- **S13. No validation of env paths in executor** -- FIXED. `executor.ts:15` defines `absolutePathString` using `z.string().refine(p => path.isAbsolute(p))`. Applied to `LAUF_SCRIPT_PATH`, `LAUF_WORKSPACE_ROOT`, and `LAUF_PACKAGE_DIR` in the schema.
- **S14. tsx binary resolved without existence check** -- PARTIALLY FIXED. `paths.ts:25-34` adds `resolveTsx()` with existence check. `runner.ts:38-42` uses it. `list.ts:133` still bypasses it (see #53 / S20 below).

---

## Security Review (Pass 3)

This section covers verification of fixes #49-#55, S15, S17, S18, S22, S23, and any new issues discovered during the third review pass. All source files and test files in `packages/lauf/src/` were read in full.

---

### Verified Fixes

#### 49. Path containment in `create.ts` now uses `path.sep` -- VERIFIED FIXED

- **Location:** `packages/lauf/src/handlers/create.ts:49-52`
- **Verification:** The containment check now reads:
  ```ts
  if (
    normalizedTarget !== workspaceRoot &&
    !normalizedTarget.startsWith(`${workspaceRoot}${path.sep}`)
  )
  ```
  This correctly handles the `/workspace` vs `/workspace-evil` prefix bypass. The equality check for `normalizedTarget === workspaceRoot` handles the case where the target is the workspace root itself.
- **Test coverage:** `create.test.ts:224-252` tests both absolute paths outside workspace and relative traversal (`../../etc`). Test at line 254-268 verifies relative `--dir` resolves from workspace root correctly.

#### 50. `filterToWorkspace` in `discovery.ts` now uses `path.sep` -- VERIFIED FIXED

- **Location:** `packages/lauf/src/lib/discovery.ts:42-44`
- **Verification:** The filter now reads:
  ```ts
  return resolved === normalizedRoot || resolved.startsWith(`${normalizedRoot}${path.sep}`);
  ```
  This correctly prevents `/workspace-evil` from matching a workspace root of `/workspace`.
- **Test coverage:** `discovery.test.ts:159-171` verifies that `/outside/workspace/scripts/evil.ts` is filtered out while `/workspace/packages/...` scripts pass.

#### 51. Config validation failures now log `console.warn` -- VERIFIED FIXED

- **Location:** `packages/lauf/src/lib/config.ts:73-77, 90-93`
- **Verification:** Both the primary config path (lines 73-77) and the fallback path (lines 90-93) now call `console.warn` with a descriptive message including the config file path and the validation error message before returning defaults:
  ```ts
  console.warn(
    `[lauf] Config validation failed for ${primary.configFile}: ${error.message}. Using defaults.`,
  );
  ```
- **Test coverage:** `config.test.ts:103-123` tests that invalid primary and fallback configs return defaults. However, the tests do **not** assert that `console.warn` was called. See NEW issue #57.

#### 52. `list.ts` passes `LAUF_WORKSPACE_ROOT` to metadata child process -- VERIFIED FIXED

- **Location:** `packages/lauf/src/handlers/list.ts:152`
- **Verification:** The env object passed to `execFileAsync` now includes:
  ```ts
  LAUF_WORKSPACE_ROOT: workspaceRoot,
  ```
  where `workspaceRoot` is obtained via `getWorkspaceRoot()` at line 139. This enables the `isWithinWorkspace` guard in `metadata.ts`.
- **Test coverage:** The list handler tests mock `execFileAsync` indirectly (the call fails in tests since tsx is not available), so there is no direct assertion that `LAUF_WORKSPACE_ROOT` is set in the child env. This is acceptable given the integration nature of the fix.

#### 53. `list.ts` uses `resolveTsx()` helper -- VERIFIED FIXED

- **Location:** `packages/lauf/src/handlers/list.ts:133-137`
- **Verification:** The `loadDescriptions` function now calls `resolveTsx()` and handles the error case:
  ```ts
  const [tsxError, tsxPath] = resolveTsx();
  if (tsxError) {
    p.log.warn(`Script descriptions unavailable: ${tsxError}`);
    return {};
  }
  ```
  This replaces the previous direct `path.join(LAUF_ROOT, 'node_modules/.bin/tsx')` construction.
- **Test coverage:** `list.test.ts:35-39` mocks `resolveTsx` to return a valid path. No explicit test for the `tsxError` path exists. See NEW issue #58.

#### 54. `safeLoadLaufConfig` double Zod validation removed -- VERIFIED FIXED

- **Location:** `packages/lauf/src/lib/config.ts:105-118`
- **Verification:** `safeLoadLaufConfig` now calls `loadLaufConfig(cwd)` via `attemptAsync` and returns the result directly without a second `validateConfig` call. The function simply wraps the error in a proper Error type if it is a non-Error throwable:
  ```ts
  const [error, config] = await attemptAsync(() => loadLaufConfig(cwd));
  if (error !== null) {
    if (error instanceof Error) {
      return [error, null];
    }
    return [new Error(String(error)), null];
  }
  return [null, config];
  ```
- **Test coverage:** `config.test.ts:126-165` covers success, Error throws, and non-Error throws.

#### 55. `handleResult` now has `return` after `process.exit(0)` -- VERIFIED FIXED

- **Location:** `packages/lauf/src/lib/handler.ts:93-94`
- **Verification:** The exitCode-0 path now reads:
  ```ts
  process.exit(0);
  return;
  ```
  This prevents fall-through to the error logging path in test environments where `process.exit` is mocked.
- **Test coverage:** `handler.test.ts:47-51` asserts `p.log.info` was called and `process.exit(0)`. However, the test still does not assert that `p.log.error` was NOT called. This is now safe because the `return` prevents the fall-through, but adding a negative assertion would strengthen the test. See note under #55 in new issues.

#### S15. Logger field has structural validation -- VERIFIED FIXED

- **Location:** `packages/lauf/src/lib/config.ts:23-33`
- **Verification:** The `loggerSchema` validates the presence of `info`, `warn`, `error`, `success`, `step`, `message`, and `newlines` methods using `z.function()`. This replaces the previous `z.any().optional()`. However, see NEW issue #59 about `step` mismatch.

#### S17. Glob patterns normalized to catch embedded `..` -- VERIFIED FIXED

- **Location:** `packages/lauf/src/lib/discovery.ts:22-26`
- **Verification:** `isValidPattern` now normalizes patterns with `path.normalize()` and rechecks:
  ```ts
  const normalized = path.normalize(pattern);
  if (normalized.startsWith('..') || normalized.startsWith('/')) {
    return false;
  }
  ```
  This catches patterns like `scripts/../../sensitive/*.ts` which normalize to `../sensitive/*.ts`.
- **Test coverage:** No explicit test for the embedded `..` normalization case exists. The tests at `discovery.test.ts:128-176` only test leading `..` and `/`. See NEW issue #60.

#### S18. `sliceArgvAfter` starts from index 3 -- VERIFIED FIXED

- **Location:** `packages/lauf/src/handlers/run.ts:143`
- **Verification:** The function slices from index 3 to skip `[0] node binary, [1] script path, [2] Clerc subcommand ("run")`:
  ```ts
  const scriptArgs = process.argv.slice(3);
  ```
  The findIndex then searches only among script args, not the node binary or subcommand.
- **Test coverage:** `run.test.ts:454-472` verifies that a script name appearing at argv index 0 is not matched.

#### S22. `init.ts` uses `wx` flag -- VERIFIED FIXED

- **Location:** `packages/lauf/src/handlers/init.ts:27`
- **Verification:** `writeFileSync` is called with `{ encoding: 'utf-8', flag: 'wx' }`, preventing overwrites.
- **Test coverage:** `init.test.ts:48-57` asserts the `wx` flag is passed. `init.test.ts:77-87` tests EEXIST handling.

#### S23. `nodePaths` built immutably -- VERIFIED FIXED

- **Location:** `packages/lauf/src/runtime/runner.ts:134-143`
- **Verification:** `buildNodePath` uses a `const paths` array, conditionally appends existing `NODE_PATH` via spread into a new array, and joins. No mutation of the original array occurs.
- **Location also:** `packages/lauf/src/handlers/list.ts:140-144`
- **Verification:** The `nodePaths` array in `list.ts` is also built immutably using a const declaration with conditional spread.
- **Test coverage:** `runner.test.ts:228-274` tests NODE_PATH with and without existing `process.env.NODE_PATH`.

---

### New Issues

#### 57. Config validation `console.warn` not tested (NEW, Low)

- **Location:** `packages/lauf/src/lib/config.test.ts:103-123`
- **Description:** While the fix for #51 correctly added `console.warn` logging when config validation fails (config.ts lines 74-76 and 91-93), the tests at `config.test.ts:103-111` and `config.test.ts:113-123` only assert that the defaults are returned. They do not spy on `console.warn` to verify the warning is actually emitted. This means a regression that silently removes the warning would not be caught.
- **Suggested fix:** Add `vi.spyOn(console, 'warn')` assertions to the "returns defaults when config fails Zod validation" and "validates fallback config with Zod schema" tests.

#### 58. `list.ts` `resolveTsx` error path not tested (NEW, Low)

- **Location:** `packages/lauf/src/handlers/list.test.ts`
- **Description:** The fix for #53 added a `resolveTsx()` call and error handling in `loadDescriptions` (list.ts:133-137). The test mock at `list.test.ts:38` always returns a successful result `[null, '/lauf-root/node_modules/.bin/tsx']`. No test case exercises the error path where `resolveTsx()` returns `[errorMessage, null]`, which should result in a warning `"Script descriptions unavailable: ..."` and a graceful fallback to an empty descriptions record.
- **Suggested fix:** Add a test case that mocks `resolveTsx` to return an error, then assert that `p.log.warn` is called with the tsx-related message and that the list still renders scripts (without descriptions).

#### 59. Logger schema validates `step` but `DefaultLogger` interface does not define `step` (NEW, Medium)

- **Location:** `packages/lauf/src/lib/config.ts:29` vs `packages/lauf/src/types.ts:50-57`
- **Description:** The `loggerSchema` in config.ts validates that the logger has a `step` method (line 29: `step: z.function()`). However, the `DefaultLogger` interface in types.ts does not declare a `step` method. It has: `info`, `warn`, `error`, `success`, `message`, and `newlines`.

  This mismatch means:
  1. The `createLogger()` function in `logger.ts` does not create a `step` method (because `DefaultLogger` does not require it), so the built-in logger itself would fail the schema validation if it were ever validated through it.
  2. Any custom logger the user provides must have a `step` method to pass validation, even though the TypeScript type system does not require it, creating a confusing hidden requirement.
  3. The `p.log.step` function used in `run.ts:123` is a valid `@clack/prompts` function, but it is invoked directly by the run handler (not through the logger interface), so it is unrelated to the logger schema.

  The schema either needs `step` removed (to match the interface), or the `DefaultLogger` interface needs `step` added and `createLogger()` updated accordingly.

- **Suggested fix:** Remove `step: z.function()` from the `loggerSchema` in config.ts, since the `DefaultLogger` interface does not include it and the built-in logger does not implement it. Alternatively, add `step` to the `DefaultLogger` interface and `createLogger()`.

#### 60. `isValidPattern` embedded `..` rejection not tested (NEW, Low)

- **Location:** `packages/lauf/src/lib/discovery.test.ts`
- **Description:** The fix for S17 added normalization of patterns to catch embedded `..` (e.g., `scripts/../../sensitive/*.ts`). While the code at discovery.ts:22-26 correctly normalizes and rejects such patterns, no test exercises this specific path. The existing tests only cover leading `..` and `/` patterns. A pattern like `scripts/../../etc/passwd` would normalize to `../etc/passwd` and be rejected, but this behavior is untested.
- **Suggested fix:** Add a test case:
  ```ts
  it('rejects patterns with embedded parent traversal', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);
    const result = discoverScripts(['scripts/../../etc/passwd']);
    expect(result).toEqual([]);
    expect(fg.sync).not.toHaveBeenCalled();
  });
  ```

#### 61. `resolveTargetDir` allows absolute `--dir` to bypass workspace containment check order (NEW, Low)

- **Location:** `packages/lauf/src/handlers/create.ts:107-108`
- **Description:** When `--dir` is an absolute path, `resolveTargetDir` returns it directly without normalization (line 108: `return dir`). The containment check at lines 49-52 then runs on this unnormalized value. While `path.normalize(dir)` is applied at line 47, the `resolveTargetDir` function itself returns the raw `dir` before normalization happens. This is not a bypass because the caller normalizes afterward, but it creates a subtle coupling: `resolveTargetDir` and the containment check must always be used together, and the normalization must happen between them. If the containment check were ever refactored into `resolveTargetDir`, the normalization step could be missed.

  The test at `create.test.ts:224-236` verifies that `/outside/workspace` is rejected, confirming the current flow works. This is a code clarity issue, not a security issue.

- **Suggested fix:** Apply `path.normalize` inside `resolveTargetDir` before returning, or add a comment documenting the normalization dependency.

#### 62. `parseRawArgs` does not handle short flags (`-v`, `-n`) (NEW, Low)

- **Location:** `packages/lauf/src/handlers/run.ts:184`
- **Description:** `parseRawArgs` only recognizes arguments starting with `--`. Single-dash flags like `-v` or `-n value` are treated as positional arguments and silently warned about via the positional warning (line 220-223). While the CLI documentation may not advertise single-dash support, users commonly expect `-v` to work as a shorthand for `--verbose`. The warning message "Positional arguments were ignored" is misleading for `-v` since the user intended it as a flag.

  This is a usability issue rather than a bug, since Zod validation will still catch the missing argument if it was required.

- **Suggested fix:** Either add single-dash flag support (`-v` as `--verbose` shorthand), or improve the warning message to specifically mention that single-dash flags are not supported and must use `--` prefix.

#### 63. `metadata.ts` `isWithinWorkspace` not directly tested (NEW, Low)

- **Location:** `packages/lauf/src/runtime/metadata.ts:16-20`
- **Description:** The `isWithinWorkspace` function in metadata.ts is a private helper that validates script paths are within the workspace root. It uses the correct `path.sep` pattern. However, because the metadata extractor runs via top-level await and dynamically imports script files, the `isWithinWorkspace` guard (line 51) cannot be exercised in unit tests without complex test infrastructure. The existing metadata tests (`metadata.test.ts`) only test the env/parse edge cases.

  The same `isWithinWorkspace` logic is tested indirectly through the `filterToWorkspace` tests in `discovery.test.ts` (which uses the same pattern), so this is a coverage gap rather than a correctness concern.

- **Status:** Noted for coverage tracking. No immediate fix required.

---

### Summary Table

| Issue                                      | Status                             | Severity |
| ------------------------------------------ | ---------------------------------- | -------- |
| #49 Path containment in create.ts          | VERIFIED FIXED                     | --       |
| #50 filterToWorkspace path.sep             | VERIFIED FIXED                     | --       |
| #51 Config validation console.warn         | VERIFIED FIXED                     | --       |
| #52 LAUF_WORKSPACE_ROOT in list.ts         | VERIFIED FIXED                     | --       |
| #53 resolveTsx in list.ts                  | VERIFIED FIXED                     | --       |
| #54 Double Zod validation removed          | VERIFIED FIXED                     | --       |
| #55 Return after process.exit(0)           | VERIFIED FIXED                     | --       |
| S15 Logger structural validation           | VERIFIED FIXED (see #59)           | --       |
| S17 Glob normalization for embedded ..     | VERIFIED FIXED (untested, see #60) | --       |
| S18 sliceArgvAfter index 3                 | VERIFIED FIXED                     | --       |
| S22 init.ts wx flag                        | VERIFIED FIXED                     | --       |
| S23 nodePaths immutable                    | VERIFIED FIXED                     | --       |
| #57 Config warn not tested                 | NEW                                | Low      |
| #58 resolveTsx error path untested         | NEW                                | Low      |
| #59 Logger schema/interface mismatch       | NEW                                | Medium   |
| #60 Embedded .. pattern untested           | NEW                                | Low      |
| #61 resolveTargetDir unnormalized absolute | NEW                                | Low      |
| #62 Short flags not handled                | NEW                                | Low      |
| #63 metadata.ts isWithinWorkspace untested | NEW                                | Low      |

---

## Unchanged Issues (from previous review, still present)

### Config / CI

#### 22. Lint rules disabled for all source directories

- **Location:** `.oxlintrc.json:94-104`
- **Description:** Overrides disable `functional/no-expression-statements`, `functional/no-let`, `functional/no-throw-statements`, `functional/immutable-data`, `functional/no-loop-statements`, and `functional/functional-parameters` for `handlers/**`, `runtime/**`, `lib/**`, `utils/**`, and `index.ts` -- effectively every source directory. Also disables `security/detect-non-literal-fs-filename` and `security/detect-object-injection` for all source. The functional rules are core to the project's stated coding philosophy, and their blanket disable means the linter enforces them only on `templates/` and `lauf.ts`.

#### 25. Node >= 22.0.0 may be too strict

- **Location:** `package.json`, `packages/lauf/package.json`
- **Description:** Requires Node `>=22.0.0`, excluding Node 20.x LTS users (LTS until April 2026).

#### 47. Missing test coverage for `runtime/executor.ts`

- **Location:** `packages/lauf/src/runtime/executor.ts` (0% coverage)
- **Description:** The executor has no dedicated test file. It contains the full script execution pipeline: env validation, path containment, script import, arg prompting, Zod validation, config loading, context assembly, and script execution. All paths end in `process.exit`. Coverage report confirms 0% statement coverage.

#### 48. `metadata.ts` tests only cover env/parse edge cases

- **Location:** `packages/lauf/src/runtime/metadata.ts` (35.55% coverage)
- **Description:** The core import-and-extract logic (lines 45-74) is untested. Only the env/parse edge cases and the `isWithinWorkspace` helper are covered.

### Security (unchanged, by design or accepted risk)

#### S1. Arbitrary code execution via c12 config loading

- **Location:** `packages/lauf/src/lib/config.ts`
- **Description:** Inherent to the design. c12 executes config files found by walking the filesystem. A malicious `lauf.config.ts` in any ancestor directory executes with user privileges. The `logger` field accepts arbitrary objects (z.any()).
- **Status:** Accepted risk, inherent to config-file-based tools. Should be documented.

#### S5. Process environment fully inherited by child scripts

- **Location:** `packages/lauf/src/runtime/runner.ts:50-51`, `packages/lauf/src/handlers/list.ts:147`
- **Description:** Scripts inherit the full parent environment including secrets. Runner now has a documenting comment (lines 19-23) explaining the intentional design choice.
- **Status:** Accepted as intentional.

#### S10. Metadata extraction timeout

- **Location:** `packages/lauf/src/handlers/list.ts:151`
- **Description:** 15-second timeout with no batching. Warning now logged on failure.
- **Status:** Warning added. Batching remains a non-security enhancement.

#### S11. `safeParseJSON` unchecked type assertion when no schema provided

- **Location:** `packages/lauf/src/utils/json.ts:28-29`
- **Description:** Optional schema parameter was added but none of the call sites use it. The unchecked `parsed as T` cast remains at all invocations.
- **Status:** Partially addressed. Infrastructure in place but not exercised.

#### S12. Error messages expose absolute file paths

- **Location:** `packages/lauf/src/handlers/create.ts:51,61,68,70`, `packages/lauf/src/runtime/executor.ts:81`
- **Description:** Error messages still include absolute paths in the create handler and executor. The init handler was improved.
- **Status:** Partially addressed.
