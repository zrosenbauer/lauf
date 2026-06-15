import * as p from '@clack/prompts';
import { loadConfig } from 'c12';
import { createJiti } from 'jiti';

import { isErr } from '../result.ts';
import type { Workspace } from '../workspace/index.ts';
import { discoverWorkspaces, findNearestWorkspace, resolveRoot } from '../workspace/index.ts';
import { DEFAULTS, validateConfig } from './schema.ts';
import type { LaufConfig, LoadedConfig, ResolvedLaufConfig } from './types.ts';

/**
 * Bypass c12's native `import()` (which triggers Node's
 * `MODULE_TYPELESS_PACKAGE_JSON` warning on `.ts` configs) by anchoring
 * a jiti loader at the config file path.
 */
function createConfigImport(configFile: string): (id: string) => Promise<unknown> {
  const jiti = createJiti(configFile, {
    interopDefault: true,
    moduleCache: false,
  });
  return (id: string) => jiti.import(id);
}

/**
 * Load a single workspace's config via c12 + jiti, validating the result
 * against the resolved schema. Returns {@link DEFAULTS} on validation
 * failure (with a warning) and when c12 doesn't find a config file.
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

  const validated = validateConfig(loaded.config);
  if (isErr(validated)) {
    p.log.warn(
      `Config validation failed for ${loaded.configFile}: ${validated.error.message}. Using defaults.`,
    );
    return DEFAULTS;
  }
  return validated.value;
}

/**
 * Build a {@link LoadedConfig} from a workspace.
 */
async function loadFromWorkspace(workspace: Workspace): Promise<LoadedConfig> {
  const config = await loadConfigFromWorkspace(workspace);
  return {
    config,
    configFile: workspace.configFile,
    configDir: workspace.dir,
  };
}

/**
 * Build a defaults-only {@link LoadedConfig} for the given dir.
 */
function defaultsFor(dir: string): LoadedConfig {
  return { config: DEFAULTS, configFile: undefined, configDir: dir };
}

/**
 * Load the closest lauf config to `cwd`, with metadata about its
 * location. Returns defaults (and `configFile: undefined`) when no
 * config is found between `cwd` and the workspace root.
 */
export function loadLaufConfigWithMeta(cwd: string): Promise<LoadedConfig> {
  const root = resolveRoot(cwd);
  const workspace = findNearestWorkspace(cwd, root);
  if (!workspace) {
    return Promise.resolve(defaultsFor(cwd));
  }
  return loadFromWorkspace(workspace);
}

/**
 * Load the closest lauf config to `cwd`. Thin convenience wrapper over
 * {@link loadLaufConfigWithMeta} that drops the metadata.
 */
export async function loadLaufConfig(cwd: string): Promise<ResolvedLaufConfig> {
  const loaded = await loadLaufConfigWithMeta(cwd);
  return loaded.config;
}

/**
 * Load every workspace config under the resolved root boundary.
 *
 * Always returns at least one entry — defaults-only when no configs are
 * discovered.
 */
export function loadAllLaufConfigs(startDir: string): Promise<readonly LoadedConfig[]> {
  const root = resolveRoot(startDir);
  const workspaces = discoverWorkspaces(root);
  if (workspaces.length === 0) {
    return Promise.resolve([defaultsFor(startDir)]);
  }
  return Promise.all(workspaces.map((ws) => loadFromWorkspace(ws)));
}
