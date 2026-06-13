// oxlint-disable max-dependencies
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { attempt, attemptAsync } from 'es-toolkit';
import * as path from 'pathe';
import { z } from 'zod';

import { bundleScripts } from './bundler.ts';
import { createLogger } from './context/logger.ts';
import { buildBaseEnv } from './env.ts';
import type { Logger, ScriptTarget } from './types.ts';
import { safeParseError } from './utils/cli.ts';
import { safeParseJSON } from './utils/json.ts';

const execFileAsync = promisify(execFile);

const ENGINE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EXTRACTOR_DIST_PATH = path.join(ENGINE_ROOT, 'dist', 'metadata-extractor.mjs');

/**
 * Resolve the metadata extractor path.
 *
 * Only returns the built dist version — the extractor is executed with
 * plain `node` which cannot run TypeScript files on all Node 22.x versions.
 * Run `pnpm build` to generate the dist file.
 */
function resolveExtractorPath(): string | undefined {
  const [distErr, distExists] = attempt(() => fs.existsSync(EXTRACTOR_DIST_PATH));
  if (!distErr && distExists) {
    return EXTRACTOR_DIST_PATH;
  }

  return undefined;
}

/**
 * Build the NODE_PATH array for the metadata extractor subprocess.
 */
function buildNodePaths(workspaceRoot: string, cliPackageRoot: string): readonly string[] {
  const base = [
    path.join(ENGINE_ROOT, 'node_modules'),
    path.join(cliPackageRoot, 'node_modules'),
    path.join(workspaceRoot, 'node_modules'),
  ];
  const existing = process.env.NODE_PATH;
  if (existing) {
    return [...base, existing];
  }
  return base;
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe('buildNodePaths', () => {
    it('includes engine, cli, and workspace node_modules', () => {
      const result = buildNodePaths('/workspace', '/cli-root');
      expect(result).toContain(path.join(ENGINE_ROOT, 'node_modules'));
      expect(result).toContain(path.join('/cli-root', 'node_modules'));
      expect(result).toContain(path.join('/workspace', 'node_modules'));
    });

    it('appends existing NODE_PATH when set', () => {
      const saved = process.env.NODE_PATH;
      process.env.NODE_PATH = '/custom/modules';
      const result = buildNodePaths('/workspace', '/cli-root');
      expect(result).toContain('/custom/modules');
      /* v8 ignore next 5 -- env-var restore; which branch runs depends on whether NODE_PATH was pre-set */
      if (saved === undefined) {
        delete process.env.NODE_PATH;
      } else {
        process.env.NODE_PATH = saved;
      }
    });

    it('returns only base paths when NODE_PATH is empty', () => {
      const saved = process.env.NODE_PATH;
      process.env.NODE_PATH = '';
      const result = buildNodePaths('/workspace', '/cli-root');
      expect(result).toHaveLength(3);
      /* v8 ignore next 5 -- env-var restore; which branch runs depends on whether NODE_PATH was pre-set */
      if (saved === undefined) {
        delete process.env.NODE_PATH;
      } else {
        process.env.NODE_PATH = saved;
      }
    });
  });
}

interface LoadDescriptionsOptions {
  readonly workspaceRoot: string;
  readonly cliPackageRoot: string;
  readonly logger?: Logger;
}

/**
 * Load descriptions for a set of scripts by bundling them with esbuild
 * and spawning a metadata extractor process.
 *
 * Returns a record of original script path → description string.
 * Fails gracefully — returns an empty record on any error so
 * the list command still works, just without descriptions.
 *
 * @param scripts - Scripts to extract descriptions from
 * @param options - Workspace root and CLI package root for NODE_PATH resolution
 * @returns Record mapping script paths to description strings
 */
// oxlint-disable-next-line max-lines-per-function
export async function loadDescriptions(
  scripts: readonly ScriptTarget[],
  options: LoadDescriptionsOptions,
): Promise<Record<string, string>> {
  if (scripts.length === 0) {
    return {};
  }

  const log = options.logger ?? createLogger();

  const scriptPaths = scripts.map((s) => s.path);
  const [bundleError, bundleResult] = await bundleScripts(scriptPaths);
  if (bundleError) {
    log.warn(`Script descriptions unavailable: ${safeParseError(bundleError)}`);
    return {};
  }

  const extractorPath = resolveExtractorPath();
  if (!extractorPath) {
    bundleResult.cleanup();
    log.warn(
      'Script descriptions unavailable: metadata extractor not found. Run `pnpm build` to generate it.',
    );
    return {};
  }

  const nodePaths = buildNodePaths(options.workspaceRoot, options.cliPackageRoot);

  // Build the bundled paths list and a reverse mapping for path restoration.
  // Only include scripts that have a bundled output — passing raw .ts paths
  // to the extractor would fail since it expects pre-bundled .mjs files.
  const bundledEntries = scripts
    .map((s) => {
      const bundled = bundleResult.outputs.get(s.path);
      if (bundled) {
        return [bundled, s.path] as const;
      }
      return null;
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);

  const bundledPaths = bundledEntries.map(([bundled]) => bundled);
  const reverseMap: Record<string, string> = Object.fromEntries(bundledEntries);

  const [error, result] = await attemptAsync(() =>
    execFileAsync('node', [extractorPath], {
      env: {
        ...buildBaseEnv(true),
        NODE_PATH: nodePaths.join(path.delimiter),
        LAUF_SCRIPT_PATHS: JSON.stringify(bundledPaths),
        LAUF_WORKSPACE_ROOT: options.workspaceRoot,
      },
      timeout: 15_000,
    }),
  );

  bundleResult.cleanup();

  // es-toolkit's attemptAsync types require the null check for TS narrowing
  if (error || result === null) {
    log.warn('Description extraction timed out or failed. Listing scripts without descriptions.');
    return {};
  }

  const [parseError, parsed] = safeParseJSON(
    String(result.stdout),
    z.record(z.string(), z.string()),
  );
  if (parseError) {
    log.warn('Description extraction failed: could not parse metadata output.');
    return {};
  }

  // Map bundled paths back to original paths, filtering out entries
  // that don't correspond to known bundled scripts to avoid leaking temp paths.
  const descriptions: Record<string, string> = Object.fromEntries(
    Object.entries(parsed)
      .filter(([bundledPath]) => bundledPath in reverseMap)
      .map(([bundledPath, desc]) => [reverseMap[bundledPath], desc] as const),
  );

  if (Object.keys(descriptions).length === 0 && scripts.length > 0) {
    log.warn('Description extraction returned no results. Descriptions may be unavailable.');
  }

  return descriptions;
}
