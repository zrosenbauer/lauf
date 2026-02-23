import * as fs from 'node:fs';
import * as path from 'node:path';

import { InvalidParametersError, MissingRequiredFlagError, NoSuchCommandError } from 'clerc';
import { attempt } from 'es-toolkit';
import type { PackageJson } from 'type-fest';
import type { z } from 'zod';

import type { Result } from '../lib/result.ts';
import { safeParseJSON } from './json.ts';

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

/**
 * Return a contextual hint for known Clerc error types.
 *
 * @param err - The caught error value
 * @returns A hint string, or `undefined` if no hint applies
 */
export function errorHint(err: unknown): string | undefined {
  if (err instanceof InvalidParametersError || err instanceof MissingRequiredFlagError) {
    return 'Run `lauf <command> --help` for usage information.';
  }
  if (err instanceof NoSuchCommandError) {
    return 'Run `lauf --help` to see available commands.';
  }
  return undefined;
}

/**
 * Read and parse a `package.json` file from the given directory.
 *
 * @param dir - Absolute path to the directory containing `package.json`
 * @returns A tuple of `[error, null]` or `[null, PackageJson]`
 */
export function readPackageJSON(dir: string): Result<PackageJson> {
  const filePath = path.join(dir, 'package.json');
  const [readError, content] = attempt<string, Error>(() => fs.readFileSync(filePath, 'utf-8'));
  if (readError) {
    return [readError, null];
  }

  const [parseError, parsed] = safeParseJSON(content);
  if (parseError) {
    return [parseError, null];
  }

  return [null, parsed as PackageJson];
}
