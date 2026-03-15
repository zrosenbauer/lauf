import * as fs from 'node:fs';
import * as path from 'node:path';

import { attempt } from 'es-toolkit';

import type { Result } from '../result.ts';
import { ensureCacheDir, isCacheValid, resolveCacheDir, writePackageJson } from './cache.ts';
import { detectPackageManager, safeInstallPackages } from './installer.ts';

export interface PreparePackagesResult {
  readonly cacheDir: string;
  readonly packageNames: readonly string[];
}

interface AcquireLockResult {
  readonly releaseLock: () => void;
}

/**
 * Attempt to acquire a lock for cache directory.
 *
 * If lock acquisition fails, re-checks cache validity in case another
 * process completed the installation.
 */
function acquireLock(
  lockDir: string,
  cacheDir: string,
  packages: Record<string, string>,
  packageNames: readonly string[],
): Result<AcquireLockResult> | readonly [null, PreparePackagesResult] {
  const [lockError] = attempt(() => fs.mkdirSync(lockDir));
  if (lockError) {
    const [recheckError, recheckValid] = isCacheValid(cacheDir, packages);
    if (recheckError) {
      return [recheckError, null];
    }
    if (recheckValid) {
      return [null, { cacheDir, packageNames }];
    }
    return [
      new Error(`Package cache is currently being prepared by another process: ${cacheDir}`),
      null,
    ];
  }

  const releaseLock = (): void => {
    attempt(() => fs.rmSync(lockDir, { recursive: true, force: true }));
  };

  return [null, { releaseLock }];
}

/**
 * Perform the package installation into cache directory.
 *
 * Creates cache directory, writes package.json, detects package manager,
 * and installs packages.
 */
async function performInstallation(
  cacheDir: string,
  packages: Record<string, string>,
  workspaceRoot: string,
): Promise<Result<void>> {
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

  return [null, undefined];
}

/**
 * Prepare packages for use in a script.
 *
 * High-level orchestration that:
 * 1. Computes cache directory from package definitions
 * 2. Returns early if cache is valid
 * 3. Otherwise: acquires lock, installs packages, releases lock
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

  const [validError, isValid] = isCacheValid(cacheDir, packages);
  if (validError) {
    return [validError, null];
  }
  if (isValid) {
    return [null, { cacheDir, packageNames }];
  }

  const lockResult = acquireLock(`${cacheDir}.lock`, cacheDir, packages, packageNames);
  if (lockResult[0]) {
    return lockResult as Result<PreparePackagesResult>;
  }
  if (lockResult[1] && 'cacheDir' in lockResult[1]) {
    return lockResult as readonly [null, PreparePackagesResult];
  }

  const { releaseLock } = lockResult[1] as AcquireLockResult;

  const [installError] = await performInstallation(cacheDir, packages, workspaceRoot);
  if (installError) {
    releaseLock();
    return [installError, null];
  }

  releaseLock();
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
