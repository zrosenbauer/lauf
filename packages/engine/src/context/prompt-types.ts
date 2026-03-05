import type { Result } from '../result.ts';

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
