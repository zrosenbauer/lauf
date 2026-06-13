import { command } from '@kidd-cli/core';
import { loadDescriptions } from '@laufen/engine';
import picomatch from 'picomatch';
import { z } from 'zod';

import type { LoadedConfig } from '../lib/config.ts';
import { loadAllLaufConfigs, safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { LAUF_ROOT } from '../lib/paths.ts';
import { getWorkspaceState } from '../lib/workspace/index.ts';
import { discoverWorkspaceScripts } from '../lib/workspace/scripts.ts';
import type { DiscoveredScript } from '../lib/workspace/types.ts';
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
    const wsState = getWorkspaceState(process.cwd());
    const scripts = await collectScripts(ctx.args.all, ctx.args.filter, wsState);

    if (scripts.length === 0) {
      ctx.log.warn('No scripts found.');
      ctx.log.message(ctx.colors.dim('Create one with: lauf create <name>'));
      return;
    }

    const descriptions = await loadDescriptions(scripts, {
      workspaceRoot: wsState.root.dir,
      cliPackageRoot: LAUF_ROOT,
    });
    const tree = buildScriptTree(scripts, descriptions);
    ctx.log.note(tree, `Found ${scripts.length} script(s)`);
  },
});

async function collectScripts(
  all: boolean,
  filter: string | undefined,
  wsState: ReturnType<typeof getWorkspaceState>,
): Promise<readonly DiscoveredScript[]> {
  if (filter !== undefined) {
    const configs = await loadAllLaufConfigs(process.cwd());
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
    const configs = await loadAllLaufConfigs(process.cwd());
    return configs.flatMap((loaded: LoadedConfig) => {
      const ws = wsState.tree.workspaces.find((w) => w.dir === loaded.configDir);
      if (!ws) {
        return [];
      }
      return Array.from(discoverWorkspaceScripts(ws, loaded.config.scripts, wsState.root));
    });
  }

  // Default: current workspace
  if (!wsState.current) {
    return [];
  }

  const [configError, loaded] = await safeLoadLaufConfigWithMeta(process.cwd());
  if (configError) {
    return [];
  }

  return discoverWorkspaceScripts(wsState.current, loaded.config.scripts, wsState.root);
}
