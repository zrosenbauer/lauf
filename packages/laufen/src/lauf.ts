export { z } from 'zod';
export type {
  ArgDefs,
  DefaultLogger,
  EnvContext,
  EnvFn,
  FsHelpers,
  InferArgs,
  Logger,
  PromptCancelled,
  PromptOption,
  PromptResult,
  Prompts,
  ScriptConfig,
  ScriptContext,
  Spinner,
  WatchConfig,
  WatchContext,
} from '@laufen/engine';
export type { LaufConfig } from './lib/config.ts';
export { dotenv } from './lib/env.ts';
export { infisical } from './lib/infisical.ts';
export type { InfisicalConfig } from './lib/infisical.ts';

import type { ArgDefs, ScriptConfig } from '@laufen/engine';

import type { LaufConfig } from './lib/config.ts';

/**
 * Define a lauf script with typed arguments and a run function.
 *
 * This is the main entry point for script authors. It returns the config
 * as-is but provides full type inference for arguments and the run context.
 *
 * @param config - The script configuration
 * @returns The same configuration, fully typed
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
 * Define a lauf configuration file.
 *
 * Identity function that provides type inference for `lauf.config.ts`.
 *
 * @param config - The lauf configuration
 * @returns The same configuration, fully typed
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
