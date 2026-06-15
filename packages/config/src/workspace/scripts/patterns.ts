import * as path from 'pathe';

/**
 * Validate that a glob pattern is safe for workspace-scoped discovery.
 *
 * Rejects patterns that traverse out of the workspace (`..`, absolute
 * paths) or contain null bytes.
 */
export function isValidPattern(pattern: string): boolean {
  /* v8 ignore next 3 -- defensive security guard; callers never produce null bytes */
  if (pattern.includes('\0')) {
    return false;
  }
  if (pattern.startsWith('..') || pattern.startsWith('/') || path.isAbsolute(pattern)) {
    return false;
  }
  const normalized = path.normalize(pattern);
  if (normalized.startsWith('..') || normalized.startsWith('/') || path.isAbsolute(normalized)) {
    return false;
  }
  return true;
}

/**
 * Strip the `.lauf` or `.laufen` suffix from a script stem.
 */
export function stripScriptSuffix(stem: string): string {
  if (stem.endsWith('.laufen')) {
    return stem.slice(0, -'.laufen'.length);
  }
  if (stem.endsWith('.lauf')) {
    return stem.slice(0, -'.lauf'.length);
  }
  return stem;
}
