import * as path from 'pathe';
import { globSync } from 'tinyglobby';

import {
  CONFIG_FILE_NAMES,
  configNameFromFile,
  findConfigFileName,
  isRootConfig,
} from './config-files.ts';
import { readWorkspaceName } from './package-name.ts';
import type { Workspace, WorkspaceRoot } from './types.ts';

interface ConfigEntry {
  readonly configFile: string;
  readonly configName: 'lauf' | 'laufen';
}

/**
 * When two configs sit in the same dir (`lauf.config.ts` AND
 * `laufen.config.ts`), `lauf` wins.
 *
 * Sorts entries so that for any given dir, `laufen` appears before `lauf`.
 * Then `Object.fromEntries` keeps the last value for duplicate keys, so
 * `lauf` is the survivor.
 */
function preferLaufOverLaufen(
  entries: readonly (readonly [string, ConfigEntry])[],
): Record<string, ConfigEntry> {
  const sorted = entries.toSorted(([, a], [, b]) => {
    if (a.configName === b.configName) {
      return 0;
    }
    if (a.configName === 'lauf') {
      return 1;
    }
    return -1;
  });
  return Object.fromEntries(sorted);
}

/**
 * Discover all workspaces within the given root boundary.
 *
 * A workspace is a directory containing a `lauf.config.ts` or
 * `laufen.config.ts`. Returns workspaces sorted shallowest-first.
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

  const entries = files.map((filePath) => {
    const dir = path.dirname(filePath);
    const configName = configNameFromFile(path.basename(filePath));
    return [dir, { configFile: filePath, configName }] as const;
  });
  const grouped = preferLaufOverLaufen(entries);

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

function buildWorkspaceFromDir(dir: string): Workspace | null {
  const matchedName = findConfigFileName(dir);
  if (!matchedName) {
    return null;
  }
  const configFile = path.join(dir, matchedName);
  return {
    name: readWorkspaceName(dir),
    dir,
    configFile,
    configName: configNameFromFile(matchedName),
    isRoot: isRootConfig(configFile),
  };
}

/**
 * Find the nearest config by walking upward from `startDir` to `root.dir`.
 *
 * Returns the first match, or `undefined` if no config exists between
 * `startDir` and the root.
 */
export function findNearestWorkspace(startDir: string, root: WorkspaceRoot): Workspace | undefined {
  const resolvedStart = path.resolve(startDir);
  const resolvedRoot = path.resolve(root.dir);

  const search = (dir: string, prevDir: string): Workspace | undefined => {
    if (dir === prevDir) {
      return undefined;
    }

    const found = buildWorkspaceFromDir(dir);
    if (found) {
      return found;
    }

    if (dir === resolvedRoot) {
      return undefined;
    }

    return search(path.dirname(dir), dir);
  };

  return search(resolvedStart, '');
}
