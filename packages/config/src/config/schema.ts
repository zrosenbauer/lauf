import type { WatchConfig } from '@laufen/engine';
import type { Result } from 'massaman/control';
import { err, ok } from 'massaman/control';
import { z } from 'zod';

import type { ResolvedLaufConfig } from './types.ts';

const loggerSchema = z
  .object({
    info: z.function(),
    warn: z.function(),
    error: z.function(),
    success: z.function(),
    message: z.function(),
    newlines: z.function(),
  })
  .optional();

const watchConfigSchema: z.ZodType<WatchConfig | undefined> = z
  .object({
    patterns: z.array(z.string().min(1)).min(1),
    debounce: z.number().int().nonnegative().optional(),
    ignored: z.array(z.string().min(1)).optional(),
  })
  .optional();

/**
 * Zod schema that validates a fully-resolved lauf config. The `env` field
 * is a union of `Record<string, string>` and a function, so we use
 * `z.union` to model the two shapes.
 */
export const resolvedLaufConfigSchema: z.ZodType<ResolvedLaufConfig> = z.object({
  root: z.boolean(),
  scripts: z.array(z.string()),
  logger: loggerSchema,
  spinner: z.boolean(),
  sandbox: z.boolean(),
  env: z.union([z.record(z.string(), z.string()), z.function()]),
  packages: z.record(z.string(), z.string()),
  watch: watchConfigSchema,
}) as z.ZodType<ResolvedLaufConfig>;

/**
 * Default values applied by c12 when fields are missing from user configs.
 */
export const DEFAULTS: ResolvedLaufConfig = {
  root: false,
  scripts: ['scripts/*.ts'],
  logger: undefined,
  spinner: true,
  sandbox: true,
  env: {},
  packages: {},
  watch: undefined,
};

/**
 * Validate a raw value against the resolved config schema.
 */
export function validateConfig(raw: unknown): Result<ResolvedLaufConfig> {
  const parsed = resolvedLaufConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return err(new Error(`Invalid lauf config: ${parsed.error.message}`));
  }
  return ok(parsed.data);
}
