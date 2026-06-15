import * as fs from 'node:fs';

import * as path from 'pathe';

import { attempt, isErr } from 'massaman/control';
import type { DiscoveredScript, WorkspaceRoot } from '../types.ts';

/**
 * Resolve a path canonically (following symlinks). Falls back to
 * `path.resolve` if the target does not exist or `realpathSync` throws.
 */
export function canonicalize(target: string): string {
  const real = attempt(() => fs.realpathSync(target));
  if (isErr(real)) {
    return path.resolve(target);
  }
  return real.value;
}

/**
 * Filter discovered scripts to those inside the workspace root boundary,
 * using canonical (symlink-resolved) paths on both sides so a symlinked
 * script can't escape the workspace via an indirect path.
 */
export function filterToRoot(
  scripts: readonly DiscoveredScript[],
  root: WorkspaceRoot,
): readonly DiscoveredScript[] {
  const normalizedRoot = canonicalize(root.dir);
  return scripts.filter((script) => {
    const resolved = canonicalize(script.path);
    return resolved === normalizedRoot || resolved.startsWith(`${normalizedRoot}${path.sep}`);
  });
}
