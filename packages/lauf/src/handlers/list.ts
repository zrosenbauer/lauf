/* eslint-disable import/max-dependencies */
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';

import * as p from '@clack/prompts';
import { attempt, attemptAsync, uniqBy } from 'es-toolkit';
import pc from 'picocolors';
import { z } from 'zod';

import type { LoadedConfig } from '../lib/config.ts';
import { loadAllLaufConfigs, safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { discoverScripts } from '../lib/discovery.ts';
import { defineHandler } from '../lib/handler.ts';
import { LAUF_ROOT, getWorkspaceRoot, resolveTsx } from '../lib/paths.ts';
import { fail, ok } from '../lib/result.ts';
import type { DiscoveredScript } from '../lib/types.ts';
import { safeParseError } from '../utils/cli.ts';
import { safeParseJSON } from '../utils/json.ts';
import { buildScriptTree } from '../utils/tree.ts';

const execFileAsync = promisify(execFile);
const METADATA_DIST_PATH = path.join(LAUF_ROOT, 'dist', 'runtime', 'metadata.mjs');
const METADATA_SRC_PATH = path.join(LAUF_ROOT, 'src', 'runtime', 'metadata.ts');

const listParams = z.object({
  flags: z.object({ all: z.boolean().optional() }),
});

/**
 * Handler for the `lauf list` CLI command.
 *
 * Discovers all lauf scripts across the monorepo and prints
 * a hierarchical tree grouped by package, with descriptions
 * extracted by importing each script via tsx.
 */
export default defineHandler({
  parameters: listParams,
  handler: (ctx) => {
    if (ctx.flags.all) {
      return listAllScripts();
    }
    return listScopedScripts();
  },
});

/**
 * List scripts from the closest config (default behavior).
 */
async function listScopedScripts() {
  const [configError, loaded] = await safeLoadLaufConfigWithMeta(process.cwd());
  if (configError) {
    return fail({ message: `Failed to load lauf config: ${safeParseError(configError)}` });
  }

  const scripts = discoverScripts(loaded.config.scripts);
  return displayScripts(scripts);
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

  return displayScripts(unique);
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

  const descriptions = await loadDescriptions(scripts);
  const tree = buildScriptTree(scripts, descriptions);

  p.note(tree, `Found ${scripts.length} script(s)`);

  return ok();
}

/**
 * Resolve the metadata extractor path, preferring the built dist version
 * and falling back to the source .ts path if dist is unavailable.
 *
 * Returns undefined if neither exists.
 */
function resolveMetadataPath(): string | undefined {
  const [distErr, distExists] = attempt(() => fs.existsSync(METADATA_DIST_PATH));
  if (!distErr && distExists) {
    return METADATA_DIST_PATH;
  }

  const [srcErr, srcExists] = attempt(() => fs.existsSync(METADATA_SRC_PATH));
  if (!srcErr && srcExists) {
    return METADATA_SRC_PATH;
  }

  return undefined;
}

/**
 * Build the NODE_PATH array for the metadata extractor subprocess.
 *
 * Includes the lauf and workspace node_modules directories,
 * plus the existing NODE_PATH if set.
 */
function buildNodePaths(workspaceRoot: string): readonly string[] {
  const base = [path.join(LAUF_ROOT, 'node_modules'), path.join(workspaceRoot, 'node_modules')];
  const existing = process.env.NODE_PATH;
  if (existing) {
    return [...base, existing];
  }
  /* v8 ignore next 2 -- trivial else branch; NODE_PATH is almost always set in test env */
  return base;
}

/**
 * Build a minimal environment for the metadata extractor subprocess.
 *
 * Only exposes PATH, HOME, TERM, NODE_PATH, and any LAUF_* variables
 * to avoid leaking secrets from the parent environment.
 */
function buildMinimalEnv(): Record<string, string | undefined> {
  const laufEntries = Object.entries(process.env).filter(([key]) => key.startsWith('LAUF_'));
  const base: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TERM: process.env.TERM,
    NODE_PATH: process.env.NODE_PATH,
  };
  return Object.assign(base, Object.fromEntries(laufEntries));
}

/**
 * Spawn the metadata extractor via tsx to import all scripts
 * and return their descriptions as a path → description record.
 *
 * Fails gracefully — returns an empty record on any error so
 * the list command still works, just without descriptions.
 */
// oxlint-disable-next-line max-lines-per-function
async function loadDescriptions(
  scripts: readonly DiscoveredScript[],
): Promise<Record<string, string>> {
  /* v8 ignore next 3 -- defensive guard; handler already returns early when scripts is empty */
  if (scripts.length === 0) {
    return {};
  }

  const metadataPath = resolveMetadataPath();
  if (!metadataPath) {
    p.log.warn(
      'Script descriptions unavailable: metadata extractor not found. Run `pnpm build` to generate it.',
    );
    return {};
  }

  const [tsxError, tsxPath] = resolveTsx();
  if (tsxError) {
    p.log.warn(`Script descriptions unavailable: ${tsxError.message}`);
    return {};
  }

  // TypeScript doesn't narrow tuple index [1] after checking [0]; safe cast after guard above
  const resolvedTsxPath = tsxPath as string;

  const workspaceRoot = getWorkspaceRoot();
  const nodePaths = buildNodePaths(workspaceRoot);

  const [error, result] = await attemptAsync(() =>
    execFileAsync(resolvedTsxPath, [metadataPath], {
      env: {
        ...buildMinimalEnv(),
        NODE_PATH: nodePaths.join(path.delimiter),
        LAUF_SCRIPT_PATHS: JSON.stringify(scripts.map((s) => s.path)),
        LAUF_WORKSPACE_ROOT: workspaceRoot,
      },
      timeout: 15_000,
    }),
  );

  // es-toolkit's attemptAsync types require the null check for TS narrowing
  if (error || result === null) {
    p.log.warn('Description extraction timed out or failed. Listing scripts without descriptions.');
    return {};
  }

  const [parseError, parsed] = safeParseJSON(String(result.stdout));
  if (parseError || parsed === null || typeof parsed !== 'object') {
    p.log.warn('Description extraction failed: could not parse metadata output.');
    return {};
  }

  const descriptions = parsed as Record<string, string>;

  if (Object.keys(descriptions).length === 0 && scripts.length > 0) {
    p.log.warn('Description extraction returned no results. Descriptions may be unavailable.');
  }

  return descriptions;
}
