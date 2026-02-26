import type { z } from 'zod';

/**
 * Safely extract a human-readable message from an unknown caught value.
 *
 * Handles `Error` instances, plain strings, and arbitrary values
 * without throwing.
 */
export function safeParseError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return String(err);
}

/**
 * Format Zod validation issues into a single displayable string.
 *
 * @param issues - Zod issue array from a failed `safeParse`
 * @returns Multi-line string with each issue on its own line
 */
export function formatArgErrors(issues: readonly z.ZodIssue[]): string {
  const lines = issues.map((issue) => `  --${issue.path.join('.')}: ${issue.message}`);
  return `Invalid arguments:\n${lines.join('\n')}`;
}
