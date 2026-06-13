/**
 * Workspace discovery surface used by the CLI.
 *
 * Not part of the user-facing API — exposed as a sub-export for downstream
 * tooling (laufen CLI commands, tests) that needs to walk the workspace.
 */
export type {
  CachedWorkspaceState,
  DiscoveredScript,
  Workspace,
  WorkspaceRoot,
  WorkspaceTree,
} from './workspace/index.ts';
export {
  ROOT_WORKSPACE_NAME,
  dedupeByDeepestOwner,
  discoverAllScripts,
  discoverWorkspaces,
  discoverWorkspaceScripts,
  findNearestWorkspace,
  findScript,
  getWorkspaceState,
  qualifyScriptName,
  resetWorkspaceCache,
  resolveCurrentWorkspace,
  resolveRoot,
} from './workspace/index.ts';
export { collectAncestors, walkUp } from './workspace/index.ts';
