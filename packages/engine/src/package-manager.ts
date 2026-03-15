import * as fs from 'node:fs';
import * as path from 'node:path';

import { attempt } from 'es-toolkit';

import {
  ensureCacheDir,
  isCacheValid,
  resolveCacheDir,
  writePackageJson,
} from './package-cache.ts';
import { detectPackageManager, safeInstallPackages } from './package-installer.ts';
import type { Result } from './result.ts';

export interface PreparePackagesResult {
  readonly cacheDir: string;
  readonly packageNames: readonly string[];
}

/**
 * Prepare packages for use in a script.
 *
 * High-level orchestration that:
 * 1. Computes cache directory from package definitions
 * 2. Returns early if cache is valid
 * 3. Otherwise: creates directory, writes package.json, installs packages
 * 4. Returns cache directory path and package names for esbuild externals
 *
 * @param packages - Package name to version map
 * @param workspaceRoot - Absolute path to workspace root (for package manager detection)
 * @returns Result containing cache directory and package names
 */
export async function preparePackages(
  packages: Record<string, string>,
  workspaceRoot: string,
): Promise<Result<PreparePackagesResult>> {
  const cacheDir = resolveCacheDir(packages);
  const packageNames = Object.keys(packages);

  const [validError, isValid] = isCacheValid(cacheDir);
  if (validError) {
    return [validError, null];
  }

  if (isValid) {
    return [null, { cacheDir, packageNames }];
  }

  const [ensureError] = ensureCacheDir(cacheDir);
  if (ensureError) {
    return [ensureError, null];
  }

  const [writeError] = writePackageJson(cacheDir, packages);
  if (writeError) {
    return [writeError, null];
  }

  const [detectError, manager] = detectPackageManager(workspaceRoot);
  if (detectError) {
    return [detectError, null];
  }

  const [installError] = await safeInstallPackages(cacheDir, manager);
  if (installError) {
    attempt(() => fs.rmSync(cacheDir, { recursive: true, force: true }));
    return [installError, null];
  }

  return [null, { cacheDir, packageNames }];
}

/**
 * Get the node_modules path within a cache directory.
 *
 * @param cacheDir - Absolute path to cache directory
 * @returns Absolute path to node_modules directory
 */
export function getCacheNodeModulesPath(cacheDir: string): string {
  return path.join(cacheDir, 'node_modules');
}
