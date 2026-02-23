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
