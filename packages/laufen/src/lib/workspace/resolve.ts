import * as path from 'node:path';

import type { Workspace } from './types.ts';

/**
 * Resolve which workspace contains the given directory.
 *
 * Returns the deepest (most specific) workspace whose directory is
 * an ancestor of (or equal to) `cwd`. Returns `undefined` if `cwd`
 * is not inside any known workspace.
 *
 * @param cwd - The directory to resolve
 * @param workspaces - All discovered workspaces
 * @returns The deepest matching workspace, or `undefined`
 */
export function resolveCurrentWorkspace(
  cwd: string,
  workspaces: readonly Workspace[],
): Workspace | undefined {
  const resolved = path.resolve(cwd);

  const matching = workspaces.filter((ws) => {
    const wsDir = path.resolve(ws.dir);
    return resolved === wsDir || resolved.startsWith(`${wsDir}${path.sep}`);
  });

  if (matching.length === 0) {
    return undefined;
  }

  return matching.reduce((deepest, ws) => {
    if (ws.dir.length > deepest.dir.length) {
      return ws;
    }
    return deepest;
  });
}
