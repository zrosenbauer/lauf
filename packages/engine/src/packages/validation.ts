import type { Result } from '../result.ts';

/**
 * Check if a value is a plain object (not a Map, Set, class instance, etc.).
 *
 * A plain object is one created with object literal syntax `{}` or `new Object()`,
 * having `Object.prototype` or `null` as its prototype.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Validate that a packages field is a plain object with string keys and values.
 *
 * Rejects non-plain objects (Map, Set, class instances) and validates
 * that all keys and values are strings.
 */
export function validatePackages(packages: unknown): Result<Record<string, string>> {
  if (packages === undefined) {
    return [null, {}];
  }

  if (!isPlainRecord(packages)) {
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
