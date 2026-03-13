import { pathToFileURL } from 'node:url';

import { attemptAsync } from 'es-toolkit';

import type { Result } from './result.ts';
import type { ArgDefs, ScriptConfig } from './types.ts';

/**
 * Extract package definitions from a script's config.
 *
 * Dynamically imports the unbundled script file and reads the `packages` field
 * from the default export.
 *
 * @param scriptPath - Absolute path to the script file
 * @returns Result containing package definitions or empty record
 */
export async function extractPackages(scriptPath: string): Promise<Result<Record<string, string>>> {
  const scriptUrl = pathToFileURL(scriptPath).href;

  const [importError, mod] = await attemptAsync(
    () => import(scriptUrl) as Promise<{ default: ScriptConfig<ArgDefs> }>,
  );

  if (importError || mod === null) {
    return [new Error(`Failed to import script: ${String(importError)}`), null];
  }

  const config = mod.default;

  if (!config || typeof config !== 'object') {
    return [new Error('Script does not export a valid config object'), null];
  }

  if (config.packages === undefined) {
    return [null, {}];
  }

  if (
    typeof config.packages !== 'object' ||
    config.packages === null ||
    Array.isArray(config.packages)
  ) {
    return [new Error('packages field must be a plain object'), null];
  }

  const invalidEntries = Object.entries(config.packages).filter(
    ([key, value]) => typeof key !== 'string' || typeof value !== 'string',
  );

  if (invalidEntries.length > 0) {
    return [new Error('All package keys and values must be strings'), null];
  }

  return [null, config.packages];
}
