// oxlint-disable import/max-dependencies
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { z } from 'zod';

import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { defineHandler } from '../lib/handler.ts';
import { fail, ok } from '../lib/result.ts';
import type { DiscoveredScript, RunResult } from '../lib/types.ts';
import { runScript } from '../runtime/runner.ts';
import { parseRawArgs, sliceArgvAfter } from '../utils/argv.ts';
import { safeParseError } from '../utils/cli.ts';
import { resolveScript } from '../utils/resolve-script.ts';

const runParams = z.object({
  parameters: z.object({ script: z.string().min(1).optional() }),
});

/**
 * Handler for the `lauf run [script]` CLI command.
 *
 * Resolves the script by qualified name (or prompts for selection),
 * parses any trailing CLI flags into arguments, and spawns the script executor.
 */
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
    const isHelp = rawArgv.includes('--help') || rawArgv.includes('-h');

    if (isHelp) {
      const helpResult = await runScript(script, {}, { help: true, configDir: loaded.configDir });
      /* v8 ignore start -- help via runScript delegates to executor which handles its own errors */
      if (helpResult.exitCode === 0) {
        return ok();
      }
      return fail({ message: `Help failed for ${script.name}`, exitCode: helpResult.exitCode });
    }
    /* v8 ignore stop */

    const args = parseRawArgs(rawArgv);
    const result = await executeScript(script, args, loaded.configDir);

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
 * Run a script, logging start and result messages.
 *
 * The handler no longer wraps execution in a spinner because
 * the child process may prompt for missing arguments, and the
 * spinner animation conflicts with interactive prompts.
 * Scripts can use `ctx.spinner` for progress indication during
 * their own execution after all prompts are resolved.
 */
async function executeScript(
  script: DiscoveredScript,
  args: Record<string, unknown>,
  configDir: string,
): Promise<RunResult> {
  const label = pc.cyan(script.name);

  p.log.step(`Running ${label}`);
  const result = await runScript(script, args, { configDir });
  if (result.exitCode === 0) {
    p.log.success(`${label} completed successfully`);
  }
  return result;
}
