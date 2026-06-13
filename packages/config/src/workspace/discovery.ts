import * as fs from 'node:fs';

import { attempt } from 'es-toolkit';
import * as path from 'pathe';
import { globSync } from 'tinyglobby';

import { safeParseJSON } from '../utils/json.ts';
import type { Workspace, WorkspaceRoot } from './types.ts';

/**
 * Config file names to search for, in priority order.
 * `lauf.config.ts` is preferred over `laufen.config.ts` in the same directory.
 */
const CONFIG_FILE_NAMES: readonly string[] = ['lauf.config.ts', 'laufen.config.ts'];

/**
 * Derive the config name ('lauf' or 'laufen') from a config filename.
 */
function configNameFromFile(fileName: string): 'lauf' | 'laufen' {
  if (fileName.startsWith('laufen')) {
    return 'laufen';
  }
  return 'lauf';
}

/**
 * Read the package name from a directory's `package.json`.
 *
 * @param dir - Absolute path to the directory
 * @returns The package name, or the directory basename as fallback
 */
function readWorkspaceName(dir: string): string {
  const pkgJsonPath = path.join(dir, 'package.json');
  const [readError, content] = attempt(() => fs.readFileSync(pkgJsonPath, 'utf-8'));
  if (readError || content === null) {
    return path.basename(dir);
  }

  const [parseError, pkg] = safeParseJSON(content);
  if (parseError || pkg === null) {
    return path.basename(dir);
  }

  if (typeof pkg === 'object' && 'name' in pkg && typeof pkg.name === 'string') {
    return pkg.name;
  }

  return path.basename(dir);
}

/**
 * Check whether a config file contains `root: true` via lightweight regex.
 */
function isRootConfig(configFile: string): boolean {
  const [readError, content] = attempt(() => fs.readFileSync(configFile, 'utf-8'));
  if (readError || content === null) {
    return false;
  }
  return /root\s*:\s*true/.test(content);
}

/**
 * Discover all workspaces within the given root boundary.
 *
 * A workspace is a directory containing a `lauf.config.ts` or `laufen.config.ts`.
 * Globs for config files under the root, deduplicates by directory (preferring
 * `lauf` over `laufen`), reads package names, and sorts shallowest-first.
 *
 * @param root - The workspace root boundary
 * @returns All discovered workspaces, sorted by depth (shallowest first)
 */
export function discoverWorkspaces(root: WorkspaceRoot): readonly Workspace[] {
  const files = globSync(
    CONFIG_FILE_NAMES.map((name) => `**/${name}`),
    {
      cwd: root.dir,
      absolute: true,
      onlyFiles: true,
      dot: false,
      ignore: ['**/node_modules/**'],
    },
  );

  // Deduplicate: prefer lauf over laufen in the same directory.
  // Map each file to a [dir, entry] tuple and sort so that within a single
  // directory `laufen` entries appear before `lauf` entries. `Object.fromEntries`
  // keeps the last value for duplicate keys, so `lauf` wins.
  const entries = files
    .map((filePath) => {
      const dir = path.dirname(filePath);
      const configName = configNameFromFile(path.basename(filePath));
      return [dir, { configFile: filePath, configName }] as const;
    })
    .toSorted(([, a], [, b]) => {
      if (a.configName === b.configName) {
        return 0;
      }
      if (a.configName === 'lauf') {
        return 1;
      }
      return -1;
    });
  const grouped: Record<string, { configFile: string; configName: 'lauf' | 'laufen' }> =
    Object.fromEntries(entries);

  return Object.entries(grouped)
    .map(
      ([dir, entry]): Workspace => ({
        name: readWorkspaceName(dir),
        dir,
        configFile: entry.configFile,
        configName: entry.configName,
        isRoot: isRootConfig(entry.configFile),
      }),
    )
    .toSorted((a, b) => a.dir.split(path.sep).length - b.dir.split(path.sep).length);
}

/**
 * Build a Workspace from a directory if it contains a config file.
 */
function buildWorkspaceFromDir(dir: string): Workspace | null {
  const matchedName = CONFIG_FILE_NAMES.find((name) => fs.existsSync(path.join(dir, name)));
  if (!matchedName) {
    return null;
  }
  return {
    name: readWorkspaceName(dir),
    dir,
    configFile: path.join(dir, matchedName),
    configName: configNameFromFile(matchedName),
    isRoot: isRootConfig(path.join(dir, matchedName)),
  };
}

/**
 * Find the nearest config file by walking upward from `startDir` to the root.
 *
 * At each directory, checks for `lauf.config.ts` first, then `laufen.config.ts`.
 * Returns the first (closest) match, or `undefined` if none found.
 *
 * @param startDir - Directory to start searching from
 * @param root - The workspace root boundary
 * @returns The nearest workspace, or `undefined`
 */
export function findNearestWorkspace(startDir: string, root: WorkspaceRoot): Workspace | undefined {
  const resolvedStart = path.resolve(startDir);
  const resolvedRoot = path.resolve(root.dir);

  const search = (dir: string, prevDir: string): Workspace | undefined => {
    if (dir === prevDir) {
      return undefined;
    }

    // Check for config files in this directory
    const found = buildWorkspaceFromDir(dir);

    if (found) {
      return found;
    }

    // Stop at the root boundary
    if (dir === resolvedRoot) {
      return undefined;
    }

    return search(path.dirname(dir), dir);
  };

  return search(resolvedStart, '');
}
