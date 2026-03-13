import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { attempt } from 'es-toolkit';

import type { Result } from './result.ts';

/**
 * Compute a stable hash from package definitions.
 *
 * Sorts package entries alphabetically before hashing to ensure
 * the same package set always produces the same hash.
 *
 * @param packages - Package name to version map
 * @returns First 16 characters of SHA-256 hash
 */
export function computePackageHash(packages: Record<string, string>): string {
  const sortedEntries = Object.entries(packages).toSorted(([a], [b]) => a.localeCompare(b));
  const canonical = JSON.stringify(sortedEntries);
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  return hash.slice(0, 16);
}

/**
 * Resolve the cache directory path for a package set.
 *
 * @param packages - Package name to version map
 * @returns Absolute path to cache directory
 */
export function resolveCacheDir(packages: Record<string, string>): string {
  const hash = computePackageHash(packages);
  return path.join(os.homedir(), '.lauf', 'packages', hash);
}

/**
 * Check if a cache directory is valid and ready to use.
 *
 * Validates that both package.json and node_modules/ exist.
 *
 * @param cacheDir - Absolute path to cache directory
 * @returns Result indicating validity
 */
export function isCacheValid(cacheDir: string): Result<boolean> {
  const packageJsonPath = path.join(cacheDir, 'package.json');
  const nodeModulesPath = path.join(cacheDir, 'node_modules');

  const [packageJsonError, packageJsonExists] = attempt(() => fs.existsSync(packageJsonPath));
  if (packageJsonError) {
    return [packageJsonError as Error, null];
  }

  if (packageJsonExists === null) {
    return [new Error('Unexpected null from fs.existsSync'), null];
  }

  const [nodeModulesError, nodeModulesExists] = attempt(() => fs.existsSync(nodeModulesPath));
  if (nodeModulesError) {
    return [nodeModulesError as Error, null];
  }

  if (nodeModulesExists === null) {
    return [new Error('Unexpected null from fs.existsSync'), null];
  }

  const isValid = packageJsonExists && nodeModulesExists;
  return [null, isValid];
}

/**
 * Ensure cache directory exists, creating it if necessary.
 *
 * @param cacheDir - Absolute path to cache directory
 * @returns Result indicating success
 */
export function ensureCacheDir(cacheDir: string): Result<void> {
  const [error] = attempt(() => fs.mkdirSync(cacheDir, { recursive: true }));
  if (error) {
    return [error as Error, null];
  }
  return [null, undefined];
}

/**
 * Write a minimal package.json to the cache directory.
 *
 * Creates a package.json with only name, type, and dependencies fields.
 *
 * @param cacheDir - Absolute path to cache directory
 * @param packages - Package name to version map
 * @returns Result indicating success
 */
export function writePackageJson(cacheDir: string, packages: Record<string, string>): Result<void> {
  const packageJsonPath = path.join(cacheDir, 'package.json');
  const content = {
    name: 'lauf-package-cache',
    type: 'module',
    dependencies: packages,
  };

  const [error] = attempt(() =>
    fs.writeFileSync(packageJsonPath, JSON.stringify(content, null, 2)),
  );
  if (error) {
    return [error as Error, null];
  }
  return [null, undefined];
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe('computePackageHash', () => {
    it('produces consistent hash for same packages', () => {
      const packages = { rimraf: '^6.0.0', execa: '^9.0.0' };
      const hash1 = computePackageHash(packages);
      const hash2 = computePackageHash(packages);
      expect(hash1).toBe(hash2);
    });

    it('produces same hash regardless of definition order', () => {
      const packages1 = { rimraf: '^6.0.0', execa: '^9.0.0' };
      const packages2 = { execa: '^9.0.0', rimraf: '^6.0.0' };
      expect(computePackageHash(packages1)).toBe(computePackageHash(packages2));
    });

    it('produces different hash for different packages', () => {
      const packages1 = { rimraf: '^6.0.0' };
      const packages2 = { execa: '^9.0.0' };
      expect(computePackageHash(packages1)).not.toBe(computePackageHash(packages2));
    });

    it('produces different hash for different versions', () => {
      const packages1 = { rimraf: '^6.0.0' };
      const packages2 = { rimraf: '^7.0.0' };
      expect(computePackageHash(packages1)).not.toBe(computePackageHash(packages2));
    });

    it('returns 16-character hash', () => {
      const packages = { rimraf: '^6.0.0' };
      const hash = computePackageHash(packages);
      expect(hash).toHaveLength(16);
    });
  });

  describe('resolveCacheDir', () => {
    it('returns path in home directory', () => {
      const packages = { rimraf: '^6.0.0' };
      const cacheDir = resolveCacheDir(packages);
      expect(cacheDir).toContain(os.homedir());
      expect(cacheDir).toContain('.lauf');
      expect(cacheDir).toContain('packages');
    });
  });
}
