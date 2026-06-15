import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { attempt, type Result } from 'massaman/control';
import { dirname, join } from 'pathe';

export const BLUEPRINTS = ['clean', 'copy'] as const;

export type BlueprintName = (typeof BLUEPRINTS)[number];

const blueprintsDir = join(dirname(fileURLToPath(import.meta.url)), 'blueprints');

/**
 * Read a blueprint template by name. Returns a Result so callers can
 * surface filesystem failures cleanly.
 */
export function getBlueprintTemplate(name: BlueprintName): Result<string> {
  return attempt(() => readFileSync(join(blueprintsDir, `${name}.ts`), 'utf-8'));
}

export function isBlueprintName(value: string): value is BlueprintName {
  return (BLUEPRINTS as readonly string[]).includes(value);
}
