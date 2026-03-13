// oxlint-disable import/max-dependencies
import * as p from '@clack/prompts';
import type { EnvContext, RunResult, ScriptConfig, ScriptTarget } from '@laufen/engine';
import { resolveEnvValue, runScript } from '@laufen/engine';
import pc from 'picocolors';
import { z } from 'zod';

import type { ResolvedLaufConfig } from '../lib/config.ts';
import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { defineHandler } from '../lib/handler.ts';
import { LAUF_ROOT, getWorkspaceRoot } from '../lib/paths.ts';
import type { HandlerResult, Result } from '../lib/result.ts';
import { fail, ok } from '../lib/result.ts';
import { consumeScriptHelpRequested } from '../state/script-help.ts';
import { extractEnvFlags, parseRawArgs, sliceArgvAfter } from '../utils/argv.ts';
import { safeParseError } from '../utils/cli.ts';
import { resolveScript } from '../utils/resolve-script.ts';

const runParams = z.object({
  parameters: z.object({ script: z.string().min(1).optional() }),
});

export default defineHandler({
  parameters: runParams,
  handler: async (ctx) => {
    const [configError, loaded] = await safeLoadLaufConfigWithMeta(process.cwd());
    if (configError) {
      return fail({ message: `Failed to load lauf config: ${safeParseError(configError)}` });
    }

    const [scriptError, script] = await resolveScript(ctx.parameters.script, loaded.config.scripts);
    if (scriptError) {
      return fail(scriptError);
    }

    const rawArgv = resolveRawArgv(ctx.parameters.script);
    const { env: cliEnv, remaining: cleanArgv } = extractEnvFlags(rawArgv);
    const isHelp =
      consumeScriptHelpRequested() || cleanArgv.includes('--help') || cleanArgv.includes('-h');
    const workspaceRoot = getWorkspaceRoot();

    const [envError, configEnv] = await resolveConfigEnv(loaded.config.env, script, workspaceRoot);
    if (envError) {
      return fail({ message: `Failed to resolve config env: ${safeParseError(envError)}` });
    }

    if (isHelp) {
      return runHelpMode(
        script,
        workspaceRoot,
        loaded.config.spinner,
        configEnv,
        cliEnv,
        loaded.config.sandbox,
        loaded.config.packages,
      );
    }

    return runNormalMode(
      script,
      parseRawArgs(cleanArgv),
      workspaceRoot,
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
  config: ResolvedLaufConfig,
  configEnv: Record<string, string>,
  cliEnv: Record<string, string>,
): Promise<HandlerResult> {
  const result = await executeScript(
    script,
    args,
    workspaceRoot,
    config.spinner,
    configEnv,
    cliEnv,
    config.sandbox,
    config.packages,
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
  spinner: boolean,
  env: Record<string, string>,
  cliEnv: Record<string, string>,
  sandbox: boolean,
  workspacePackages: Record<string, string>,
): Promise<RunResult> {
  const label = pc.cyan(script.name);

  p.log.step(`Running ${label}`);
  const result = await runScript(script, args, {
    workspaceRoot,
    cliPackageRoot: LAUF_ROOT,
    spinner,
    env,
    cliEnv,
    sandbox,
    workspacePackages,
  });
  if (result.exitCode === 0) {
    p.log.success(`${label} completed successfully`);
  }
  return result;
}
