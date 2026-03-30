// oxlint-disable max-dependencies
import * as p from '@clack/prompts';
import { loadDescriptions } from '@laufen/engine';
import { uniqBy } from 'es-toolkit';
import pc from 'picocolors';
import { z } from 'zod';

import type { LoadedConfig } from '../lib/config.ts';
import { loadAllLaufConfigs, safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { discoverScripts, reattributeScripts } from '../lib/discovery.ts';
import { defineHandler } from '../lib/handler.ts';
import { LAUF_ROOT, getWorkspaceRoot, resolveCurrentPackage } from '../lib/paths.ts';
import { fail, ok } from '../lib/result.ts';
import type { DiscoveredScript } from '../lib/types.ts';
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
 * List scripts from packages matching the given name glob (--filter flag).
 */
async function listFilteredScripts(filterGlob: string) {
  const [configError, loaded] = await safeLoadLaufConfigWithMeta(process.cwd());
  if (configError) {
    return fail({ message: `Failed to load lauf config: ${safeParseError(configError)}` });
  }

  const scripts = discoverScripts(loaded.config.scripts, { filterGlobs: [filterGlob] });
  return displayScripts(reattributeScripts(scripts));
}

/**
 * List scripts from the current package (default behavior).
 */
async function listCurrentPackageScripts() {
  const [configError, loaded] = await safeLoadLaufConfigWithMeta(process.cwd());
  if (configError) {
    return fail({ message: `Failed to load lauf config: ${safeParseError(configError)}` });
  }

  const currentPkg = resolveCurrentPackage(process.cwd());
  if (!currentPkg) {
    return fail({
      message: 'Could not determine the current package.',
      hint: 'Run from inside a workspace package, or use --all to list all scripts.',
    });
  }

  const scripts = reattributeScripts(
    discoverScripts(loaded.config.scripts, { packageDir: currentPkg.dir }),
  );
  const currentOnly = scripts.filter((s) => s.packageName === currentPkg.name);
  return displayScripts(currentOnly);
}

/**
 * List scripts from all configs within the search boundary (--all flag).
 */
async function listAllScripts() {
  const configs = await loadAllLaufConfigs(process.cwd());

  const allScripts = configs.flatMap((loaded: LoadedConfig) =>
    discoverScripts(loaded.config.scripts, { scopeDir: loaded.configDir }),
  );

  // Deduplicate by script path (closest config wins since configs are sorted shallowest-first)
  const unique = uniqBy(allScripts, (s) => s.path);

  return displayScripts(reattributeScripts(unique));
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

  const workspaceRoot = getWorkspaceRoot();
  const descriptions = await loadDescriptions(scripts, {
    workspaceRoot,
    cliPackageRoot: LAUF_ROOT,
  });
  const tree = buildScriptTree(scripts, descriptions);

  p.note(tree, `Found ${scripts.length} script(s)`);

  return ok();
}
