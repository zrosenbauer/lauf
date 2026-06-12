import { loadAllLaufConfigs } from '../lib/config.ts';
import { fail, ok } from '../lib/result.ts';
import type { HandlerResult } from '../lib/result.ts';
import { getWorkspaceState } from '../lib/workspace/index.ts';
import { discoverAllScripts, findScript } from '../lib/workspace/scripts.ts';
import type { DiscoveredScript, Workspace } from '../lib/workspace/types.ts';
import { promptForScript } from './prompt.ts';

/**
 * Options for resolving a script target.
 */
interface ResolveScriptOptions {
  /** When set, scope interactive discovery to this workspace directory. */
  readonly workspaceDir?: string;
}

function resolvePatterns(
  loaded: { config: { scripts: string[] } } | undefined,
  fallback: string[],
): string[] {
  if (loaded) {
    return loaded.config.scripts;
  }
  return fallback;
}

/**
 * Resolve which script to target — by name if provided, or via interactive prompt.
 *
 * When a script name is provided:
 * - Bare names (no `/`) are resolved against the current workspace first
 * - Qualified names (`@apps/web/build`) search all workspaces
 *
 * When no script name is provided, prompts the user to select from discovered scripts.
 *
 * @param scriptName - Script name, or undefined to prompt
 * @param patterns - Glob patterns from the current workspace's config
 * @param options - Optional scoping options
 * @returns The resolved script, or a fail result if not found or cancelled
 */
// oxlint-disable-next-line max-lines-per-function
export async function resolveScript(
  scriptName: string | undefined,
  patterns: string[],
  options?: ResolveScriptOptions,
): Promise<HandlerResult<DiscoveredScript>> {
  const wsState = getWorkspaceState(process.cwd());
  const configs = await loadAllLaufConfigs(process.cwd());

  // Build workspace-pattern pairs from discovered workspaces + their configs
  const workspacePairs: (readonly [Workspace, readonly string[]])[] = wsState.tree.workspaces.map(
    (ws) => {
      const loaded = configs.find((c) => c.configDir === ws.dir);
      const wsPatterns = resolvePatterns(loaded, patterns);
      return [ws, wsPatterns] as const;
    },
  );

  if (scriptName) {
    const script = findScript(scriptName, wsState.current, workspacePairs, wsState.root);
    if (!script) {
      return fail({
        message: `Script not found: ${scriptName}`,
        hint: 'Run `lauf list` to see available scripts.',
      });
    }
    return ok(script);
  }

  // Interactive mode: scope to current workspace if possible
  const workspaceDir = options && options.workspaceDir;
  if (workspaceDir) {
    const scripts = discoverAllScripts(workspacePairs, wsState.root, { workspaceDir });
    return promptForScript(scripts);
  }

  const scripts = discoverAllScripts(workspacePairs, wsState.root);
  return promptForScript(scripts);
}
