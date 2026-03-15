import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { attempt } from 'es-toolkit';

/**
 * Available blueprint names.
 */
export const BLUEPRINTS = ['clean', 'copy'] as const;

export type BlueprintName = (typeof BLUEPRINTS)[number];

const blueprintsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'blueprints');

/**
 * Get the content of a blueprint template as a Result tuple.
 * Returns [error, null] on failure, [null, content] on success.
 */
export function getBlueprintTemplate(name: BlueprintName) {
  return attempt(() => readFileSync(join(blueprintsDir, `${name}.lauf.ts`), 'utf-8'));
}

/**
 * Check if a string is a valid blueprint name.
 */
export function isBlueprintName(value: string): value is BlueprintName {
  return (BLUEPRINTS as readonly string[]).includes(value);
}
