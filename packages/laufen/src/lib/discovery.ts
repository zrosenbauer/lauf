import * as path from 'node:path';

import fg from 'fast-glob';
import picomatch from 'picomatch';

import type { PackageInfo } from './paths.ts';
import { resolveWorkspacePackages } from './paths.ts';
import type { DiscoveredScript } from './types.ts';
import { getWorkspaceRoot } from './workspace.ts';

/**
 * Sentinel package name used for the workspace root package.
 */
export const ROOT_PACKAGE_NAME = '<root>';

/**
 * Build a qualified script name from a package name and stem.
 *
 * Root package scripts are returned as bare stems (e.g. `setup`),
 * while sub-package scripts include the package prefix (e.g. `@apps/api/setup`).
 *
 * @param packageName - The package name (or ROOT_PACKAGE_NAME for root)
 * @param stem - The script stem (filename without extension)
 * @returns The qualified script name
 */
export function qualifyScriptName(packageName: string, stem: string): string {
  if (packageName === ROOT_PACKAGE_NAME) {
    return stem;
  }
  return `${packageName}/${stem}`;
}

/**
 * Validate that a glob pattern is safe for workspace-scoped discovery.
 *
 * Rejects patterns that start with `..` (parent traversal) or `/` (absolute path),
 * which could escape the workspace boundary.
 *
 * @param pattern - Glob pattern to validate
 * @returns `true` if the pattern is safe, `false` otherwise
 */
function isValidPattern(pattern: string): boolean {
  // Reject null bytes (path poisoning)
  /* v8 ignore next 3 -- defensive security guard; callers never produce null bytes */
  if (pattern.includes('\0')) {
    return false;
  }
  // Reject absolute paths (Unix `/` prefix and Windows drive letters like `C:\...`)
  if (pattern.startsWith('..') || pattern.startsWith('/') || path.isAbsolute(pattern)) {
    return false;
  }
  // Reject patterns with embedded parent traversal (e.g. "scripts/../../sensitive/*.ts")
  const normalized = path.normalize(pattern);
  if (normalized.startsWith('..') || normalized.startsWith('/') || path.isAbsolute(normalized)) {
    return false;
  }
  return true;
}

/**
 * Filter discovered scripts to those whose resolved paths are within the workspace root.
 *
 * @param scripts - Scripts discovered by globbing
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns Only scripts with paths inside the workspace root
 */
function filterToWorkspace(
  scripts: readonly DiscoveredScript[],
  workspaceRoot: string,
): readonly DiscoveredScript[] {
  const normalizedRoot = path.resolve(workspaceRoot);
  return scripts.filter((script) => {
    const resolved = path.resolve(script.path);
    return resolved === normalizedRoot || resolved.startsWith(`${normalizedRoot}${path.sep}`);
  });
}

/**
 * Options for script discovery.
 */
interface DiscoverOptions {
  /**
   * When provided, only discover scripts in packages whose directories
   * are within this path. Used by the `--all` flag to scope each config's
   * discovery to its own subtree.
   */
  readonly scopeDir?: string;
  /**
   * When provided, only discover scripts in packages whose names match
   * one of the given glob patterns (e.g. `["@apps/*"]`).
   */
  readonly filterGlobs?: readonly string[];
  /**
   * When provided, only discover scripts in the package whose directory
   * exactly matches this path.
   */
  readonly packageDir?: string;
}

/**
 * Discover all lauf scripts across the monorepo.
 *
 * Scans each workspace package for files matching the given glob patterns
 * and returns qualified names in the format `<package-name>/<script-stem>`.
 *
 * When `options.scopeDir` is provided, only packages under that directory
 * are included in the discovery.
 *
 * @param patterns - Glob patterns relative to each package directory
 * @param options - Optional discovery options
 * @returns Readonly array of discovered scripts, sorted by name
 *
 * @example
 * ```ts
 * const scripts = discoverScripts(['scripts/*.lauf.ts'])
 * // [{ name: '@apps/api/generate-types', path: '/...', ... }, ...]
 * ```
 */
export function discoverScripts(
  patterns: string[],
  options?: DiscoverOptions,
): readonly DiscoveredScript[] {
  const validPatterns = patterns.filter((p) => isValidPattern(p));

  if (validPatterns.length === 0) {
    return [];
  }

  const packages = resolveWorkspacePackages();
  const workspaceRoot = getWorkspaceRoot();
  const scopedPackages = applyPackageFilters(packages, options);

  const scripts = scopedPackages
    .flatMap((pkg) => {
      const files = fg.sync(validPatterns, {
        cwd: pkg.dir,
        absolute: true,
        onlyFiles: true,
      });

      return files.map((filePath): DiscoveredScript => {
        const stem = stripScriptSuffix(path.basename(filePath, '.ts'));
        return {
          name: qualifyScriptName(pkg.name, stem),
          path: filePath,
          packageDir: pkg.dir,
          packageName: pkg.name,
        };
      });
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));

  return filterToWorkspace(scripts, workspaceRoot);
}

/**
 * Apply all package filters in priority order: packageDir > filterGlobs > scopeDir > none.
 *
 * Only the highest-priority filter present in options is applied.
 */
function applyPackageFilters(
  packages: readonly PackageInfo[],
  options: DiscoverOptions | undefined,
): readonly PackageInfo[] {
  if (!options) {
    return packages;
  }
  if (options.packageDir) {
    return filterPackagesByDir(packages, options.packageDir);
  }
  if (options.filterGlobs && options.filterGlobs.length > 0) {
    return filterPackagesByNameGlob(packages, options.filterGlobs);
  }
  if (options.scopeDir) {
    return filterPackagesByScope(packages, options.scopeDir);
  }
  return packages;
}

/**
 * Filter packages to the one whose directory exactly matches the given path.
 */
function filterPackagesByDir(
  packages: readonly PackageInfo[],
  dir: string,
): readonly PackageInfo[] {
  const resolved = path.resolve(dir);
  return packages.filter((pkg) => path.resolve(pkg.dir) === resolved);
}

/**
 * Filter packages whose names match at least one of the given glob patterns.
 */
function filterPackagesByNameGlob(
  packages: readonly PackageInfo[],
  globs: readonly string[],
): readonly PackageInfo[] {
  const isMatch = picomatch([...globs]);
  return packages.filter((pkg) => isMatch(pkg.name));
}

/**
 * Filter packages to those whose directories are within the scope directory.
 */
function filterPackagesByScope(
  packages: readonly PackageInfo[],
  scopeDir: string,
): readonly PackageInfo[] {
  const scope = path.resolve(scopeDir);
  return packages.filter((pkg) => {
    const resolved = path.resolve(pkg.dir);
    return resolved === scope || resolved.startsWith(`${scope}${path.sep}`);
  });
}

function stripScriptSuffix(stem: string): string {
  if (stem.endsWith('.laufen')) {
    return stem.slice(0, -'.laufen'.length);
  }
  if (stem.endsWith('.lauf')) {
    return stem.slice(0, -'.lauf'.length);
  }
  return stem;
}

/**
 * Find a single script by its qualified name.
 *
 * When a pre-discovered scripts array is provided, searches within it
 * instead of re-discovering all scripts. This avoids redundant globbing
 * when the caller already has the full list.
 *
 * @param scriptName - Qualified name (e.g. `@apps/sandbox/generate-types`)
 * @param patterns - Glob patterns relative to each package directory
 * @param scripts - Optional pre-discovered scripts array to search within
 * @returns The discovered script, or `undefined` if not found
 *
 * @example
 * ```ts
 * const allScripts = discoverScripts(['scripts/*.lauf.ts'])
 * const script = findScript('@apps/api/generate-types', ['scripts/*.lauf.ts'], allScripts)
 * if (script) {
 *   console.log(script.path)
 * }
 * ```
 */
export function findScript(
  scriptName: string,
  patterns: string[],
  scripts?: readonly DiscoveredScript[],
): DiscoveredScript | undefined {
  if (scripts !== undefined) {
    return scripts.find((s) => s.name === scriptName);
  }
  return discoverScripts(patterns).find((s) => s.name === scriptName);
}
