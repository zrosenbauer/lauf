import { pathToFileURL } from 'node:url';

import { attemptAsync } from 'es-toolkit';
import { z } from 'zod';

import type { Result } from '../result.ts';
import { validatePackages } from './validation.ts';

const scriptConfigSchema = z.object({
  packages: z.unknown().optional(),
});

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
    () => import(scriptUrl) as Promise<{ default: unknown }>,
  );

  if (importError || mod === null) {
    return [new Error(`Failed to import script: ${String(importError)}`), null];
  }

  const parsedConfig = scriptConfigSchema.safeParse(mod.default);
  if (!parsedConfig.success) {
    return [new Error('Script does not export a valid config object'), null];
  }

  return validatePackages(parsedConfig.data.packages);
}
