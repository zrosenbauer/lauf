import * as fs from 'node:fs';

import * as path from 'pathe';

import type { WorkspaceRoot } from './types.ts';
import { walkUp } from './walk.ts';

/**
 * Config file names to check when peeking for `root: true`.
 */
const CONFIG_FILE_NAMES: readonly string[] = ['lauf.config.ts', 'laufen.config.ts'];

/**
 * Maximum depth for the `.git` fallback walk.
 */
const MAX_GIT_DEPTH = 20;

/**
 * Check whether a directory contains a lauf config with `root: true`.
 *
 * Reads the raw file content and checks for `root: true` or `root:true`
 * via a lightweight regex. This avoids full config loading / jiti import
 * during root resolution.
 *
 * @param dir - Directory to check
 * @returns `true` if a config with `root: true` is found
 */
function hasRootConfig(dir: string): boolean {
  return CONFIG_FILE_NAMES.some((name) => {
    const filePath = path.join(dir, name);
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return /root\s*:\s*true/.test(content);
  });
}

/**
 * Resolve the workspace root boundary.
 *
 * Strategy (two-pass):
 * 1. Walk up from `startDir` looking for a `lauf.config.ts` with `root: true`.
 *    If found, that directory is the root (`source: 'config'`).
 * 2. If no `root: true` config found, walk up looking for a `.git` entry.
 *    If found, that directory is the root (`source: 'git'`).
 * 3. Fallback: use `startDir` itself (`source: 'cap'`).
 *
 * @param startDir - Directory to start searching from
 * @returns The resolved workspace root
 */
export function resolveRoot(startDir: string): WorkspaceRoot {
  const resolved = path.resolve(startDir);

  // Pass 1: look for root: true in a lauf config
  const configRoot = walkUp(resolved, hasRootConfig);
  if (configRoot) {
    return { dir: configRoot, source: 'config' };
  }

  // Pass 2: fall back to .git
  const gitRoot = walkUp(resolved, (dir) => fs.existsSync(path.join(dir, '.git')), MAX_GIT_DEPTH);
  if (gitRoot) {
    return { dir: gitRoot, source: 'git' };
  }

  // Pass 3: cap fallback
  return { dir: resolved, source: 'cap' };
}
