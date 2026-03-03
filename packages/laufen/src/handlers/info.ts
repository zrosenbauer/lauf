import type { EnvContext } from '@laufen/engine';
import { resolveEnvValue, runScript } from '@laufen/engine';

import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
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

  const workspaceRoot = getWorkspaceRoot();

  // Build EnvContext for config-level env resolution
  const envCtx: EnvContext = {
    script: {
      name: script.name,
      path: script.path,
      packageDir: script.packageDir,
    },
    workspace: workspaceRoot,
  };

  const [envError, configEnv] = await resolveEnvValue(loaded.config.env, envCtx);
  if (envError) {
    return fail({ message: `Failed to resolve config env: ${safeParseError(envError)}` });
  }

  const result = await runScript(
    script,
    {},
    {
      help: true,
      workspaceRoot,
      cliPackageRoot: LAUF_ROOT,
      spinner: loaded.config.spinner,
      env: configEnv,
      sandbox: loaded.config.sandbox,
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
