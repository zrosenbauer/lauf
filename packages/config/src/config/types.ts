import type { DefaultLogger, EnvFn, WatchConfig } from '@laufen/engine';

/**
 * The `env` field on a config or script — a static record or a function
 * resolved at run time with the script's EnvContext.
 */
export type EnvValue = Record<string, string> | EnvFn;

/**
 * The shape `lauf.config.ts` files declare via `defineConfig({...})`.
 * Every field is optional; missing fields fall back to {@link DEFAULTS}.
 */
export interface LaufConfig {
  /**
   * Mark this config as the workspace root boundary. When `true`,
   * workspace discovery stops here instead of walking up to `.git`.
   */
  root?: boolean;
  scripts?: string[];
  logger?: DefaultLogger;
  spinner?: boolean;
  sandbox?: boolean;
  env?: EnvValue;
  /**
   * Workspace-level package dependencies available to all scripts.
   * Script-level packages take precedence on version conflicts.
   */
  packages?: Record<string, string>;
  watch?: WatchConfig;
}

/**
 * A `LaufConfig` after c12 has merged user fields over {@link DEFAULTS}.
 * Every field is materialized — no `?` optionals.
 */
export interface ResolvedLaufConfig {
  root: boolean;
  scripts: string[];
  logger: DefaultLogger | undefined;
  spinner: boolean;
  sandbox: boolean;
  env: EnvValue;
  packages: Record<string, string>;
  watch: WatchConfig | undefined;
}

/**
 * A loaded config plus metadata about where it was found.
 *
 * `configFile` is `undefined` and `configDir` falls back to `cwd` when no
 * `lauf.config.ts` is discovered on the upward walk.
 */
export interface LoadedConfig {
  readonly config: ResolvedLaufConfig;
  readonly configFile: string | undefined;
  readonly configDir: string;
}
