import type { LaufConfig } from '../config/types.ts';

/**
 * Define a lauf configuration file. Identity function — gives type
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
