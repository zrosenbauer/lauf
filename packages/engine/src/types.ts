import type { z } from 'zod';

import type { FsHelpers } from './context/fs-types.ts';
import type {
  PromptCancelled,
  PromptOption,
  PromptResult,
  Prompts,
} from './context/prompt-types.ts';

export type { FsHelpers, PromptCancelled, PromptOption, PromptResult, Prompts };

/** Context passed to env resolver functions for dynamic env generation. */
export interface EnvContext {
  readonly script: { readonly name: string; readonly path: string; readonly packageDir: string };
  readonly workspace: string;
}

/** A function that resolves environment variables from context. */
export type EnvFn = (ctx: EnvContext) => Record<string, string> | Promise<Record<string, string>>;

/**
 * Configuration for file watching in watch mode.
 */
export interface WatchConfig {
  /**
   * Glob patterns to watch, relative to the package directory.
   * Example: `['src/**\/*.ts', 'config/*.json']`
   */
  readonly patterns: readonly string[];

  /**
   * Milliseconds to debounce before rerunning after a change.
   * @default 100
   */
  readonly debounce?: number;

  /**
   * Additional glob patterns to ignore.
   */
  readonly ignored?: readonly string[];
}

/**
 * Watch-mode context passed to scripts on each run.
 */
export interface WatchContext {
  /**
   * Whether watch mode is active for this execution.
   */
  readonly enabled: boolean;

  /**
   * Files (relative to package directory) that triggered this rerun.
   * Empty on the initial run or when watch mode is disabled.
   */
  readonly changedFiles: readonly string[];

  /**
   * Glob patterns currently being watched.
   * Empty when watch mode is disabled.
   */
  readonly patterns: readonly string[];
}

/**
 * A record of named argument definitions using Zod schemas.
 */
export type ArgDefs = Record<string, z.ZodType>;

/**
 * Infer the resolved argument values from an {@link ArgDefs} record.
 */
export type InferArgs<T extends ArgDefs> = {
  readonly [K in keyof T]: z.infer<T[K]>;
};

/**
 * Base logger interface for structured terminal output.
 * Each method maps to the corresponding `@clack/prompts` `log.*` function.
 */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
  message(message: string): void;
}

/**
 * Extended logger with convenience methods beyond the base {@link Logger}.
 */
export interface DefaultLogger extends Logger {
  /**
   * Print one or more blank lines to the terminal.
   *
   * @param n - Number of blank lines to print (defaults to `1`)
   */
  newlines(n?: number): void;
}

/** Wrapper around `@clack/prompts` spinner for progress indication. */
export interface Spinner {
  start(message?: string): void;
  stop(message?: string): void;
  message(message?: string): void;
}

/**
 * Context passed to the script's `run` function.
 */
export interface ScriptContext<T extends ArgDefs> {
  /**
   * Parsed and validated arguments.
   */
  readonly args: InferArgs<T>;

  /**
   * Resolved environment variables available to this script.
   *
   * Merged from base (sandbox) < config env < script env < CLI --env flags.
   */
  readonly env: Readonly<Record<string, string>>;

  /**
   * Directory paths organized by namespace.
   */
  readonly dir: {
    /** Absolute path to the workspace root (git repository root) */
    readonly root: string;
    /** Absolute path to the package containing this script */
    readonly package: string;
    /** Absolute path to the workspace package where lauf was invoked */
    readonly workspace: string;
  };

  /**
   * Absolute path to the monorepo root.
   * @deprecated Use `ctx.dir.root` instead
   */
  readonly root: string;

  /**
   * Absolute path to the package containing this script.
   * @deprecated Use `ctx.dir.package` instead
   */
  readonly packageDir: string;

  /**
   * The script's qualified name (e.g. `@apps/api/generate-openapi`).
   */
  readonly name: string;

  /**
   * Styled terminal logger backed by `@clack/prompts`.
   */
  readonly logger: DefaultLogger;

  /**
   * Progress spinner backed by `@clack/prompts`.
   */
  readonly spinner: Spinner;

  /**
   * Interactive prompt utilities.
   */
  readonly prompts: Prompts;

  /**
   * Filesystem helper utilities scoped to the package directory.
   */
  readonly fs: FsHelpers;

  /**
   * Import a package declared in the `packages` field with full type safety.
   *
   * TypeScript automatically infers the correct type from the package name:
   * @example
   * ```ts
   * const { rimraf } = await ctx.import('rimraf'); // typed as typeof import('rimraf')
   * const chalk = await ctx.import('chalk');       // typed as typeof import('chalk')
   * ```
   *
   * Types are auto-generated in `.lauf/packages.d.ts` based on declared packages.
   */
  import<K extends keyof LaufPackages.Registry & string>(
    packageName: K,
  ): Promise<LaufPackages.Registry[K]>;

  /**
   * Watch-mode context describing what triggered this run.
   */
  readonly watch: WatchContext;
}

/**
 * Configuration object returned by {@link lauf}.
 *
 * @typeParam T - The argument definitions record
 */
export interface ScriptConfig<T extends ArgDefs = Record<string, never>> {
  /**
   * Human-readable description of what the script does.
   */
  description: string;

  /** Argument definitions using Zod schemas. Keys become CLI flag names. Omit for no-arg scripts. */
  args?: T;

  /**
   * Script-level environment variables.
   *
   * Accepts a static record or a function that receives an {@link EnvContext}
   * and returns a record (sync or async). Merged after config-level env
   * but before CLI --env flags.
   */
  env?: Record<string, string> | EnvFn;

  /**
   * npm package dependencies to install for this script.
   *
   * Packages are installed to a cache directory (`~/.lauf/packages/<hash>/`)
   * and made available via `ctx.import()` with full type safety.
   *
   * @example
   * ```ts
   * packages: {
   *   'rimraf': '^6.0.0',
   *   'execa': '^9.0.0',
   * }
   *
   * // In run():
   * const { rimraf } = await ctx.import('rimraf');
   * const { execa } = await ctx.import('execa');
   * ```
   */
  packages?: Record<string, string>;

  /**
   * File watch configuration for this script.
   *
   * When specified and `--watch` is passed to `lauf run`, files matching
   * these patterns (relative to the package directory) will trigger a rerun.
   * Merged with any global watch config from `lauf.config.ts`.
   */
  watch?: WatchConfig;

  /**
   * The script's entry point, called with the validated context.
   *
   * Returning `void` or `0` signals success.
   * Returning a non-zero number signals failure and is used as the exit code.
   */
  run: (ctx: ScriptContext<T>) => void | number | Promise<void | number>;
}

/**
 * Minimal script descriptor used by the engine for execution.
 *
 * The CLI's `DiscoveredScript` extends/satisfies this interface.
 */
export interface ScriptTarget {
  /**
   * Qualified name: <package-name>/<script-stem>
   */
  readonly name: string;
  /**
   * Absolute path to the script file
   */
  readonly path: string;
  /**
   * Absolute path to the containing package
   */
  readonly packageDir: string;
}

/**
 * Result of executing a script.
 */
export interface RunResult {
  /**
   * Process exit code (0 = success).
   */
  readonly exitCode: number;
  /**
   * The script that was executed.
   */
  readonly script: ScriptTarget;
}
