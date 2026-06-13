import * as fs from 'node:fs';

import { attempt } from 'es-toolkit';
import * as path from 'pathe';
import type { PackageJson } from 'type-fest';

import type { Result } from '../lib/result.ts';
import { safeParseJSON } from './json.ts';

/**
 * Safely extract a human-readable message from an unknown caught value.
 * Handles `Error` instances, plain strings, and arbitrary values.
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
 * Read and parse a `package.json` file from the given directory.
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
