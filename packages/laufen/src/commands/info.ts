import type { CommandContext } from '@kidd-cli/core';
import { command } from '@kidd-cli/core';
import type { EnvContext, RunScriptOptions } from '@laufen/engine';
import { resolveEnvValue, runScript } from '@laufen/engine';
import { z } from 'zod';

import { loadAllLaufConfigs, safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { LAUF_ROOT } from '../lib/paths.ts';
import { assertOk } from '../lib/result.ts';
import { getWorkspaceState } from '../lib/workspace/index.ts';
import { discoverAllScripts, findScript } from '../lib/workspace/scripts.ts';
import type { DiscoveredScript, Workspace } from '../lib/workspace/types.ts';

const positionals = z.object({
  script: z.string().optional().describe('Script name to show help for'),
});

/**
 * `lauf info [script]` — show the script's help (args, description).
 *
 * Resolves the target script (prompting interactively when omitted), then
 * spawns the executor with `LAUF_HELP=1`.
 */
export default command({
  description: 'Show info for a script',
  positionals,
  handler: async (ctx) => {
    const configResult = await safeLoadLaufConfigWithMeta(process.cwd());
    assertOk(configResult, ctx.fail, 'Failed to load lauf config');
    const loaded = configResult[1];

    const script = await resolveTarget(ctx, ctx.args.script);

    const workspaceRoot = getWorkspaceState(process.cwd()).root.dir;
    const envCtx: EnvContext = {
      script: { name: script.name, path: script.path, packageDir: script.packageDir },
      workspace: workspaceRoot,
    };

    const envResult = await resolveEnvValue(loaded.config.env, envCtx);
    assertOk(envResult, ctx.fail, 'Failed to resolve config env');
    const configEnv = envResult[1];

    const options: RunScriptOptions = {
      help: true,
      workspaceRoot,
      cliPackageRoot: LAUF_ROOT,
      spinner: loaded.config.spinner,
      env: configEnv,
      sandbox: loaded.config.sandbox,
      workspacePackages: loaded.config.packages,
    };

    const result = await runScript(script, {}, options);
    if (result.exitCode !== 0) {
      ctx.fail(`Help failed for ${script.name}`, { exitCode: result.exitCode });
    }
  },
});

async function resolveTarget(
  ctx: CommandContext,
  scriptName: string | undefined,
): Promise<DiscoveredScript> {
  const wsState = getWorkspaceState(process.cwd());
  const configs = await loadAllLaufConfigs(process.cwd());

  const workspacePairs: (readonly [Workspace, readonly string[]])[] = wsState.tree.workspaces.map(
    (ws) => {
      const loaded = configs.find((c) => c.configDir === ws.dir);
      const patterns = resolveScriptPatterns(loaded);
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

  const scripts = discoverAllScripts(workspacePairs, wsState.root);
  if (scripts.length === 0) {
    ctx.fail('No scripts found', { code: 'NO_SCRIPTS' });
  }

  return ctx.prompts.select({
    message: 'Select a script',
    options: scripts.map((s) => ({ value: s, label: s.name })),
  });
}

function resolveScriptPatterns(
  loaded: { config: { scripts: readonly string[] } } | undefined,
): readonly string[] {
  if (loaded) {
    return loaded.config.scripts;
  }
  return ['scripts/*.ts'];
}
