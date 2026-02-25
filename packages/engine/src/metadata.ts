// oxlint-disable max-dependencies
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import * as p from '@clack/prompts';
import { attempt, attemptAsync } from 'es-toolkit';

import { bundleScripts } from './bundler.ts';
import type { ScriptTarget } from './types.ts';
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
      if (saved === undefined) {
        delete process.env.NODE_PATH;
      } else {
        process.env.NODE_PATH = saved;
      }
    });

    it('returns only base paths when NODE_PATH is unset', () => {
      const saved = process.env.NODE_PATH;
      process.env.NODE_PATH = '';
      const result = buildNodePaths('/workspace', '/cli-root');
      expect(result).toHaveLength(3);
      if (saved === undefined) {
        delete process.env.NODE_PATH;
      } else {
        process.env.NODE_PATH = saved;
      }
    });
  });

  describe('buildMinimalEnv', () => {
    it('includes PATH, HOME, and TERM from process.env', () => {
      const env = buildMinimalEnv();
      expect(env.PATH).toBe(process.env.PATH);
      expect(env.HOME).toBe(process.env.HOME);
      expect(env.TERM).toBe(process.env.TERM);
    });

    it('includes LAUF_ prefixed variables', () => {
      const saved = process.env.LAUF_TEST_VAR;
      process.env.LAUF_TEST_VAR = 'test-value';
      const env = buildMinimalEnv();
      expect(env.LAUF_TEST_VAR).toBe('test-value');
      if (saved === undefined) {
        delete process.env.LAUF_TEST_VAR;
      } else {
        process.env.LAUF_TEST_VAR = saved;
      }
    });

    it('does not include arbitrary env variables', () => {
      const saved = process.env.SOME_SECRET;
      process.env.SOME_SECRET = 'secret';
      const env = buildMinimalEnv();
      expect(env.SOME_SECRET).toBeUndefined();
      if (saved === undefined) {
        delete process.env.SOME_SECRET;
      } else {
        process.env.SOME_SECRET = saved;
      }
    });
  });
}

interface LoadDescriptionsOptions {
  readonly workspaceRoot: string;
  readonly cliPackageRoot: string;
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

  const scriptPaths = scripts.map((s) => s.path);
  const [bundleError, bundleResult] = await bundleScripts(scriptPaths);
  if (bundleError) {
    p.log.warn(`Script descriptions unavailable: ${safeParseError(bundleError)}`);
    return {};
  }

  const extractorPath = resolveExtractorPath();
  if (!extractorPath) {
    bundleResult.cleanup();
    p.log.warn(
      'Script descriptions unavailable: metadata extractor not found. Run `pnpm build` to generate it.',
    );
    return {};
  }

  const nodePaths = buildNodePaths(options.workspaceRoot, options.cliPackageRoot);

  // Build the bundled paths list and a reverse mapping for path restoration
  const bundledPaths = scripts.map((s) => bundleResult.outputs.get(s.path) || s.path);
  const reverseMap: Record<string, string> = {};
  scripts.forEach((s) => {
    const bundled = bundleResult.outputs.get(s.path);
    if (bundled) {
      // oxlint-disable-next-line immutable-data -- building reverse map
      reverseMap[bundled] = s.path;
    }
  });

  const [error, result] = await attemptAsync(() =>
    execFileAsync('node', [extractorPath], {
      env: {
        ...buildMinimalEnv(),
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
    p.log.warn('Description extraction timed out or failed. Listing scripts without descriptions.');
    return {};
  }

  const [parseError, parsed] = safeParseJSON(String(result.stdout));
  if (parseError || parsed === null || typeof parsed !== 'object') {
    p.log.warn('Description extraction failed: could not parse metadata output.');
    return {};
  }

  const rawDescriptions = parsed as Record<string, string>;

  // Map bundled paths back to original paths
  const descriptions: Record<string, string> = {};
  Object.entries(rawDescriptions).forEach(([bundledPath, desc]) => {
    const originalPath = reverseMap[bundledPath] || bundledPath;
    // oxlint-disable-next-line immutable-data -- building output record
    descriptions[originalPath] = desc;
  });

  if (Object.keys(descriptions).length === 0 && scripts.length > 0) {
    p.log.warn('Description extraction returned no results. Descriptions may be unavailable.');
  }

  return descriptions;
}
