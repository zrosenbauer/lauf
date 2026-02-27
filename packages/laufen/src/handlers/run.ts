// oxlint-disable import/max-dependencies
import * as p from '@clack/prompts';
import type { RunResult, ScriptTarget } from '@laufen/engine';
import { runScript } from '@laufen/engine';
import pc from 'picocolors';
import { z } from 'zod';

import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { loadEnvFiles, mergeEnvSources } from '../lib/env.ts';
import { defineHandler } from '../lib/handler.ts';
import { LAUF_ROOT, getWorkspaceRoot } from '../lib/paths.ts';
import type { HandlerResult } from '../lib/result.ts';
import { fail, ok } from '../lib/result.ts';
import { extractEnvFlags, parseRawArgs, sliceArgvAfter } from '../utils/argv.ts';
import { safeParseError } from '../utils/cli.ts';
import { resolveScript } from '../utils/resolve-script.ts';

const runParams = z.object({
  parameters: z.object({ script: z.string().min(1).optional() }),
});

/**
 * Build the merged env record from env files, config-level env, and CLI --env flags.
 */
function buildMergedEnv(
  loaded: {
    readonly config: { readonly envFile: string | string[]; readonly env: Record<string, string> };
    readonly configDir: string;
  },
  cliEnv: Record<string, string>,
): Record<string, string> {
  const envFileVars = loadEnvFiles(loaded.config.envFile, loaded.configDir);
  return mergeEnvSources(envFileVars, loaded.config.env, cliEnv);
}

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
    const isHelp = cleanArgv.includes('--help') || cleanArgv.includes('-h');
    const workspaceRoot = getWorkspaceRoot();
    const mergedEnv = buildMergedEnv(loaded, cliEnv);

    if (isHelp) {
      return runHelpMode(
        script,
        workspaceRoot,
        loaded.config.spinner,
        mergedEnv,
        loaded.config.envMode,
      );
    }

    const args = parseRawArgs(cleanArgv);
    const result = await executeScript(
      script,
      args,
      workspaceRoot,
      loaded.config.spinner,
      mergedEnv,
      loaded.config.envMode,
    );

    if (result.exitCode === 0) {
      return ok();
    }

    return fail({
      message: `${pc.cyan(script.name)} exited with code ${result.exitCode}`,
      exitCode: result.exitCode,
    });
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
 * Run the script in help mode, displaying its argument schema.
 */
/* v8 ignore start -- help via runScript delegates to executor which handles its own errors */
async function runHelpMode(
  script: ScriptTarget,
  workspaceRoot: string,
  spinner: boolean,
  env: Record<string, string>,
  envMode: 'isolate' | 'inherit',
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
      envMode,
    },
  );
  if (helpResult.exitCode === 0) {
    return ok();
  }
  return fail({ message: `Help failed for ${script.name}`, exitCode: helpResult.exitCode });
}
/* v8 ignore stop */

/**
 * Run a script, logging start and result messages.
 *
 * The handler no longer wraps execution in a spinner because
 * the child process may prompt for missing arguments, and the
 * spinner animation conflicts with interactive prompts.
 * Scripts can use `ctx.spinner` for progress indication during
 * their own execution after all prompts are resolved.
 */
async function executeScript(
  script: ScriptTarget,
  args: Record<string, unknown>,
  workspaceRoot: string,
  spinner: boolean,
  env: Record<string, string>,
  envMode: 'isolate' | 'inherit',
): Promise<RunResult> {
  const label = pc.cyan(script.name);

  p.log.step(`Running ${label}`);
  const result = await runScript(script, args, {
    workspaceRoot,
    cliPackageRoot: LAUF_ROOT,
    spinner,
    env,
    envMode,
  });
  if (result.exitCode === 0) {
    p.log.success(`${label} completed successfully`);
  }
  return result;
}
