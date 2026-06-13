import { spawn } from 'node:child_process';
import * as fs from 'node:fs';

import * as path from 'pathe';

import type { Result } from '../result.ts';

type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

/**
 * Detect the package manager in use by checking for lockfiles.
 *
 * Checks in order: pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lockb.
 * Falls back to npm if no lockfile is found.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @returns Detected package manager
 */
export function detectPackageManager(workspaceRoot: string): Result<PackageManager> {
  const lockfiles: readonly { readonly file: string; readonly manager: PackageManager }[] = [
    { file: 'pnpm-lock.yaml', manager: 'pnpm' },
    { file: 'package-lock.json', manager: 'npm' },
    { file: 'yarn.lock', manager: 'yarn' },
    { file: 'bun.lockb', manager: 'bun' },
  ];

  const detected = lockfiles.find((entry) => {
    const lockPath = path.join(workspaceRoot, entry.file);
    return fs.existsSync(lockPath);
  });

  if (detected) {
    return [null, detected.manager];
  }

  return [null, 'npm'];
}

/**
 * Install packages in the cache directory using the detected package manager.
 *
 * Spawns `<manager> install` as a child process. All output is inherited
 * so the user sees progress.
 *
 * @param cacheDir - Absolute path to cache directory
 * @param manager - Package manager to use
 * @returns Result indicating success
 */
export function installPackages(cacheDir: string, manager: PackageManager): Promise<Result<void>> {
  return new Promise((resolve) => {
    const child = spawn(manager, ['install'], {
      cwd: cacheDir,
      stdio: 'inherit',
    });

    child.once('close', (code) => {
      if (code === 0) {
        resolve([null, undefined]);
      } else {
        resolve([new Error(`${manager} install exited with code ${code ?? 'unknown'}`), null]);
      }
    });

    child.once('error', (err) => {
      resolve([new Error(`Failed to spawn ${manager}: ${String(err)}`), null]);
    });
  });
}
