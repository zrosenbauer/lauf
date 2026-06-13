import { attempt } from 'es-toolkit';
import type { z } from 'zod';

import type { Result } from '../result.ts';

/**
 * Safely parse a JSON string and validate the result against a Zod schema.
 *
 * Validation failures are returned as `[Error, null]`.
 *
 * @param value - Raw JSON string to parse
 * @param schema - Zod schema to validate the parsed result
 * @returns Tuple of `[Error, null]` on failure, or `[null, T]` on success
 */
export function safeParseJSON<T>(value: string, schema: z.ZodType<T>): Result<T>;
/**
 * Safely parse a JSON string without schema validation.
 *
 * Returns the parsed value as `unknown` since no runtime validation is performed.
 *
 * @param value - Raw JSON string to parse
 * @returns Tuple of `[Error, null]` on failure, or `[null, unknown]` on success
 */
export function safeParseJSON(value: string): Result<unknown>;
export function safeParseJSON<T>(
  value: string,
  schema?: z.ZodType<T>,
): Result<T> | Result<unknown> {
  // es-toolkit's attempt returns [Error | null, null] -- narrow to [Error, null]
  // since attempt always produces a non-null Error on failure
  const [parseError, parsed] = attempt(() => JSON.parse(value) as unknown) as
    | [Error, null]
    | [null, unknown];

  if (parseError) {
    return [parseError, null];
  }

  if (schema === undefined) {
    return [null, parsed];
  }

  const validation = schema.safeParse(parsed);
  if (!validation.success) {
    return [new Error(`JSON validation failed: ${validation.error.message}`), null];
  }

  return [null, validation.data];
}
