import * as path from 'pathe';

import type { DiscoveredScript, Workspace, WorkspaceRoot } from '../types.ts';
import { discoverAllScripts } from './discover.ts';
import { extractStem } from './qualify.ts';

/**
 * Find a script by name across workspaces.
 *
 * Bare names (no `/`) prefer the current workspace, then fall back to any
 * match (root scripts have bare names). Qualified names (`@apps/web/build`)
 * search all workspaces for an exact match.
 */
export function findScript(
  scriptName: string,
  currentWorkspace: Workspace | undefined,
  workspaces: readonly (readonly [Workspace, readonly string[]])[],
  root: WorkspaceRoot,
): DiscoveredScript | undefined {
  const allScripts = discoverAllScripts(workspaces, root);

  if (scriptName.includes('/')) {
    return allScripts.find((s) => s.name === scriptName);
  }

  if (currentWorkspace) {
    const localMatch = allScripts
      .filter((s) => path.resolve(s.packageDir) === path.resolve(currentWorkspace.dir))
      .find((s) => extractStem(s.name) === scriptName);
    if (localMatch) {
      return localMatch;
    }
  }

  return allScripts.find((s) => s.name === scriptName);
}
