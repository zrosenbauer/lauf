// oxlint-disable max-dependencies
import * as p from '@clack/prompts';
import { loadDescriptions } from '@laufen/engine';
import pc from 'picocolors';
import picomatch from 'picomatch';
import { z } from 'zod';

import type { LoadedConfig } from '../lib/config.ts';
import { loadAllLaufConfigs, safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { defineHandler } from '../lib/handler.ts';
import { LAUF_ROOT } from '../lib/paths.ts';
import { fail, ok } from '../lib/result.ts';
import { getWorkspaceState } from '../lib/workspace/index.ts';
import { discoverWorkspaceScripts } from '../lib/workspace/scripts.ts';
import type { DiscoveredScript } from '../lib/workspace/types.ts';
import { safeParseError } from '../utils/cli.ts';
import { buildScriptTree } from '../utils/tree.ts';

const listParams = z.object({
  flags: z.object({
    all: z.boolean().optional(),
    filter: z.string().optional(),
  }),
});

/**
 * Handler for the `lauf list` CLI command.
 *
 * Discovers lauf scripts and prints a hierarchical tree grouped by package.
 * Priority: --filter > --all > default (current package).
 */
export default defineHandler({
  parameters: listParams,
  handler: (ctx) => {
    if (ctx.flags.filter !== undefined) {
      return listFilteredScripts(ctx.flags.filter);
    }
    if (ctx.flags.all) {
      return listAllScripts();
    }
    return listCurrentPackageScripts();
  },
});

/**
 * List scripts from workspaces matching the given name glob (--filter flag).
 */
async function listFilteredScripts(filterGlob: string) {
  const wsState = getWorkspaceState(process.cwd());
  const configs = await loadAllLaufConfigs(process.cwd());
  const isMatch = picomatch(filterGlob);
  const scripts = configs.flatMap((loaded: LoadedConfig) => {
    const ws = wsState.tree.workspaces.find((w) => w.dir === loaded.configDir);
    if (!ws || !isMatch(ws.name)) {
      return [];
    }
    return Array.from(discoverWorkspaceScripts(ws, loaded.config.scripts, wsState.root));
  });

  return displayScripts(scripts);
}

/**
 * List scripts from the current workspace (default behavior).
 */
async function listCurrentPackageScripts() {
  const wsState = getWorkspaceState(process.cwd());

  if (!wsState.current) {
    return fail({
      message: 'Could not determine the current workspace.',
      hint: 'Run from inside a directory with a lauf.config.ts, or use --all to list all scripts.',
    });
  }

  const [configError, loaded] = await safeLoadLaufConfigWithMeta(process.cwd());
  if (configError) {
    return fail({ message: `Failed to load lauf config: ${safeParseError(configError)}` });
  }

  const scripts = discoverWorkspaceScripts(wsState.current, loaded.config.scripts, wsState.root);
  return displayScripts(scripts);
}

/**
 * List scripts from all workspaces within the root boundary (--all flag).
 */
async function listAllScripts() {
  const wsState = getWorkspaceState(process.cwd());
  const configs = await loadAllLaufConfigs(process.cwd());

  const allScripts = configs.flatMap((loaded: LoadedConfig) => {
    const ws = wsState.tree.workspaces.find((w) => w.dir === loaded.configDir);
    if (!ws) {
      return [];
    }
    return Array.from(discoverWorkspaceScripts(ws, loaded.config.scripts, wsState.root));
  });

  return displayScripts(allScripts);
}

/**
 * Shared display logic for discovered scripts.
 *
 * Renders a directory-tree-style hierarchy grouped by package,
 * including scripts from all packages (root and workspace members).
 */
async function displayScripts(scripts: readonly DiscoveredScript[]) {
  if (scripts.length === 0) {
    p.log.warn('No scripts found.');
    p.log.message(pc.dim('Create one with: lauf create <name>'));
    return ok();
  }

  const wsState = getWorkspaceState(process.cwd());
  const descriptions = await loadDescriptions(scripts, {
    workspaceRoot: wsState.root.dir,
    cliPackageRoot: LAUF_ROOT,
  });
  const tree = buildScriptTree(scripts, descriptions);

  p.note(tree, `Found ${scripts.length} script(s)`);

  return ok();
}
