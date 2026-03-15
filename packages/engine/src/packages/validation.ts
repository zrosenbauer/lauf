import { z } from 'zod';

import type { Result } from '../result.ts';

const packagesSchema = z.record(z.string(), z.string());

/**
 * Validate that a packages field is a plain object with string keys and values.
 *
 * Uses Zod schema validation to ensure the value is a record of string keys
 * to string values. Returns an empty record when undefined.
 */
export function validatePackages(packages: unknown): Result<Record<string, string>> {
  if (packages === undefined) {
    return [null, {}];
  }

  const parsed = packagesSchema.safeParse(packages);
  if (!parsed.success) {
    return [new Error(parsed.error.message), null];
  }

  return [null, parsed.data];
}
