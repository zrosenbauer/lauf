import { runScript } from '@laufen/engine';

import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { loadEnvFiles, mergeEnvSources } from '../lib/env.ts';
import { defineHandler } from '../lib/handler.ts';
import { LAUF_ROOT, getWorkspaceRoot } from '../lib/paths.ts';
import { fail, ok } from '../lib/result.ts';
import { safeParseError } from '../utils/cli.ts';
import { resolveScript } from '../utils/resolve-script.ts';

/**
 * Handler for the `lauf help [script]` CLI command.
 *
 * Loads config, resolves the target script (prompting if omitted),
 * then spawns the executor with LAUF_HELP=1 to display script help.
 */
export default defineHandler(async (ctx: { parameters: { script?: string } }) => {
  const [configError, loaded] = await safeLoadLaufConfigWithMeta(process.cwd());
  if (configError) {
    return fail({ message: `Failed to load lauf config: ${safeParseError(configError)}` });
  }

  const [scriptError, script] = await resolveScript(ctx.parameters.script, loaded.config.scripts);
  if (scriptError) {
    return fail(scriptError);
  }

  const envFileVars = loadEnvFiles(loaded.config.envFile, loaded.configDir);
  const mergedEnv = mergeEnvSources(envFileVars, loaded.config.env, {});

  const result = await runScript(
    script,
    {},
    {
      help: true,
      workspaceRoot: getWorkspaceRoot(),
      cliPackageRoot: LAUF_ROOT,
      spinner: loaded.config.spinner,
      env: mergedEnv,
      envMode: loaded.config.envMode,
    },
  );

  if (result.exitCode === 0) {
    return ok();
  }

  return fail({
    message: `Help failed for ${script.name}`,
    exitCode: result.exitCode,
  });
});
