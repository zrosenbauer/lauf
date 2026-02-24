import { discoverScripts, findScript } from '../lib/discovery.ts';
import { fail, ok } from '../lib/result.ts';
import type { HandlerResult } from '../lib/result.ts';
import type { DiscoveredScript } from '../lib/types.ts';
import { promptForScript } from './prompt.ts';

/**
 * Resolve which script to target — by name if provided, or via interactive prompt.
 *
 * @param scriptName - Qualified script name (e.g. `@apps/api/generate-types`), or undefined to prompt
 * @param patterns - Glob patterns relative to each package directory
 * @returns The resolved script, or a fail result if not found or cancelled
 */
export function resolveScript(
  scriptName: string | undefined,
  patterns: string[],
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

  const scripts = discoverScripts(patterns);
  return promptForScript(scripts);
}
