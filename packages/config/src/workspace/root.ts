import * as fs from 'node:fs';

import * as path from 'pathe';

import { CONFIG_FILE_NAMES, isRootConfig } from './config-files.ts';
import type { WorkspaceRoot } from './types.ts';
import { walkUp } from './walk.ts';

/**
 * Maximum depth for the `.git` fallback walk.
 */
const MAX_GIT_DEPTH = 20;

function hasRootConfig(dir: string): boolean {
  return CONFIG_FILE_NAMES.some((name) => {
    const filePath = path.join(dir, name);
    if (!fs.existsSync(filePath)) {
      return false;
    }
    return isRootConfig(filePath);
  });
}

/**
 * Resolve the workspace root boundary.
 *
 * Strategy (three-pass):
 *  1. Walk up from `startDir` looking for a config with `root: true`
 *     → `source: 'config'`
 *  2. Walk up looking for a `.git` entry → `source: 'git'`
 *  3. Fall back to `startDir` itself → `source: 'cap'`
 */
export function resolveRoot(startDir: string): WorkspaceRoot {
  const resolved = path.resolve(startDir);

  const configRoot = walkUp(resolved, hasRootConfig);
  if (configRoot) {
    return { dir: configRoot, source: 'config' };
  }

  const gitRoot = walkUp(resolved, (dir) => fs.existsSync(path.join(dir, '.git')), MAX_GIT_DEPTH);
  if (gitRoot) {
    return { dir: gitRoot, source: 'git' };
  }

  return { dir: resolved, source: 'cap' };
}
