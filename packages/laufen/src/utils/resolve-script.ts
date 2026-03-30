import { discoverScripts, findScript, reattributeScripts } from '../lib/discovery.ts';
import { fail, ok } from '../lib/result.ts';
import type { HandlerResult } from '../lib/result.ts';
import type { DiscoveredScript } from '../lib/types.ts';
import { promptForScript } from './prompt.ts';

/**
 * Options for resolving a script target.
 */
interface ResolveScriptOptions {
  /** When set, scope interactive discovery to this package directory. */
  readonly packageDir?: string;
}

/**
 * Resolve which script to target — by name if provided, or via interactive prompt.
 *
 * @param scriptName - Qualified script name (e.g. `@apps/api/generate-types`), or undefined to prompt
 * @param patterns - Glob patterns relative to each package directory
 * @param options - Optional scoping options
 * @returns The resolved script, or a fail result if not found or cancelled
 */
export function resolveScript(
  scriptName: string | undefined,
  patterns: string[],
  options?: ResolveScriptOptions,
): Promise<HandlerResult<DiscoveredScript>> {
  if (scriptName) {
    const script = findScript(scriptName, patterns);
    if (!script) {
      return Promise.resolve(
        fail({
          message: `Script not found: ${scriptName}`,
          hint: 'Run `lauf list` to see available scripts.',
        }),
      );
    }
    return Promise.resolve(ok(script));
  }

  const packageDir = options && options.packageDir;
  if (packageDir) {
    const scripts = reattributeScripts(discoverScripts(patterns, { packageDir }));
    const scoped = scripts.filter((s) => s.packageDir === packageDir);
    return promptForScript(scoped);
  }
  return promptForScript(reattributeScripts(discoverScripts(patterns)));
}
