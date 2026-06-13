import * as p from '@clack/prompts';
import type { DefaultLogger, EnvFn, WatchConfig } from '@laufen/engine';
import { loadConfig } from 'c12';
import { attemptAsync } from 'es-toolkit';
import { createJiti } from 'jiti';
import { z } from 'zod';

import type { Result } from './result.ts';
import {
  type Workspace,
  discoverWorkspaces,
  findNearestWorkspace,
  resolveRoot,
} from './workspace/index.ts';

/**
 * Env value type: a static record or a function that receives an EnvContext.
 */
type EnvValue = Record<string, string> | EnvFn;

export interface LaufConfig {
  /**
   * Mark this config as the workspace root boundary.
   * When `true`, workspace discovery stops here instead of walking up to `.git`.
   */
  root?: boolean;
  scripts?: string[];
  logger?: DefaultLogger;
  spinner?: boolean;
  sandbox?: boolean;
  env?: EnvValue;
  /**
   * Workspace-level package dependencies available to all scripts.
   * Script-level packages take precedence for version conflicts.
   */
  packages?: Record<string, string>;
  watch?: WatchConfig;
}

export interface ResolvedLaufConfig {
  root: boolean;
  scripts: string[];
  logger: DefaultLogger | undefined;
  spinner: boolean;
  sandbox: boolean;
  env: EnvValue;
  packages: Record<string, string>;
  watch: WatchConfig | undefined;
}

/**
 * Metadata about a loaded config, including where it was found.
 */
export interface LoadedConfig {
  readonly config: ResolvedLaufConfig;
  readonly configFile: string | undefined;
  readonly configDir: string;
}

/**
 * Runtime check that a value structurally satisfies the DefaultLogger interface.
 * Validates presence of required method names matching Logger + DefaultLogger.
 */
const loggerSchema = z
  .object({
    info: z.function(),
    warn: z.function(),
    error: z.function(),
    success: z.function(),
    message: z.function(),
    newlines: z.function(),
  })
  .optional();

const watchConfigSchema: z.ZodType<WatchConfig | undefined> = z
  .object({
    patterns: z.array(z.string().min(1)).min(1),
    debounce: z.number().int().nonnegative().optional(),
    ignored: z.array(z.string().min(1)).optional(),
  })
  .optional();

/**
 * Zod schema that validates the shape of a resolved lauf config.
 *
 * The `env` field accepts either a plain record or a function, so
 * we use a union of `z.record` and `z.function()`.
 */
const resolvedLaufConfigSchema: z.ZodType<ResolvedLaufConfig> = z.object({
  root: z.boolean(),
  scripts: z.array(z.string()),
  logger: loggerSchema,
  spinner: z.boolean(),
  sandbox: z.boolean(),
  env: z.union([z.record(z.string(), z.string()), z.function()]),
  packages: z.record(z.string(), z.string()),
  watch: watchConfigSchema,
}) as z.ZodType<ResolvedLaufConfig>;

const DEFAULTS: ResolvedLaufConfig = {
  root: false,
  scripts: ['scripts/*.ts'],
  logger: undefined,
  spinner: true,
  sandbox: true,
  env: {},
  packages: {},
  watch: undefined,
};

/**
 * Validate a raw config value against the resolved config schema.
 *
 * @param raw - Value returned from `c12.loadConfig`
 * @returns Validated config or an Error
 */
function validateConfig(raw: unknown): Result<ResolvedLaufConfig> {
  const result = resolvedLaufConfigSchema.safeParse(raw);
  if (!result.success) {
    return [new Error(`Invalid lauf config: ${result.error.message}`), null];
  }
  return [null, result.data];
}

/**
 * Build a jiti-backed import function anchored to the given file path.
 *
 * Bypasses c12's native `import()` attempt which triggers Node's
 * MODULE_TYPELESS_PACKAGE_JSON warning on `.ts` config files.
 */
function createConfigImport(configFile: string): (id: string) => Promise<unknown> {
  const jiti = createJiti(configFile, {
    interopDefault: true,
    moduleCache: false,
  });
  return (id: string) => jiti.import(id);
}

/**
 * Load a config from a discovered workspace via c12.
 */
async function loadConfigFromWorkspace(workspace: Workspace): Promise<ResolvedLaufConfig> {
  const loaded = await loadConfig<LaufConfig>({
    name: workspace.configName,
    cwd: workspace.dir,
    defaults: DEFAULTS,
    import: createConfigImport(workspace.configFile),
  });

  if (!loaded.configFile) {
    return DEFAULTS;
  }

  const [error, config] = validateConfig(loaded.config);
  if (error) {
    p.log.warn(
      `Config validation failed for ${loaded.configFile}: ${error.message}. Using defaults.`,
    );
    return DEFAULTS;
  }
  return config;
}

/**
 * Load the closest lauf config by walking upward from cwd.
 *
 * Uses workspace discovery to locate the nearest config file,
 * then loads it via c12. Returns defaults when no config is found.
 */
export function loadLaufConfig(cwd: string): Promise<ResolvedLaufConfig> {
  const root = resolveRoot(cwd);
  const workspace = findNearestWorkspace(cwd, root);
  if (!workspace) {
    return Promise.resolve(DEFAULTS);
  }
  return loadConfigFromWorkspace(workspace);
}

/**
 * Load the closest config with metadata about where it was found.
 *
 * Returns the resolved config along with the config file path and directory.
 * When no config file is found, returns defaults with `configFile: undefined`
 * and `configDir` set to the provided cwd.
 */
export async function loadLaufConfigWithMeta(cwd: string): Promise<LoadedConfig> {
  const root = resolveRoot(cwd);
  const workspace = findNearestWorkspace(cwd, root);
  if (!workspace) {
    return { config: DEFAULTS, configFile: undefined, configDir: cwd };
  }

  const config = await loadConfigFromWorkspace(workspace);
  return {
    config,
    configFile: workspace.configFile,
    configDir: workspace.dir,
  };
}

/**
 * Load all configs within the workspace root boundary.
 *
 * Used by the `--all` flag to aggregate configs from subdirectories.
 * Returns at least one entry — defaults when no config files are found.
 */
export function loadAllLaufConfigs(startDir: string): Promise<readonly LoadedConfig[]> {
  const root = resolveRoot(startDir);
  const workspaces = discoverWorkspaces(root);
  if (workspaces.length === 0) {
    return Promise.resolve([{ config: DEFAULTS, configFile: undefined, configDir: startDir }]);
  }

  return Promise.all(
    workspaces.map(async (workspace): Promise<LoadedConfig> => {
      const config = await loadConfigFromWorkspace(workspace);
      return {
        config,
        configFile: workspace.configFile,
        configDir: workspace.dir,
      };
    }),
  );
}

/**
 * Safely load lauf config, returning an error tuple instead of throwing.
 */
export async function safeLoadLaufConfig(cwd: string): Promise<Result<ResolvedLaufConfig>> {
  const [error, config] = await attemptAsync(() => loadLaufConfig(cwd));

  if (error !== null) {
    if (error instanceof Error) {
      return [error, null];
    }
    return [new Error(String(error)), null];
  }

  /* v8 ignore start -- TypeScript narrowing guard; attemptAsync types T | null even after error check */
  if (config === null) {
    return [new Error('Config loading returned null unexpectedly'), null];
  }
  /* v8 ignore stop */

  return [null, config];
}

/**
 * Safely load lauf config with metadata, returning an error tuple.
 */
export async function safeLoadLaufConfigWithMeta(cwd: string): Promise<Result<LoadedConfig>> {
  const [error, loaded] = await attemptAsync(() => loadLaufConfigWithMeta(cwd));

  if (error !== null) {
    if (error instanceof Error) {
      return [error, null];
    }
    return [new Error(String(error)), null];
  }

  /* v8 ignore start -- TypeScript narrowing guard; attemptAsync types T | null even after error check */
  if (loaded === null) {
    return [new Error('Config loading returned null unexpectedly'), null];
  }
  /* v8 ignore stop */

  return [null, loaded];
}
