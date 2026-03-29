// oxlint-disable import/max-dependencies, max-lines
import * as p from '@clack/prompts';
import type {
  EnvContext,
  RunResult,
  ScriptConfig,
  ScriptTarget,
  WatchConfig,
  WatchContext,
} from '@laufen/engine';
import { extractPackages, generatePackageTypes, resolveEnvValue, runScript } from '@laufen/engine';
import { attemptAsync } from 'es-toolkit';
import pc from 'picocolors';
import { z } from 'zod';

import type { ResolvedLaufConfig } from '../lib/config.ts';
import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { defineHandler } from '../lib/handler.ts';
import { LAUF_ROOT, getWorkspaceRoot, resolveCurrentPackage } from '../lib/paths.ts';
import type { HandlerResult, Result } from '../lib/result.ts';
import { fail, ok } from '../lib/result.ts';
import { createWatcher, loadScriptWatchConfig, mergeWatchConfig } from '../lib/watcher.ts';
import { consumeScriptHelpRequested } from '../state/script-help.ts';
import { extractEnvFlags, parseRawArgs, sliceArgvAfter } from '../utils/argv.ts';
import { safeParseError } from '../utils/cli.ts';
import { resolveScript } from '../utils/resolve-script.ts';

const runParams = z.object({
  parameters: z.object({ script: z.string().min(1).optional() }),
});

export default defineHandler({
  parameters: runParams,
  // oxlint-disable-next-line max-lines-per-function
  handler: async (ctx) => {
    const [configError, loaded] = await safeLoadLaufConfigWithMeta(process.cwd());
    if (configError) {
      return fail({ message: `Failed to load lauf config: ${safeParseError(configError)}` });
    }

    const currentPkg = resolveCurrentPackage(process.cwd());
    const currentPkgDir = currentPkg ? currentPkg.dir : undefined;

    const [scriptError, script] = await resolveScript(
      ctx.parameters.script,
      loaded.config.scripts,
      { packageDir: currentPkgDir },
    );
    if (scriptError) {
      return fail(scriptError);
    }

    const rawArgv = resolveRawArgv(ctx.parameters.script);
    const { env: cliEnv, remaining: cleanArgv } = extractEnvFlags(rawArgv);
    const isHelp =
      consumeScriptHelpRequested() || cleanArgv.includes('--help') || cleanArgv.includes('-h');
    const isWatch = cleanArgv.includes('--watch') || cleanArgv.includes('-w');
    const scriptArgv = cleanArgv.filter((arg) => arg !== '--watch' && arg !== '-w');
    const workspaceRoot = getWorkspaceRoot();

    const [envError, configEnv] = await resolveConfigEnv(loaded.config.env, script, workspaceRoot);
    if (envError) {
      return fail({ message: `Failed to resolve config env: ${safeParseError(envError)}` });
    }

    // Extract script-level packages for type generation (best-effort, non-fatal).
    // This imports the script to read its config — failures are tolerated since
    // the engine orchestrator will also extract packages at runtime.
    const [extractError, scriptPackages] = await extractPackages(script.path);
    if (extractError) {
      p.log.warn(`Failed to extract script packages: ${safeParseError(extractError)}`);
    }

    const allPackages = { ...loaded.config.packages, ...scriptPackages };
    // Generate types in the package directory (best-effort, non-fatal)
    if (Object.keys(allPackages).length > 0) {
      const [typeGenError] = generatePackageTypes(script.packageDir, allPackages);
      if (typeGenError) {
        p.log.warn(`Failed to generate package types: ${safeParseError(typeGenError)}`);
      }
    }

    if (isHelp) {
      return runHelpMode(
        script,
        workspaceRoot,
        currentPkgDir,
        loaded.config.spinner,
        configEnv,
        cliEnv,
        loaded.config.sandbox,
        loaded.config.packages,
      );
    }

    if (isWatch) {
      const scriptWatchConfig = await loadScriptWatchConfig(script.path);
      const watchConfig = mergeWatchConfig(loaded.config.watch, scriptWatchConfig);

      if (watchConfig === undefined) {
        return fail({
          message:
            `No watch config found for ${pc.cyan(script.name)}. ` +
            `Add a "watch" field to your script or to lauf.config.ts.`,
        });
      }

      return runWatchMode(
        script,
        parseRawArgs(scriptArgv),
        workspaceRoot,
        currentPkgDir,
        loaded.config,
        configEnv,
        cliEnv,
        watchConfig,
      );
    }

    return runNormalMode(
      script,
      parseRawArgs(scriptArgv),
      workspaceRoot,
      currentPkgDir,
      loaded.config,
      configEnv,
      cliEnv,
    );
  },
});

/**
 * Extract raw argv entries following the given script name.
 * Returns an empty array when no script name was provided on the CLI.
 */
function resolveRawArgv(scriptName: string | undefined): readonly string[] {
  if (scriptName) {
    return sliceArgvAfter(scriptName);
  }
  return [];
}

/**
 * Build an EnvContext and resolve config-level env (may be a function).
 */
function resolveConfigEnv(
  envValue: ScriptConfig['env'],
  script: ScriptTarget,
  workspaceRoot: string,
): Promise<Result<Record<string, string>>> {
  const envCtx: EnvContext = {
    script: { name: script.name, path: script.path, packageDir: script.packageDir },
    workspace: workspaceRoot,
  };
  return resolveEnvValue(envValue, envCtx);
}

/**
 * Run the script in help mode, displaying its argument schema.
 */
/* v8 ignore start -- help via runScript delegates to executor which handles its own errors */
async function runHelpMode(
  script: ScriptTarget,
  workspaceRoot: string,
  invocationDir: string | undefined,
  spinner: boolean,
  env: Record<string, string>,
  cliEnv: Record<string, string>,
  sandbox: boolean,
  workspacePackages: Record<string, string>,
): Promise<HandlerResult> {
  const helpResult = await runScript(
    script,
    {},
    {
      help: true,
      workspaceRoot,
      cliPackageRoot: LAUF_ROOT,
      invocationDir,
      spinner,
      env,
      cliEnv,
      sandbox,
      workspacePackages,
    },
  );
  if (helpResult.exitCode === 0) {
    return ok();
  }
  return fail({ message: `Help failed for ${script.name}`, exitCode: helpResult.exitCode });
}
/* v8 ignore stop */

/**
 * Run a script in normal (non-help) mode, logging start and result.
 */
async function runNormalMode(
  script: ScriptTarget,
  args: Record<string, unknown>,
  workspaceRoot: string,
  invocationDir: string | undefined,
  config: ResolvedLaufConfig,
  configEnv: Record<string, string>,
  cliEnv: Record<string, string>,
): Promise<HandlerResult> {
  const result = await executeScript(
    script,
    args,
    workspaceRoot,
    invocationDir,
    config.spinner,
    configEnv,
    cliEnv,
    config.sandbox,
    config.packages,
    DISABLED_WATCH,
  );

  if (result.exitCode === 0) {
    return ok();
  }

  return fail({
    message: `${pc.cyan(script.name)} exited with code ${result.exitCode}`,
    exitCode: result.exitCode,
  });
}

/**
 * Run a script, logging start and result messages.
 */
async function executeScript(
  script: ScriptTarget,
  args: Record<string, unknown>,
  workspaceRoot: string,
  invocationDir: string | undefined,
  spinner: boolean,
  env: Record<string, string>,
  cliEnv: Record<string, string>,
  sandbox: boolean,
  workspacePackages: Record<string, string>,
  watch: WatchContext,
): Promise<RunResult> {
  const label = pc.cyan(script.name);

  p.log.step(`Running ${label}`);
  const result = await runScript(script, args, {
    workspaceRoot,
    cliPackageRoot: LAUF_ROOT,
    invocationDir,
    spinner,
    env,
    cliEnv,
    sandbox,
    workspacePackages,
    watch,
  });
  if (result.exitCode === 0) {
    p.log.success(`${label} completed successfully`);
  }
  return result;
}

const DISABLED_WATCH: WatchContext = {
  enabled: false,
  changedFiles: [],
  patterns: [],
};

/**
 * Run a script in watch mode: execute once immediately, then rerun on file changes.
 *
 * Exits cleanly on SIGINT/SIGTERM, closing the watcher before resolving.
 */
// oxlint-disable-next-line max-lines-per-function
async function runWatchMode(
  script: ScriptTarget,
  args: Record<string, unknown>,
  workspaceRoot: string,
  invocationDir: string | undefined,
  config: ResolvedLaufConfig,
  configEnv: Record<string, string>,
  cliEnv: Record<string, string>,
  watchConfig: WatchConfig,
): Promise<HandlerResult> {
  const patterns = [...watchConfig.patterns];
  const initialWatch: WatchContext = { enabled: true, changedFiles: [], patterns };

  const initialResult = await executeScript(
    script,
    args,
    workspaceRoot,
    invocationDir,
    config.spinner,
    configEnv,
    cliEnv,
    config.sandbox,
    config.packages,
    initialWatch,
  );

  if (initialResult.exitCode !== 0) {
    p.log.warn(
      `Initial run failed (exit ${initialResult.exitCode}). Watching for changes to retry...`,
    );
  }

  let isRunning = false;

  const [watcherError, watcher] = await attemptAsync(() =>
    createWatcher(watchConfig, script.packageDir, (changedFiles) => {
      if (isRunning) {
        p.log.warn('Script still running, skipping rerun...');
        return;
      }

      const label = pc.cyan(script.name);
      p.log.step(`Re-running ${label} (changed: ${changedFiles.join(', ')})`);

      isRunning = true;
      const watchCtx: WatchContext = { enabled: true, changedFiles, patterns };
      executeScript(
        script,
        args,
        workspaceRoot,
        invocationDir,
        config.spinner,
        configEnv,
        cliEnv,
        config.sandbox,
        config.packages,
        watchCtx,
      )
        .then((result) => {
          isRunning = false;
          if (result.exitCode === 0) {
            return p.log.info(`Watching: ${patterns.join(', ')}`);
          }
          return p.log.warn(`Exited with code ${result.exitCode}. Watching for changes...`);
        })
        .catch((err: unknown) => {
          isRunning = false;
          return p.log.error(`Script execution failed: ${safeParseError(err)}`);
        });
    }),
  );

  if (watcherError !== null || watcher === null) {
    return fail({ message: `Failed to start file watcher: ${safeParseError(watcherError)}` });
  }

  p.log.info(`Watching: ${patterns.join(', ')}`);

  return new Promise<HandlerResult>((resolve) => {
    const cleanup = (): void => {
      watcher
        .cleanup()
        .then(() => {
          p.log.info('Watch mode stopped.');
          return resolve(ok());
        })
        .catch((err: unknown) => {
          p.log.warn(`Watcher cleanup failed: ${safeParseError(err)}`);
          return resolve(ok());
        });
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  });
}
