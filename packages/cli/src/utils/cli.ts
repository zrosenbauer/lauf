import * as fs from 'node:fs';

import { attempt, err, isErr, ok, type Result, safeParseJSON } from '@laufen/config';
import * as path from 'pathe';
import type { PackageJson } from 'type-fest';

/**
 * Safely extract a human-readable message from an unknown caught value.
 */
export function safeParseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Read and parse a `package.json` file from the given directory.
 */
export function readPackageJSON(dir: string): Result<PackageJson> {
  const filePath = path.join(dir, 'package.json');
  const read = attempt(() => fs.readFileSync(filePath, 'utf-8'));
  if (isErr(read)) {
    return err(read.error);
  }

  const parsed = safeParseJSON(read.value);
  if (isErr(parsed)) {
    return err(parsed.error);
  }

  return ok(parsed.value as PackageJson);
}
