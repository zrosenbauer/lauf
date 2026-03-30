import { discoverWorkspaces } from './discovery.ts';
import { resolveCurrentWorkspace } from './resolve.ts';
import { resolveRoot } from './root.ts';
import type { Workspace, WorkspaceRoot, WorkspaceTree } from './types.ts';

/**
 * Cached workspace state computed once per cwd.
 */
export interface CachedWorkspaceState {
  readonly root: WorkspaceRoot;
  readonly tree: WorkspaceTree;
  readonly current: Workspace | undefined;
}

/**
 * Module-level cache keyed by cwd.
 */
// oxlint-disable-next-line prefer-const -- Map is const; entries are cache mutations
const stateCache = new Map<string, CachedWorkspaceState>();

/**
 * Get the full workspace state for the given cwd.
 *
 * Computes on first access: resolves the root boundary, discovers all
 * workspaces (directories with lauf configs), and determines which
 * workspace the cwd belongs to.
 *
 * @param cwd - Working directory (defaults to `process.cwd()`)
 * @returns Cached workspace state
 */
export function getWorkspaceState(cwd: string = process.cwd()): CachedWorkspaceState {
  const cached = stateCache.get(cwd);
  if (cached !== undefined) {
    return cached;
  }

  const root = resolveRoot(cwd);
  const workspaces = discoverWorkspaces(root);
  const tree: WorkspaceTree = { root, workspaces };
  const current = resolveCurrentWorkspace(cwd, workspaces);

  const state: CachedWorkspaceState = { root, tree, current };
  // oxlint-disable-next-line immutable-data -- cache mutation
  stateCache.set(cwd, state);
  return state;
}

/**
 * Reset the workspace state cache. Intended for testing only.
 */
export function resetWorkspaceCache(): void {
  // oxlint-disable-next-line immutable-data -- cache clear for testing
  stateCache.clear();
}
