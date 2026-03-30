/**
 * How the workspace root was determined.
 *
 * - `config` — a `lauf.config.ts` with `root: true` was found
 * - `git` — a `.git` entry was found (directory or file for submodules)
 * - `cap` — neither was found within the search depth limit
 */
export type RootSource = 'config' | 'git' | 'cap';

/**
 * The resolved workspace root boundary.
 */
export interface WorkspaceRoot {
  readonly dir: string;
  readonly source: RootSource;
}

/**
 * A workspace: a directory containing a `lauf.config.ts` or `laufen.config.ts`.
 */
export interface Workspace {
  /** Display name: package.json `name` or directory basename */
  readonly name: string;
  /** Absolute path to the workspace directory */
  readonly dir: string;
  /** Absolute path to the config file */
  readonly configFile: string;
  /** Config file variant */
  readonly configName: 'lauf' | 'laufen';
  /** Whether this workspace is the root (`root: true` in config) */
  readonly isRoot: boolean;
}

/**
 * The full workspace tree: root boundary + all discovered workspaces.
 */
export interface WorkspaceTree {
  readonly root: WorkspaceRoot;
  readonly workspaces: readonly Workspace[];
}

/**
 * A script discovered during workspace scanning.
 *
 * Satisfies the engine's `ScriptTarget` interface via `packageDir`.
 */
export interface DiscoveredScript {
  /** Qualified name: `<workspace-name>/<stem>` or bare `<stem>` for root */
  readonly name: string;
  /** Absolute path to the script file */
  readonly path: string;
  /** Absolute path to the owning workspace directory */
  readonly packageDir: string;
  /** Workspace name from which this script was discovered */
  readonly workspaceName: string;
}
