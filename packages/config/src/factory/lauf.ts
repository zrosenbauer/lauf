import type { ArgDefs, ScriptConfig } from '@laufen/engine';

/**
 * Define a lauf script with typed arguments and a run function.
 *
 * Identity function — gives full type inference for arguments and the
 * run context. The actual execution happens in the engine.
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
