export type { CachedWorkspaceState } from './cache.ts';
export { getWorkspaceState, resetWorkspaceCache } from './cache.ts';
export { discoverWorkspaces, findNearestWorkspace } from './discovery.ts';
export { resolveCurrentWorkspace } from './resolve.ts';
export { resolveRoot } from './root.ts';
export {
  ROOT_WORKSPACE_NAME,
  dedupeByDeepestOwner,
  discoverAllScripts,
  discoverWorkspaceScripts,
  findScript,
  qualifyScriptName,
} from './scripts.ts';
export type { DiscoveredScript, Workspace, WorkspaceRoot, WorkspaceTree } from './types.ts';
export { collectAncestors, walkUp } from './walk.ts';
