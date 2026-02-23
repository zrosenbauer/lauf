# PLAN: Config Discovery Overhaul

## Overview

Replace c12's implicit config resolution with a custom upward directory walker that finds the **closest** `lauf.config.ts` (or `laufen.config.ts`) relative to `process.cwd()`, bounded by git repo root or a 20-directory cap. Add an `--all` flag for aggregating configs from subdirectories.

---

## 1. Architecture Summary

### Current Flow

```
Handler (e.g. run.ts)
  -> safeLoadLaufConfig(getWorkspaceRoot())
    -> c12.loadConfig({ name: 'lauf', cwd: workspaceRoot })
```

Every handler loads config from the **workspace root** (detected via pnpm-workspace.yaml/package.json/lerna.json). c12 handles file resolution internally. This means subdirectory configs are never found.

### New Flow

```
Handler (e.g. run.ts)
  -> safeLoadLaufConfig(process.cwd())
    -> findConfigFile(process.cwd())  // custom upward walker
      -> detectSearchBoundary(process.cwd())  // git root or 20-dir cap
      -> walkUpward(cwd, boundary, CONFIG_NAMES)
    -> c12.loadConfig({ configFile: foundPath })  // load specific file, no auto-resolution
```

The key change: config discovery is separated from config loading. A new `findConfigFile` function walks upward from cwd. c12 is then used only to load/evaluate the specific file found (or can be replaced with a direct `import()`).

---

## 2. New Module: `packages/lauf/src/lib/config-discovery.ts`

This is the core new file. It contains the upward config search logic.

### Types

```typescript
interface ConfigSearchBoundary {
  readonly root: string; // Absolute path to stop searching at
  readonly source: 'git' | 'cap'; // Why we stopped
}

interface DiscoveredConfig {
  readonly configFile: string; // Absolute path to the config file
  readonly configDir: string; // Directory containing the config file
  readonly configName: 'lauf' | 'laufen'; // Which config variant was found
}
```

### Constants

```typescript
const CONFIG_FILE_NAMES: readonly string[] = ['lauf.config.ts', 'laufen.config.ts'];

const MAX_SEARCH_DEPTH = 20;
```

### Function: `detectSearchBoundary(startDir: string): ConfigSearchBoundary`

Walks upward from `startDir` looking for a `.git` directory/file.

- If `.git` is found, returns `{ root: thatDir, source: 'git' }`.
- If filesystem root is reached or 20 directories are traversed without finding `.git`, returns `{ root: <dir 20 levels up or fs root>, source: 'cap' }`.

Implementation: recursive `walk(dir, prevDir, depth)` checking `fs.existsSync(path.join(dir, '.git'))`. Terminates when `dir === prevDir` (filesystem root) or `depth >= MAX_SEARCH_DEPTH`.

### Function: `findConfigFile(startDir: string): DiscoveredConfig | undefined`

Walks upward from `startDir` to the boundary, checking each directory for config files.

- At each directory, checks `CONFIG_FILE_NAMES` in order (lauf first, then laufen).
- Returns the **first** match found (closest to cwd wins).
- Returns `undefined` if no config is found within the boundary.

Implementation: precompute search directories with `collectSearchDirs`, then check each in order.

```typescript
function collectSearchDirs(startDir: string, boundaryRoot: string): readonly string[] {
  const collect = (dir: string, prevDir: string, acc: readonly string[]): readonly string[] => {
    if (dir === prevDir) return acc;
    const next = [...acc, dir];
    if (path.resolve(dir) === path.resolve(boundaryRoot)) return next;
    return collect(path.dirname(dir), dir, next);
  };
  return collect(path.resolve(startDir), '', []);
}
```

### Function: `discoverAllConfigs(startDir: string): readonly DiscoveredConfig[]`

For the `--all` flag. Uses `fast-glob` to find all config files within the boundary root. Deduplicates (prefers `lauf.config.ts` over `laufen.config.ts` in same directory). Sorts by path depth (shallowest first).

---

## 3. Changes to `packages/lauf/src/lib/config.ts`

- **Finding** handled by `findConfigFile` from `config-discovery.ts`.
- **Loading** continues using c12 with explicit `configFile` option.

### Updated `loadLaufConfig`

```typescript
export async function loadLaufConfig(cwd: string): Promise<ResolvedLaufConfig> {
  const discovered = findConfigFile(cwd);
  if (!discovered) return DEFAULTS;

  const loaded = await loadConfig<LaufConfig>({
    name: discovered.configName,
    cwd: discovered.configDir,
    configFile: discovered.configFile,
    defaults: DEFAULTS,
  });

  const [error, config] = validateConfig(loaded.config);
  if (error) return DEFAULTS;
  return config;
}
```

### New exports

```typescript
export interface LoadedConfig {
  readonly config: ResolvedLaufConfig;
  readonly configFile: string | undefined; // undefined = defaults used
  readonly configDir: string;
}

export async function loadLaufConfigWithMeta(cwd: string): Promise<LoadedConfig>;
export async function loadAllLaufConfigs(startDir: string): Promise<readonly LoadedConfig[]>;
```

---

## 4. Changes to `packages/lauf/src/lib/workspace.ts`

**Minimal changes.** Workspace detection remains for resolving packages and NODE_PATH. Handlers stop passing `getWorkspaceRoot()` to config loading and use `process.cwd()` instead.

---

## 5. Changes to `packages/lauf/src/lib/paths.ts`

**No changes needed.** The `getWorkspaceRoot` re-export remains for workspace package resolution.

---

## 6. Changes to `packages/lauf/src/handlers/init.ts`

- Use `findConfigFile(process.cwd())` to check for existing config.
- If found, fail with "already initialized".
- If not found, write `lauf.config.ts` to `process.cwd()`.

---

## 7. Changes to `packages/lauf/src/handlers/list.ts`

- Change `safeLoadLaufConfig(getWorkspaceRoot())` to `safeLoadLaufConfig(process.cwd())`
- Add `--all` flag support:
  1. Call `loadAllLaufConfigs(process.cwd())`
  2. For each config, run `discoverScripts` scoped to that config's directory
  3. Merge and display all scripts

---

## 8. Changes to `packages/lauf/src/handlers/run.ts`

Change: `safeLoadLaufConfig(getWorkspaceRoot())` -> `safeLoadLaufConfig(process.cwd())`

`--all` does not apply to `run`.

---

## 9. Changes to `packages/lauf/src/handlers/create.ts`

- Change: `safeLoadLaufConfig(getWorkspaceRoot())` -> `safeLoadLaufConfig(process.cwd())`
- Update `resolveTargetDir` to use config directory as base instead of workspace root.

---

## 10. Changes to `packages/lauf/src/handlers/info.ts`

Change: `safeLoadLaufConfig(getWorkspaceRoot())` -> `safeLoadLaufConfig(process.cwd())`

---

## 11. Changes to `packages/lauf/src/index.ts`

Add `--all` flag to the `list` command:

```typescript
.command('list', 'List all available scripts', {
  flags: {
    all: {
      type: Boolean,
      description: 'Discover scripts from all nested configs',
      alias: 'a',
    },
  },
})
```

---

## 12. Changes to `packages/lauf/src/runtime/executor.ts`

- Change `safeLoadLaufConfig(env.LAUF_WORKSPACE_ROOT)` to `safeLoadLaufConfig(env.LAUF_CONFIG_DIR)`
- Add `LAUF_CONFIG_DIR` to env schema

---

## 13. Changes to `packages/lauf/src/runtime/runner.ts`

- Accept config directory in `runScript` options
- Pass `LAUF_CONFIG_DIR` in spawned environment

---

## 14. Changes to `packages/lauf/src/lib/discovery.ts`

Add optional `scopeDir` parameter:

```typescript
export function discoverScripts(
  patterns: string[],
  options?: { readonly scopeDir?: string },
): readonly DiscoveredScript[];
```

When `scopeDir` is provided, discover scripts relative to that directory only.

---

## 15. Test Plan

### New tests: `config-discovery.test.ts`

- `detectSearchBoundary`: finds `.git`, caps at 20 dirs, handles fs root, handles `.git` file (submodules)
- `findConfigFile`: finds in cwd, parent, prefers `lauf` over `laufen`, stops at boundary, returns undefined when missing, finds closest in nested scenario
- `collectSearchDirs`: correct dir set, inclusive boundary, single dir
- `discoverAllConfigs`: finds subdirectory configs, deduplicates, sorts by depth

### Updated tests

- `config.test.ts`: mock `findConfigFile`, test `loadLaufConfigWithMeta`, test `loadAllLaufConfigs`
- `init.test.ts`: writes to cwd, detects existing config via upward search
- All handler tests: update `safeLoadLaufConfig` mock expectations from `getWorkspaceRoot()` to `process.cwd()`
- `list.test.ts`: add `--all` flag tests

---

## 16. Edge Cases

1. **No config found** -> return defaults (preserved)
2. **Multiple configs at same level** -> `lauf.config.ts` wins
3. **Symlinked directories** -> `path.resolve` follows symlinks
4. **Git submodules** -> `.git` file (not dir) still counts as boundary
5. **Bare git repos** -> fallback to 20-dir cap
6. **Config at filesystem root** -> found if within boundary
7. **`--all` deeply nested** -> bounded by search boundary
8. **Config inside `.git/`** -> ignored (walker checks directory, not `.git` contents)
9. **TOCTOU (config deleted between find and load)** -> handled by error tuple
10. **Windows paths** -> use `path.sep`/`path.resolve` throughout

---

## 17. Migration / Backwards Compatibility

**Breaking change** for users relying on config always loading from workspace root. For monorepos with a single root config, behavior is identical. The difference is for nested configs where the closest now wins. Document in changeset.

---

## 18. Dependency Changes

- **c12**: retained for config evaluation (TypeScript via jiti). Used with explicit `configFile` instead of auto-resolution.
- **No new dependencies.** Upward walker uses `node:fs` + `node:path`. `fast-glob` (existing) for `discoverAllConfigs`.

---

## 19. Implementation Order

1. Create `lib/config-discovery.ts` with `detectSearchBoundary`, `collectSearchDirs`, `findConfigFile`, `discoverAllConfigs`
2. Create `lib/config-discovery.test.ts`
3. Update `lib/config.ts` to use `findConfigFile`; add `loadLaufConfigWithMeta` and `loadAllLaufConfigs`
4. Update `lib/config.test.ts`
5. Update `handlers/init.ts` to write to cwd and use `findConfigFile`
6. Update all handlers to pass `process.cwd()` instead of `getWorkspaceRoot()`
7. Add `--all` flag to `list` command in `index.ts`
8. Implement `--all` logic in `handlers/list.ts`
9. Update `runtime/runner.ts` to pass `LAUF_CONFIG_DIR`
10. Update `runtime/executor.ts` to use `LAUF_CONFIG_DIR`
11. Update all handler tests
12. Update/add discovery tests for `--all` scoping
