import * as p from '@clack/prompts';
import { loadConfig } from 'c12';
import { createJiti } from 'jiti';
import { attemptAsync, isErr, type Result } from 'massaman/control';

import type { Workspace } from '../workspace/index.ts';
import { discoverWorkspaces, findNearestWorkspace, resolveRoot } from '../workspace/index.ts';
import { DEFAULTS, validateConfig } from './schema.ts';
import type { LaufConfig, LoadedConfig, ResolvedLaufConfig } from './types.ts';

export interface ConfigLoaderOptions {
  readonly cwd?: string;
}

export interface ConfigLoader {
  readonly cwd: string;
  load(): Promise<ResolvedLaufConfig>;
  loadWithMeta(): Promise<LoadedConfig>;
  loadAll(): Promise<readonly LoadedConfig[]>;
  safeLoad(): Promise<Result<ResolvedLaufConfig>>;
  safeLoadWithMeta(): Promise<Result<LoadedConfig>>;
}

function resolveCwd(options: ConfigLoaderOptions | undefined): string {
  if (options && options.cwd) {
    return options.cwd;
  }
  return process.cwd();
}

function createConfigImport(configFile: string): (id: string) => Promise<unknown> {
  const jiti = createJiti(configFile, {
    interopDefault: true,
    moduleCache: false,
  });
  return (id: string) => jiti.import(id);
}

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

async function loadFromWorkspace(workspace: Workspace): Promise<LoadedConfig> {
  const config = await loadConfigFromWorkspace(workspace);
  return {
    config,
    configFile: workspace.configFile,
    configDir: workspace.dir,
  };
}

function defaultsFor(dir: string): LoadedConfig {
  return { config: DEFAULTS, configFile: undefined, configDir: dir };
}

export function createConfigLoader(options?: ConfigLoaderOptions): ConfigLoader {
  const cwd = resolveCwd(options);

  const loadWithMeta = (): Promise<LoadedConfig> => {
    const root = resolveRoot(cwd);
    const workspace = findNearestWorkspace(cwd, root);
    if (!workspace) {
      return Promise.resolve(defaultsFor(cwd));
    }
    return loadFromWorkspace(workspace);
  };

  const load = async (): Promise<ResolvedLaufConfig> => {
    const loaded = await loadWithMeta();
    return loaded.config;
  };

  const loadAll = (): Promise<readonly LoadedConfig[]> => {
    const root = resolveRoot(cwd);
    const workspaces = discoverWorkspaces(root);
    if (workspaces.length === 0) {
      return Promise.resolve([defaultsFor(cwd)]);
    }
    return Promise.all(workspaces.map((ws) => loadFromWorkspace(ws)));
  };

  return {
    cwd,
    load,
    loadWithMeta,
    loadAll,
    safeLoad: () => attemptAsync(load),
    safeLoadWithMeta: () => attemptAsync(loadWithMeta),
  };
}
