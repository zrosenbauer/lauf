import type { z } from 'zod';

import type { Result } from './result.ts';

/** Context passed to env resolver functions for dynamic env generation. */
export interface EnvContext {
  readonly script: { readonly name: string; readonly path: string; readonly packageDir: string };
  readonly workspace: string;
}

/** A function that resolves environment variables from context. */
export type EnvFn = (ctx: EnvContext) => Record<string, string> | Promise<Record<string, string>>;

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
 *
 * Each method maps to the corresponding `@clack/prompts` `log.*` function.
 */
export interface Logger {
  /**
   * Log an informational message.
   */
  info(message: string): void;

  /**
   * Log a warning message.
   */
  warn(message: string): void;

  /**
   * Log an error message.
   */
  error(message: string): void;

  /**
   * Log a success message.
   */
  success(message: string): void;

  /**
   * Log a plain message.
   */
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

/**
 * Wrapper around `@clack/prompts` spinner for progress indication.
 */
export interface Spinner {
  /**
   * Start the spinner with an optional message.
   */
  start(message?: string): void;

  /**
   * Stop the spinner with an optional final message.
   */
  stop(message?: string): void;

  /**
   * Update the spinner's message while it is running.
   */
  message(message?: string): void;
}

/**
 * A selectable option for {@link Prompts.select}, {@link Prompts.multiselect},
 * and other list-based prompts.
 */
export interface PromptOption<Value> {
  readonly value: Value;
  readonly label: string;
  readonly hint?: string;
  readonly disabled?: boolean;
}

/**
 * Sentinel indicating the user cancelled a prompt.
 */
export interface PromptCancelled {
  readonly cancelled: true;
}

/**
 * Result of an interactive prompt: either the resolved value or a
 * cancellation sentinel.  Follows the same `[error, value]` convention
 * as {@link Result}.
 */
export type PromptResult<T> = Result<T, PromptCancelled>;

/**
 * Interactive prompt utilities backed by `@clack/prompts`.
 *
 * Each method wraps the corresponding clack prompt and handles
 * cancellation, returning a {@link PromptResult} tuple instead of
 * throwing or returning a cancel symbol.
 */
export interface Prompts {
  /**
   * Prompt the user for text input.
   */
  text(opts: {
    readonly message: string;
    readonly placeholder?: string;
    readonly defaultValue?: string;
    readonly initialValue?: string;
    readonly validate?: (value: string | undefined) => string | Error | undefined;
  }): Promise<PromptResult<string>>;

  /**
   * Prompt the user for a yes/no confirmation.
   */
  confirm(opts: {
    readonly message: string;
    readonly active?: string;
    readonly inactive?: string;
    readonly initialValue?: boolean;
  }): Promise<PromptResult<boolean>>;

  /**
   * Prompt the user to select a single value from a list.
   */
  select<Value>(opts: {
    readonly message: string;
    readonly options: ReadonlyArray<PromptOption<Value>>;
    readonly initialValue?: Value;
    readonly maxItems?: number;
  }): Promise<PromptResult<Value>>;

  /**
   * Prompt the user to select multiple values from a list.
   */
  multiselect<Value>(opts: {
    readonly message: string;
    readonly options: ReadonlyArray<PromptOption<Value>>;
    readonly initialValues?: ReadonlyArray<Value>;
    readonly maxItems?: number;
    readonly required?: boolean;
  }): Promise<PromptResult<ReadonlyArray<Value>>>;

  /**
   * Prompt the user for a password (masked input).
   */
  password(opts: {
    readonly message: string;
    readonly mask?: string;
    readonly validate?: (value: string | undefined) => string | Error | undefined;
  }): Promise<PromptResult<string>>;

  /**
   * Prompt the user for a file-system path.
   */
  path(opts: {
    readonly message: string;
    readonly root?: string;
    readonly directory?: boolean;
    readonly initialValue?: string;
    readonly validate?: (value: string | undefined) => string | Error | undefined;
  }): Promise<PromptResult<string>>;
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
   * Absolute path to the monorepo root.
   */
  readonly root: string;

  /**
   * Absolute path to the package containing this script.
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
}

/**
 * Configuration object returned by {@link lauf}.
 *
 * @typeParam T - The argument definitions record
 */
export interface ScriptConfig<T extends ArgDefs = ArgDefs> {
  /**
   * Human-readable description of what the script does.
   */
  description: string;

  /**
   * Argument definitions using Zod schemas. Keys become CLI flag names.
   */
  args: T;

  /**
   * Script-level environment variables.
   *
   * Accepts a static record or a function that receives an {@link EnvContext}
   * and returns a record (sync or async). Merged after config-level env
   * but before CLI --env flags.
   */
  env?: Record<string, string> | EnvFn;

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
