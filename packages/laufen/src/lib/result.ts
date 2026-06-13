/**
 * Structured error returned by handlers instead of throwing or calling process.exit.
 */
export interface HandlerError {
  readonly message: string;
  readonly hint?: string;
  readonly exitCode?: number;
}

/**
 * Generic discriminated tuple: success or failure.
 *
 * @typeParam T - The success value type
 * @typeParam E - The error type (defaults to `Error`)
 */
export type Result<T, E = Error> = readonly [E, null] | readonly [null, T];

/**
 * Discriminated tuple: success or failure for handler operations.
 */
export type HandlerResult<T = void> = Result<T, HandlerError>;

/**
 * Construct a success result.
 */
export function ok(): HandlerResult<void>;
export function ok<T>(value: T): HandlerResult<T>;
export function ok<T>(value?: T): HandlerResult<T> {
  return [null, value as T] as const;
}

/**
 * Construct a failure result.
 */
export function fail(error: HandlerError): HandlerResult<never> {
  return [error, null] as const;
}

/**
 * Assertion helper: narrow a `Result` tuple to its `[null, T]` branch by
 * calling `ctx.fail(...)` on the error path. Used inside kidd command
 * handlers to flatten the `if (err) { ctx.fail(...) }` boilerplate while
 * still letting TS narrow the value side.
 */
export function assertOk<T>(
  result: readonly [unknown, null] | readonly [null, T],
  bail: (message: string) => never,
  prefix: string,
): asserts result is readonly [null, T] {
  if (result[0]) {
    bail(`${prefix}: ${stringifyError(result[0])}`);
  }
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
