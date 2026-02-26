import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { attempt } from 'es-toolkit';
import fg from 'fast-glob';

import { safeParseJSON } from '../utils/json.ts';
import { getWorkspaceInfo, getWorkspaceRoot } from './workspace.ts';

export { getWorkspaceRoot };

/**
 * Absolute path to the lauf package directory.
 */
export const LAUF_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

interface PackageInfo {
  readonly name: string;
  readonly dir: string;
}

/**
 * Resolve all workspace packages from detected workspace globs.
 *
 * Includes the workspace root itself if it has a valid `package.json`.
 *
 * @returns Array of package info objects with name and absolute directory path
 */
export function resolveWorkspacePackages(): readonly PackageInfo[] {
  const { root, globs } = getWorkspaceInfo();

  const dirs = fg.sync(
    globs.map((g) => g.replace(/\/$/, '')),
    {
      cwd: root,
      onlyDirectories: true,
      absolute: true,
    },
  );

  const packages = dirs.flatMap((dir) => {
    const info = readPackageInfo(dir);
    if (info) {
      return [info];
    }
    return [];
  });

  const rootPkg = readPackageInfo(root);
  if (rootPkg) {
    return [{ ...rootPkg, name: '<root>' }, ...packages];
  }
  return packages;
}

/**
 * Read the package name from a directory's `package.json`.
 *
 * @param dir - Absolute path to the directory
 * @returns Package info if valid, or `undefined` if missing or malformed
 * @private
 */
function readPackageInfo(dir: string): PackageInfo | undefined {
  const pkgJsonPath = path.join(dir, 'package.json');
  const [error, content] = attempt(() => fs.readFileSync(pkgJsonPath, 'utf-8'));
  if (error || content === null) {
    return undefined;
  }

  const [parseError, pkg] = safeParseJSON(content);
  if (parseError || pkg === null) {
    return undefined;
  }

  if (typeof pkg !== 'object' || !('name' in pkg) || typeof pkg.name !== 'string') {
    return undefined;
  }

  return { name: pkg.name, dir };
}
