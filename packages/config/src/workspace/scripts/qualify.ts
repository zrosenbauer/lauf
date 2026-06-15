import type { Workspace } from '../types.ts';

/**
 * Sentinel name used to label the root workspace in tree output.
 */
export const ROOT_WORKSPACE_NAME = '<root>';

/**
 * Build a qualified script name from a workspace and a stem.
 *
 * Root workspace scripts return the bare stem (e.g. `setup`); child
 * workspace scripts include the workspace prefix (e.g. `@apps/api/setup`).
 */
export function qualifyScriptName(workspace: Workspace, stem: string): string {
  if (workspace.isRoot) {
    return stem;
  }
  return `${workspace.name}/${stem}`;
}

/**
 * Extract the bare stem from a (possibly qualified) script name.
 */
export function extractStem(name: string): string {
  if (name.includes('/')) {
    return name.slice(name.lastIndexOf('/') + 1);
  }
  return name;
}
