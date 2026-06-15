/**
 * Result primitives for `@laufen/config`.
 *
 * Thin re-export of `massaman/control` so the package has one canonical
 * Result shape — `{ ok, value, error }` discriminated objects — used
 * end-to-end internally and across the boundary to `@laufen/cli`.
 *
 *   const result = await attemptAsync(() => loadConfig(cwd))
 *   if (!result.ok) {
 *     return ctx.fail(`Failed: ${result.error.message}`)
 *   }
 *   const config = result.value
 */
export type { Err, Ok, Result } from 'massaman/control';
export { attempt, attemptAsync, err, isErr, isOk, ok, unwrap } from 'massaman/control';
