import type { EnvContext, RunScriptOptions } from '@laufen/engine';
import { resolveEnvValue, runScript } from '@laufen/engine';

import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { defineHandler } from '../lib/handler.ts';
import { LAUF_ROOT } from '../lib/paths.ts';
import type { HandlerResult } from '../lib/result.ts';
import { fail, ok } from '../lib/result.ts';
import { getWorkspaceState } from '../lib/workspace/index.ts';
import type { DiscoveredScript } from '../lib/workspace/types.ts';
import { safeParseError } from '../utils/cli.ts';
import { resolveScript } from '../utils/resolve-script.ts';

/**
 * Build run options for help mode.
 */
function buildHelpOptions(
  workspaceRoot: string,
  spinner: boolean,
  sandbox: boolean,
  configEnv: Record<string, string>,
  workspacePackages: Record<string, string>,
): RunScriptOptions {
  return {
    help: true,
    workspaceRoot,
    cliPackageRoot: LAUF_ROOT,
    spinner,
    env: configEnv,
    sandbox,
    workspacePackages,
  };
}

/**
 * Run a script in help mode.
 */
async function runHelpMode(
  script: DiscoveredScript,
  options: RunScriptOptions,
): Promise<HandlerResult> {
  const result = await runScript(script, {}, options);
  if (result.exitCode === 0) {
    return ok();
  }
  return fail({
    message: `Help failed for ${script.name}`,
    exitCode: result.exitCode,
  });
}

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

  const workspaceRoot = getWorkspaceState(process.cwd()).root.dir;
  const envCtx: EnvContext = {
    script: { name: script.name, path: script.path, packageDir: script.packageDir },
    workspace: workspaceRoot,
  };

  const [envError, configEnv] = await resolveEnvValue(loaded.config.env, envCtx);
  if (envError) {
    return fail({ message: `Failed to resolve config env: ${safeParseError(envError)}` });
  }

  const options = buildHelpOptions(
    workspaceRoot,
    loaded.config.spinner,
    loaded.config.sandbox,
    configEnv,
    loaded.config.packages,
  );
  return runHelpMode(script, options);
});
