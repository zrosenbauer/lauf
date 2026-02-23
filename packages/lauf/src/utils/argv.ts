import * as p from '@clack/prompts';

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Check whether a key is safe (not a prototype pollution vector).
 */
function isSafeKey(key: string): boolean {
  return !BLOCKED_KEYS.has(key);
}

// oxlint-disable-next-line security/detect-unsafe-regex -- bounded decimal pattern, no backtracking risk
const STRICT_NUMBER_RE = /^-?\d+(\.\d+)?$/;

/**
 * Coerce a string value to a primitive type.
 *
 * Attempts boolean and strict decimal number coercion, falls back to string.
 * Rejects hex strings (0x...) and scientific notation (1e10) to avoid
 * unexpected conversions.
 *
 * @param value - Raw string value from CLI
 * @returns Coerced boolean, number, or original string
 * @private
 */
function coerce(value: string): unknown {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }

  if (STRICT_NUMBER_RE.test(value)) {
    return Number(value);
  }

  return value;
}

/**
 * Parse raw CLI argv into a key-value record.
 *
 * Supports `--key=value`, `--key value`, and `--flag` (boolean true).
 * Uses recursion instead of stateful reduction. Warns when positional
 * arguments are found and filters out prototype pollution keys.
 *
 * @param argv - Raw argument strings
 * @returns Parsed key-value record
 * @private
 */
// oxlint-disable-next-line max-lines-per-function
export function parseRawArgs(argv: readonly string[]): Record<string, unknown> {
  const parse = (
    remaining: readonly string[],
    acc: Record<string, unknown>,
    positionals: readonly string[],
  ): { readonly result: Record<string, unknown>; readonly positionals: readonly string[] } => {
    const arg = remaining[0];
    if (arg === undefined) {
      return { result: acc, positionals };
    }

    const rest = remaining.slice(1);

    if (!arg.startsWith('--')) {
      return parse(rest, acc, [...positionals, arg]);
    }

    const withoutDashes = arg.slice(2);
    const eqIdx = withoutDashes.indexOf('=');

    if (eqIdx !== -1) {
      // --key=value
      const key = withoutDashes.slice(0, eqIdx);
      const value = withoutDashes.slice(eqIdx + 1);
      if (isSafeKey(key)) {
        return parse(rest, { ...acc, [key]: coerce(value) }, positionals);
      }
      return parse(rest, acc, positionals);
    }

    const next = rest[0];
    if (next !== undefined && !next.startsWith('--')) {
      // --key value
      if (isSafeKey(withoutDashes)) {
        return parse(rest.slice(1), { ...acc, [withoutDashes]: coerce(next) }, positionals);
      }
      return parse(rest.slice(1), acc, positionals);
    }

    // --flag (boolean)
    if (isSafeKey(withoutDashes)) {
      return parse(rest, { ...acc, [withoutDashes]: true }, positionals);
    }
    return parse(rest, acc, positionals);
  };

  const initial: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const { result, positionals } = parse(argv, initial, []);

  if (positionals.length > 0) {
    p.log.warn(
      `Positional arguments were ignored: ${positionals.join(', ')}. Use --key value syntax instead.`,
    );
  }

  return result;
}

/**
 * Extract raw argv entries after the given script name.
 *
 * Only searches after index 2 (skipping the node binary and script path)
 * to avoid matching wrong argv entries.
 *
 * @param name - Script name to search for in `process.argv`
 * @returns Argv entries following the script name, or empty array if not found
 * @private
 */
export function sliceArgvAfter(name: string): readonly string[] {
  // Slice from index 3 to skip: [0] node binary, [1] script path, [2] Clerc subcommand ("run")
  const scriptArgs = process.argv.slice(3);
  const idx = scriptArgs.findIndex((arg) => arg === name);
  if (idx === -1) {
    return [];
  }
  return scriptArgs.slice(idx + 1);
}
