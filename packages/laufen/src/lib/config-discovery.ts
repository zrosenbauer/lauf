import * as fs from 'node:fs';
import * as path from 'node:path';

import fg from 'fast-glob';

/**
 * Config file names to search for, in priority order.
 * `lauf.config.ts` is preferred over `laufen.config.ts` in the same directory.
 */
const CONFIG_FILE_NAMES: readonly string[] = ['lauf.config.ts', 'laufen.config.ts'];

/**
 * Maximum number of parent directories to traverse before giving up
 * when no git root is found.
 */
const MAX_SEARCH_DEPTH = 20;

/**
 * The boundary at which upward config searching stops.
 */
export interface ConfigSearchBoundary {
  readonly root: string;
  readonly source: 'git' | 'cap';
}

/**
 * A discovered config file with its location metadata.
 */
export interface DiscoveredConfig {
  readonly configFile: string;
  readonly configDir: string;
  readonly configName: 'lauf' | 'laufen';
}

/**
 * Detect the search boundary by walking upward from startDir.
 *
 * Stops at the first directory containing a `.git` entry (directory or file,
 * supporting submodules). Falls back to a depth cap of {@link MAX_SEARCH_DEPTH}
 * or the filesystem root, whichever comes first.
 */
export function detectSearchBoundary(startDir: string): ConfigSearchBoundary {
  const walk = (dir: string, prevDir: string, depth: number): ConfigSearchBoundary => {
    if (dir === prevDir || depth >= MAX_SEARCH_DEPTH) {
      return { root: dir, source: 'cap' };
    }
    if (fs.existsSync(path.join(dir, '.git'))) {
      return { root: dir, source: 'git' };
    }
    return walk(path.dirname(dir), dir, depth + 1);
  };

  return walk(path.resolve(startDir), '', 0);
}

/**
 * Collect directories from startDir up to (and including) boundaryRoot.
 * Returns directories ordered closest-first (startDir → boundaryRoot).
 */
export function collectSearchDirs(startDir: string, boundaryRoot: string): readonly string[] {
  const resolvedBoundary = path.resolve(boundaryRoot);

  const collect = (dir: string, prevDir: string, acc: readonly string[]): readonly string[] => {
    if (dir === prevDir) {
      return acc;
    }
    const next = [...acc, dir];
    if (dir === resolvedBoundary) {
      return next;
    }
    return collect(path.dirname(dir), dir, next);
  };

  return collect(path.resolve(startDir), '', []);
}

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
 * Find the closest config file by walking upward from startDir to the
 * search boundary.
 *
 * At each directory, checks for `lauf.config.ts` first, then `laufen.config.ts`.
 * Returns the first (closest) match, or `undefined` if none found.
 */
export function findConfigFile(startDir: string): DiscoveredConfig | undefined {
  const boundary = detectSearchBoundary(startDir);
  const dirs = collectSearchDirs(startDir, boundary.root);

  const candidates = dirs.flatMap((dir) =>
    CONFIG_FILE_NAMES.map(
      (name): DiscoveredConfig => ({
        configFile: path.join(dir, name),
        configDir: dir,
        configName: configNameFromFile(name),
      }),
    ).filter((entry) => fs.existsSync(entry.configFile)),
  );

  return candidates[0];
}

/**
 * Discover all config files within the search boundary.
 *
 * Used by the `--all` flag to aggregate configs from subdirectories.
 * Deduplicates — prefers `lauf.config.ts` over `laufen.config.ts` in the
 * same directory. Results are sorted by path depth (shallowest first).
 */
export function discoverAllConfigs(startDir: string): readonly DiscoveredConfig[] {
  const boundary = detectSearchBoundary(startDir);

  const files = fg.sync(
    CONFIG_FILE_NAMES.map((name) => `**/${name}`),
    {
      cwd: boundary.root,
      absolute: true,
      onlyFiles: true,
      dot: false,
      ignore: ['**/node_modules/**'],
    },
  );

  // Deduplicate: prefer lauf over laufen in the same directory.
  // Builds a record keyed by directory using Object.assign for efficiency.
  const grouped = files.reduce<Record<string, DiscoveredConfig>>(
    (acc, filePath) => {
      const dir = path.dirname(filePath);
      const fileName = path.basename(filePath);
      const configName = configNameFromFile(fileName);
      const existing = acc[dir];

      // Keep lauf if already found in this directory
      if (existing && existing.configName === 'lauf') {
        return acc;
      }

      return Object.assign(acc, { [dir]: { configFile: filePath, configDir: dir, configName } });
    },
    Object.create(null) as Record<string, DiscoveredConfig>,
  );

  return Object.values(grouped).toSorted(
    (a, b) => a.configDir.split(path.sep).length - b.configDir.split(path.sep).length,
  );
}
