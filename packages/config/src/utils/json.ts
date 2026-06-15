import type { Result } from 'massaman/control';
import { attempt, err, ok } from 'massaman/control';
import type { z } from 'zod';

/**
 * Safely parse a JSON string and validate the result against a Zod schema.
 */
export function safeParseJSON<T>(value: string, schema: z.ZodType<T>): Result<T>;
/**
 * Safely parse a JSON string without schema validation.
 */
export function safeParseJSON(value: string): Result<unknown>;
export function safeParseJSON<T>(
  value: string,
  schema?: z.ZodType<T>,
): Result<T> | Result<unknown> {
  const parsed = attempt(() => JSON.parse(value) as unknown);
  if (!parsed.ok) {
    return parsed;
  }

  if (schema === undefined) {
    return parsed;
  }

  const validation = schema.safeParse(parsed.value);
  if (!validation.success) {
    return err(new Error(`JSON validation failed: ${validation.error.message}`));
  }

  return ok(validation.data);
}
