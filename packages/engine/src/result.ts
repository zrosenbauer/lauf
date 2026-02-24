/**
 * Generic discriminated tuple: success or failure.
 *
 * @typeParam T - The success value type
 * @typeParam E - The error type (defaults to `Error`)
 */
export type Result<T, E = Error> = readonly [E, null] | readonly [null, T];
