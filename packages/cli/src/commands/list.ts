import { command } from '@kidd-cli/core';
import type { ConfigLoader, LoadedConfig } from '@laufen/config';
import { createConfigLoader } from '@laufen/config';
import type { CachedWorkspaceState, DiscoveredScript } from '@laufen/config/workspace';
import { discoverWorkspaceScripts } from '@laufen/config/workspace';
import { loadDescriptions } from '@laufen/engine';
import { isErr } from 'massaman/control';
import picomatch from 'picomatch';
import { z } from 'zod';

import { LAUF_ROOT } from '../lib/paths.ts';
import { buildScriptTree } from '../utils/tree.ts';

const options = z.object({
  all: z.boolean().default(false).describe('Discover scripts from all nested configs'),
  filter: z.string().optional().describe('Filter packages by name glob (e.g. "@apps/*")'),
});

/**
 * `lauf list` — list discovered lauf scripts.
 *
 * Priority: `--filter` > `--all` > default (current package only).
 */
export default command({
  description: 'List all available scripts',
  options,
  handler: async (ctx) => {
    const configLoader = createConfigLoader();
    const scripts = await collectScripts(
      configLoader,
      ctx.args.all,
      ctx.args.filter,
      ctx.workspace,
    );

    if (scripts.length === 0) {
      ctx.log.warn('No scripts found.');
      ctx.log.message(ctx.colors.dim('Create one with: lauf create <name>'));
      return;
    }

    const descriptions = await loadDescriptions(scripts, {
      workspaceRoot: ctx.workspace.root.dir,
      cliPackageRoot: LAUF_ROOT,
    });
    const tree = buildScriptTree(scripts, descriptions);
    ctx.log.note(tree, `Found ${scripts.length} script(s)`);
  },
});

async function collectScripts(
  configLoader: ConfigLoader,
  all: boolean,
  filter: string | undefined,
  wsState: CachedWorkspaceState,
): Promise<readonly DiscoveredScript[]> {
  if (filter !== undefined) {
    const configs = await configLoader.loadAll();
    const isMatch = picomatch(filter);
    return configs.flatMap((loaded: LoadedConfig) => {
      const ws = wsState.tree.workspaces.find((w) => w.dir === loaded.configDir);
      if (!ws || !isMatch(ws.name)) {
        return [];
      }
      return Array.from(discoverWorkspaceScripts(ws, loaded.config.scripts, wsState.root));
    });
  }

  if (all) {
    const configs = await configLoader.loadAll();
    return configs.flatMap((loaded: LoadedConfig) => {
      const ws = wsState.tree.workspaces.find((w) => w.dir === loaded.configDir);
      if (!ws) {
        return [];
      }
      return Array.from(discoverWorkspaceScripts(ws, loaded.config.scripts, wsState.root));
    });
  }

  if (!wsState.current) {
    return [];
  }

  const loaded = await configLoader.safeLoadWithMeta();
  if (isErr(loaded)) {
    return [];
  }

  return discoverWorkspaceScripts(wsState.current, loaded.value.config.scripts, wsState.root);
}
