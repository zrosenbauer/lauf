import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Available blueprint names.
 */
export const BLUEPRINTS = ['clean', 'copy'] as const;

export type BlueprintName = (typeof BLUEPRINTS)[number];

const blueprintsDir = join(dirname(fileURLToPath(import.meta.url)), 'blueprints');

/**
 * Get the content of a blueprint template.
 */
export function getBlueprintTemplate(name: BlueprintName): string {
  return readFileSync(join(blueprintsDir, `${name}.lauf.ts`), 'utf-8');
}

/**
 * Check if a string is a valid blueprint name.
 */
export function isBlueprintName(value: string): value is BlueprintName {
  return (BLUEPRINTS as readonly string[]).includes(value);
}
