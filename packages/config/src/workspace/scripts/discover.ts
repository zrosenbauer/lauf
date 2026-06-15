import * as path from 'pathe';
import { globSync } from 'tinyglobby';

import type { DiscoveredScript, Workspace, WorkspaceRoot } from '../types.ts';
import { dedupeByDeepestOwner } from './dedupe.ts';
import { filterToRoot } from './canonical.ts';
import { isValidPattern, stripScriptSuffix } from './patterns.ts';
import { qualifyScriptName } from './qualify.ts';

/**
 * Options for multi-workspace script discovery.
 */
export interface DiscoverAllOptions {
  /** When set, only discover in the workspace whose dir matches. */
  readonly workspaceDir?: string;
}

function filterWorkspaces(
  workspaces: readonly (readonly [Workspace, readonly string[]])[],
  wsDir: string | undefined,
): readonly (readonly [Workspace, readonly string[]])[] {
  if (wsDir) {
    return workspaces.filter(([ws]) => path.resolve(ws.dir) === path.resolve(wsDir));
  }
  return workspaces;
}

/**
 * Discover scripts within a single workspace.
 *
 * Globs the given patterns relative to the workspace directory, qualifies
 * the names, and clamps the result to the workspace root boundary.
 */
export function discoverWorkspaceScripts(
  workspace: Workspace,
  patterns: readonly string[],
  root: WorkspaceRoot,
): readonly DiscoveredScript[] {
  const validPatterns = patterns.filter((p) => isValidPattern(p));

  if (validPatterns.length === 0) {
    return [];
  }

  const files = globSync([...validPatterns], {
    cwd: workspace.dir,
    absolute: true,
    onlyFiles: true,
  });

  const scripts = files
    .map((filePath): DiscoveredScript => {
      const stem = stripScriptSuffix(path.basename(filePath, '.ts'));
      return {
        name: qualifyScriptName(workspace, stem),
        path: filePath,
        packageDir: workspace.dir,
        workspaceName: workspace.name,
      };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));

  return filterToRoot(scripts, root);
}

/**
 * Discover scripts across multiple workspaces.
 *
 * Each workspace uses its own patterns (from its own config). When
 * `workspaceDir` is provided, only that workspace is searched. The result
 * is deduped by deepest owner so a parent's broad glob can't emit the
 * same file under two names.
 */
export function discoverAllScripts(
  workspaces: readonly (readonly [Workspace, readonly string[]])[],
  root: WorkspaceRoot,
  options?: DiscoverAllOptions,
): readonly DiscoveredScript[] {
  const wsDir = options && options.workspaceDir;
  const filtered = filterWorkspaces(workspaces, wsDir);

  const allScripts = filtered.flatMap(([ws, patterns]) =>
    discoverWorkspaceScripts(ws, patterns, root),
  );

  return dedupeByDeepestOwner(allScripts).toSorted((a, b) => a.name.localeCompare(b.name));
}
