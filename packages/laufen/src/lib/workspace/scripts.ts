import * as fs from 'node:fs';
import * as path from 'node:path';

import { attempt } from 'es-toolkit';
import fg from 'fast-glob';

import type { DiscoveredScript, Workspace, WorkspaceRoot } from './types.ts';

/**
 * Sentinel workspace name used for the root workspace.
 */
export const ROOT_WORKSPACE_NAME = '<root>';

/**
 * Build a qualified script name from a workspace name and stem.
 *
 * Root workspace scripts are returned as bare stems (e.g. `setup`),
 * while child workspace scripts include the workspace prefix (e.g. `@apps/api/setup`).
 *
 * @param workspace - The workspace (checks `isRoot`)
 * @param stem - The script stem (filename without extension)
 * @returns The qualified script name
 */
export function qualifyScriptName(workspace: Workspace, stem: string): string {
  if (workspace.isRoot) {
    return stem;
  }
  return `${workspace.name}/${stem}`;
}

/**
 * Validate that a glob pattern is safe for workspace-scoped discovery.
 *
 * Rejects patterns that start with `..` (parent traversal) or `/` (absolute path),
 * which could escape the workspace boundary.
 */
function isValidPattern(pattern: string): boolean {
  /* v8 ignore next 3 -- defensive security guard; callers never produce null bytes */
  if (pattern.includes('\0')) {
    return false;
  }
  if (pattern.startsWith('..') || pattern.startsWith('/') || path.isAbsolute(pattern)) {
    return false;
  }
  const normalized = path.normalize(pattern);
  if (normalized.startsWith('..') || normalized.startsWith('/') || path.isAbsolute(normalized)) {
    return false;
  }
  return true;
}

/**
 * Strip `.lauf` or `.laufen` suffix from a script stem.
 */
function stripScriptSuffix(stem: string): string {
  if (stem.endsWith('.laufen')) {
    return stem.slice(0, -'.laufen'.length);
  }
  if (stem.endsWith('.lauf')) {
    return stem.slice(0, -'.lauf'.length);
  }
  return stem;
}

/**
 * Resolve a path canonically (following symlinks), falling back to `path.resolve`
 * if the target does not exist or `realpathSync` throws.
 */
function canonicalize(target: string): string {
  const [error, real] = attempt(() => fs.realpathSync(target));
  if (error || real === null) {
    return path.resolve(target);
  }
  return real;
}

/**
 * Filter discovered scripts to those within the workspace root boundary.
 *
 * Uses canonical (symlink-resolved) paths on both sides so a symlinked
 * script can't escape the workspace via an indirect path.
 */
function filterToRoot(
  scripts: readonly DiscoveredScript[],
  root: WorkspaceRoot,
): readonly DiscoveredScript[] {
  const normalizedRoot = canonicalize(root.dir);
  return scripts.filter((script) => {
    const resolved = canonicalize(script.path);
    return resolved === normalizedRoot || resolved.startsWith(`${normalizedRoot}${path.sep}`);
  });
}

/**
 * Dedupe discovered scripts by canonical path, keeping the entry whose
 * `packageDir` is the deepest (most-specific) workspace that owns the file.
 *
 * Prevents a parent workspace's broad glob (e.g. `**\/*.lauf.ts`) from
 * emitting a script that actually belongs to a nested workspace, which
 * would otherwise produce duplicate entries under two qualified names.
 */
export function dedupeByDeepestOwner(
  scripts: readonly DiscoveredScript[],
): readonly DiscoveredScript[] {
  const ranked = scripts.map((script) => {
    const canonicalPath = canonicalize(script.path);
    const canonicalDir = canonicalize(script.packageDir);
    return {
      script,
      canonicalPath,
      depth: canonicalDir.split(path.sep).length,
    };
  });

  // Sort shallowest-first so the deepest owner wins via Object.fromEntries'
  // last-write semantics. Single pass over inputs; one canonicalize() per side.
  const byCanonicalPath = Object.fromEntries(
    ranked
      .toSorted((a, b) => a.depth - b.depth)
      .map(({ canonicalPath, script }) => [canonicalPath, script] as const),
  );

  return Object.values(byCanonicalPath);
}

/**
 * Discover scripts within a single workspace.
 *
 * Globs the given patterns relative to the workspace directory and
 * builds qualified script names.
 *
 * @param workspace - The workspace to discover scripts in
 * @param patterns - Glob patterns relative to the workspace directory
 * @param root - The workspace root boundary (for path validation)
 * @returns Discovered scripts, sorted by name
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

  const files = fg.sync([...validPatterns], {
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
 * Extract the bare stem from a (possibly qualified) script name.
 */
function extractStem(name: string): string {
  if (name.includes('/')) {
    return name.slice(name.lastIndexOf('/') + 1);
  }
  return name;
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
 * Options for multi-workspace script discovery.
 */
interface DiscoverAllOptions {
  /** When set, only discover in the workspace whose dir matches */
  readonly workspaceDir?: string;
}

/**
 * Discover scripts across multiple workspaces.
 *
 * Each workspace uses its own set of patterns (from its own config).
 * When `workspaceDir` is provided, only the matching workspace is searched.
 *
 * @param workspaces - Workspaces to search, each paired with its script patterns
 * @param root - The workspace root boundary
 * @param options - Optional filtering
 * @returns All discovered scripts, sorted by name
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

/**
 * Find a script by name across workspaces.
 *
 * When `scriptName` is a bare name (no `/`), searches the `currentWorkspace`
 * first. If not found there, searches all workspaces for a root-level match.
 *
 * When `scriptName` is qualified (contains `/`), searches all workspaces
 * for an exact match.
 *
 * @param scriptName - Script name to find (bare or qualified)
 * @param currentWorkspace - The workspace the user is currently in
 * @param workspaces - All workspaces paired with their patterns
 * @param root - The workspace root boundary
 * @returns The matching script, or `undefined`
 */
export function findScript(
  scriptName: string,
  currentWorkspace: Workspace | undefined,
  workspaces: readonly (readonly [Workspace, readonly string[]])[],
  root: WorkspaceRoot,
): DiscoveredScript | undefined {
  const allScripts = discoverAllScripts(workspaces, root);

  // Qualified name (contains `/`) — exact match across all workspaces
  if (scriptName.includes('/')) {
    return allScripts.find((s) => s.name === scriptName);
  }

  // Bare name — prefer current workspace, then fall back to any match
  if (currentWorkspace) {
    const currentScripts = allScripts.filter(
      (s) => path.resolve(s.packageDir) === path.resolve(currentWorkspace.dir),
    );
    const localMatch = currentScripts.find((s) => extractStem(s.name) === scriptName);
    if (localMatch) {
      return localMatch;
    }
  }

  // Fall back to matching by bare name (root scripts have bare names)
  return allScripts.find((s) => s.name === scriptName);
}
