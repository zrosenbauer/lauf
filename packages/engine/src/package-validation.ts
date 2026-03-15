import type { Result } from './result.ts';

/**
 * Check if a value is a plain object (not Map, Set, Array, etc.).
 *
 * @param value - Value to check
 * @returns True if value is a plain object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Validate packages field structure and content.
 *
 * Ensures packages is a plain object with string keys and values.
 *
 * @param packages - Packages field to validate
 * @returns Result containing validated packages or error
 */
export function validatePackages(packages: unknown): Result<Record<string, string>> {
  if (packages === undefined) {
    return [null, {}];
  }

  if (!isPlainObject(packages)) {
    return [new Error('packages field must be a plain object'), null];
  }

  const invalidEntries = Object.entries(packages).filter(
    ([key, value]) => typeof key !== 'string' || typeof value !== 'string',
  );

  if (invalidEntries.length > 0) {
    return [new Error('All package keys and values must be strings'), null];
  }

  return [null, packages as Record<string, string>];
}
