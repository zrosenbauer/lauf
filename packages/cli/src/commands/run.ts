// oxlint-disable import/max-dependencies, max-lines
import type { CommandContext } from '@kidd-cli/core';
import { command } from '@kidd-cli/core';
import type { ResolvedLaufConfig } from '@laufen/config';
import { isErr, loadAllLaufConfigs, safeLoadLaufConfigWithMeta } from '@laufen/config';
import type { CachedWorkspaceState, DiscoveredScript, Workspace } from '@laufen/config/workspace';
import { discoverAllScripts, findScript } from '@laufen/config/workspace';
import type {
  EnvContext,
  RunResult,
  ScriptTarget,
  WatchConfig,
  WatchContext,
} from '@laufen/engine';
import { extractPackages, generatePackageTypes, resolveEnvValue, runScript } from '@laufen/engine';
import { attemptAsync } from 'es-toolkit';
import { z } from 'zod';

import { LAUF_ROOT } from '../lib/paths.ts';
import { createWatcher, loadScriptWatchConfig, mergeWatchConfig } from '../lib/watcher.ts';
import { extractEnvFlags, parseRawArgs, sliceArgvAfter } from '../utils/argv.ts';
import { safeParseError } from '../utils/cli.ts';

const positionals = z.object({
  script: z.string().min(1).optional().describe('Script name to run'),
});

const options = z.object({
  watch: z.boolean().default(false).describe('Watch files and rerun on changes'),
});

type RunCtx = CommandContext;

/**
 * `lauf run [script]` — execute a discovered lauf script through the engine.
 *
 * Forwards everything after the script name as the script's own argv,
 * supports `--env KEY=VAL` flags, `--help`, and `--watch` mode.
 */
export default command({
  description: 'Run a script',
  positionals,
  options,
  // oxlint-disable-next-line max-lines-per-function
  handler: async (ctx) => {
    const configResult = await safeLoadLaufConfigWithMeta(process.cwd());
    if (isErr(configResult)) {
      ctx.fail(`Failed to load lauf config: ${configResult.error.message}`);
      return;
    }
    const loaded = configResult.value;

    const wsState = ctx.workspace;
    const currentWorkspaceDir = wsState.current && wsState.current.dir;

    const script = await resolveTarget(ctx, ctx.args.script, currentWorkspaceDir);

    const rawArgv = resolveRawArgv(ctx.args.script);
    const { env: cliEnv, remaining: cleanArgv } = extractEnvFlags(rawArgv);
    const isHelp = cleanArgv.includes('--help') || cleanArgv.includes('-h');
    const isWatch = ctx.args.watch || cleanArgv.includes('--watch') || cleanArgv.includes('-w');
    const scriptArgv = cleanArgv.filter((arg) => arg !== '--watch' && arg !== '-w');
    const workspaceRoot = wsState.root.dir;

    const envCtx: EnvContext = {
      script: { name: script.name, path: script.path, packageDir: script.packageDir },
      workspace: workspaceRoot,
    };
    const [envError, configEnv] = await resolveEnvValue(loaded.config.env, envCtx);
    if (envError) {
      ctx.fail(`Failed to resolve config env: ${safeParseError(envError)}`);
      return;
    }

    // Extract script-level packages for type generation (best-effort).
    const [extractError, scriptPackages] = await extractPackages(script.path);
    if (extractError) {
      ctx.log.warn(`Failed to extract script packages: ${safeParseError(extractError)}`);
    }

    const allPackages = { ...loaded.config.packages, ...scriptPackages };
    if (Object.keys(allPackages).length > 0) {
      const [typeGenError] = generatePackageTypes(script.packageDir, allPackages);
      if (typeGenError) {
        ctx.log.warn(`Failed to generate package types: ${safeParseError(typeGenError)}`);
      }
    }

    if (isHelp) {
      await runHelp(
        ctx,
        script,
        workspaceRoot,
        currentWorkspaceDir,
        loaded.config,
        configEnv,
        cliEnv,
      );
      return;
    }

    const args = parseRawArgs(scriptArgv);

    if (isWatch) {
      const scriptWatchConfig = await loadScriptWatchConfig(script.path);
      const watchConfig = mergeWatchConfig(loaded.config.watch, scriptWatchConfig);
      if (watchConfig === undefined) {
        ctx.fail(
          `No watch config found for ${ctx.colors.cyan(script.name)}. ` +
            `Add a "watch" field to your script or to lauf.config.ts.`,
        );
        return;
      }
      await runWatchMode(
        ctx,
        script,
        args,
        workspaceRoot,
        currentWorkspaceDir,
        loaded.config,
        configEnv,
        cliEnv,
        watchConfig,
      );
      return;
    }

    await runNormalMode(
      ctx,
      script,
      args,
      workspaceRoot,
      currentWorkspaceDir,
      loaded.config,
      configEnv,
      cliEnv,
    );
  },
});

async function resolveTarget(
  ctx: RunCtx,
  scriptName: string | undefined,
  currentWorkspaceDir: string | undefined,
): Promise<DiscoveredScript> {
  const wsState = ctx.workspace;
  const configs = await loadAllLaufConfigs(process.cwd());

  const workspacePairs: (readonly [Workspace, readonly string[]])[] = wsState.tree.workspaces.map(
    (ws) => {
      const loaded = configs.find((c) => c.configDir === ws.dir);
      const patterns = resolvePatterns(loaded);
      return [ws, patterns] as const;
    },
  );

  if (scriptName) {
    const found = findScript(scriptName, wsState.current, workspacePairs, wsState.root);
    if (!found) {
      ctx.fail(`Script not found: ${scriptName}`, { code: 'SCRIPT_NOT_FOUND' });
    }
    return found;
  }

  const scripts = collectInteractiveScripts(workspacePairs, wsState.root, currentWorkspaceDir);

  if (scripts.length === 0) {
    ctx.fail('No scripts found', { code: 'NO_SCRIPTS' });
  }

  return ctx.prompts.select({
    message: 'Select a script',
    options: scripts.map((s) => ({ value: s, label: s.name })),
  });
}

const DISABLED_WATCH: WatchContext = {
  enabled: false,
  changedFiles: [],
  patterns: [],
};

function resolveRawArgv(scriptName: string | undefined): readonly string[] {
  if (scriptName) {
    return sliceArgvAfter(scriptName);
  }
  return [];
}

function resolvePatterns(
  loaded: { config: { scripts: readonly string[] } } | undefined,
): readonly string[] {
  if (loaded) {
    return loaded.config.scripts;
  }
  return ['scripts/*.ts'];
}

function collectInteractiveScripts(
  workspacePairs: readonly (readonly [Workspace, readonly string[]])[],
  root: CachedWorkspaceState['root'],
  currentWorkspaceDir: string | undefined,
): readonly DiscoveredScript[] {
  if (currentWorkspaceDir) {
    return discoverAllScripts(workspacePairs, root, { workspaceDir: currentWorkspaceDir });
  }
  return discoverAllScripts(workspacePairs, root);
}

async function executeScript(
  ctx: RunCtx,
  script: ScriptTarget,
  args: Record<string, unknown>,
  workspaceRoot: string,
  workspaceDir: string | undefined,
  config: ResolvedLaufConfig,
  configEnv: Record<string, string>,
  cliEnv: Record<string, string>,
  watch: WatchContext,
): Promise<RunResult> {
  const label = ctx.colors.cyan(script.name);
  ctx.log.step(`Running ${label}`);
  const result = await runScript(script, args, {
    workspaceRoot,
    cliPackageRoot: LAUF_ROOT,
    workspaceDir,
    spinner: config.spinner,
    env: configEnv,
    cliEnv,
    sandbox: config.sandbox,
    workspacePackages: config.packages,
    watch,
  });
  if (result.exitCode === 0) {
    ctx.log.success(`${label} completed successfully`);
  }
  return result;
}

/* v8 ignore start -- help mode delegates to executor */
async function runHelp(
  ctx: RunCtx,
  script: ScriptTarget,
  workspaceRoot: string,
  workspaceDir: string | undefined,
  config: ResolvedLaufConfig,
  configEnv: Record<string, string>,
  cliEnv: Record<string, string>,
): Promise<void> {
  const result = await runScript(
    script,
    {},
    {
      help: true,
      workspaceRoot,
      cliPackageRoot: LAUF_ROOT,
      workspaceDir,
      spinner: config.spinner,
      env: configEnv,
      cliEnv,
      sandbox: config.sandbox,
      workspacePackages: config.packages,
    },
  );
  if (result.exitCode !== 0) {
    ctx.fail(`Help failed for ${script.name}`, { exitCode: result.exitCode });
  }
}
/* v8 ignore stop */

async function runNormalMode(
  ctx: RunCtx,
  script: ScriptTarget,
  args: Record<string, unknown>,
  workspaceRoot: string,
  workspaceDir: string | undefined,
  config: ResolvedLaufConfig,
  configEnv: Record<string, string>,
  cliEnv: Record<string, string>,
): Promise<void> {
  const result = await executeScript(
    ctx,
    script,
    args,
    workspaceRoot,
    workspaceDir,
    config,
    configEnv,
    cliEnv,
    DISABLED_WATCH,
  );
  if (result.exitCode !== 0) {
    ctx.fail(`${ctx.colors.cyan(script.name)} exited with code ${result.exitCode}`, {
      exitCode: result.exitCode,
    });
  }
}

// oxlint-disable-next-line max-lines-per-function
async function runWatchMode(
  ctx: RunCtx,
  script: ScriptTarget,
  args: Record<string, unknown>,
  workspaceRoot: string,
  workspaceDir: string | undefined,
  config: ResolvedLaufConfig,
  configEnv: Record<string, string>,
  cliEnv: Record<string, string>,
  watchConfig: WatchConfig,
): Promise<void> {
  const patterns = [...watchConfig.patterns];
  const initialWatch: WatchContext = { enabled: true, changedFiles: [], patterns };

  const initialResult = await executeScript(
    ctx,
    script,
    args,
    workspaceRoot,
    workspaceDir,
    config,
    configEnv,
    cliEnv,
    initialWatch,
  );

  if (initialResult.exitCode !== 0) {
    ctx.log.warn(
      `Initial run failed (exit ${initialResult.exitCode}). Watching for changes to retry...`,
    );
  }

  let isRunning = false;

  const [watcherError, watcher] = await attemptAsync(() =>
    createWatcher(watchConfig, script.packageDir, (changedFiles) => {
      if (isRunning) {
        ctx.log.warn('Script still running, skipping rerun...');
        return;
      }

      const label = ctx.colors.cyan(script.name);
      ctx.log.step(`Re-running ${label} (changed: ${changedFiles.join(', ')})`);

      isRunning = true;
      const watchCtx: WatchContext = { enabled: true, changedFiles, patterns };
      executeScript(
        ctx,
        script,
        args,
        workspaceRoot,
        workspaceDir,
        config,
        configEnv,
        cliEnv,
        watchCtx,
      )
        .then((result) => {
          isRunning = false;
          if (result.exitCode === 0) {
            return ctx.log.info(`Watching: ${patterns.join(', ')}`);
          }
          return ctx.log.warn(`Exited with code ${result.exitCode}. Watching for changes...`);
        })
        .catch((err: unknown) => {
          isRunning = false;
          return ctx.log.error(`Script execution failed: ${safeParseError(err)}`);
        });
    }),
  );

  if (watcherError !== null || watcher === null) {
    ctx.fail(`Failed to start file watcher: ${safeParseError(watcherError)}`);
  }

  ctx.log.info(`Watching: ${patterns.join(', ')}`);

  await new Promise<void>((resolve) => {
    const cleanup = (): void => {
      watcher
        .cleanup()
        .then(() => {
          ctx.log.info('Watch mode stopped.');
          return resolve();
        })
        .catch((err: unknown) => {
          ctx.log.warn(`Watcher cleanup failed: ${safeParseError(err)}`);
          return resolve();
        });
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  });
}
