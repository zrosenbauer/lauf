import type { ArgDefs, ScriptConfig } from '@laufen/engine';

import type { LaufConfig } from './config.ts';

/**
 * Define a lauf script with typed arguments and a run function.
 *
 * Identity function that gives full type inference for arguments and
 * the run context.
 *
 * @example
 * ```ts
 * import { lauf, z } from 'laufen'
 *
 * export default lauf({
 *   description: 'Generate TypeScript types from templates',
 *   args: {
 *     outDir: z.string().default('./src/generated'),
 *     verbose: z.boolean().default(false),
 *   },
 *   async run(ctx) {
 *     ctx.logger.info(`Generating types to ${ctx.args.outDir}`)
 *   },
 * })
 * ```
 */
export function lauf<T extends ArgDefs = Record<string, never>>(
  config: ScriptConfig<T>,
): ScriptConfig<T> {
  return config;
}

/**
 * Define a lauf configuration file. Identity function that gives type
 * inference for `lauf.config.ts`.
 *
 * @example
 * ```ts
 * import { defineConfig } from 'laufen'
 *
 * export default defineConfig({
 *   scripts: ['scripts/*.ts'],
 *   logger: myLogger,
 * })
 * ```
 */
export function defineConfig(config: LaufConfig): LaufConfig {
  return config;
}
