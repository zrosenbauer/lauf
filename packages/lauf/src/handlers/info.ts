import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { defineHandler } from '../lib/handler.ts';
import { fail, ok } from '../lib/result.ts';
import { runScript } from '../runtime/runner.ts';
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

  const result = await runScript(script, {}, { help: true, configDir: loaded.configDir });

  if (result.exitCode === 0) {
    return ok();
  }

  return fail({
    message: `Help failed for ${script.name}`,
    exitCode: result.exitCode,
  });
});
