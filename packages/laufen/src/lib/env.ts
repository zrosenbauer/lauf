import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse } from 'dotenv';
import { attempt } from 'es-toolkit';

/**
 * Normalize a file path input to an array.
 */
function normalizeFiles(files: string | readonly string[]): readonly string[] {
  if (typeof files === 'string') {
    return [files];
  }
  return files;
}

/**
 * Check whether an error represents a missing file (ENOENT).
 */
function isFileNotFound(error: Error): boolean {
  return 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

/**
 * Read a single env file and return its entries, or empty array on failure.
 *
 * Missing files (ENOENT) are silently skipped. Other read errors
 * (permissions, IO failures) emit a warning so they are not silently lost.
 */
function readEnvFileEntries(filePath: string): readonly (readonly [string, string])[] {
  const [readError, content] = attempt<string, Error>(() => fs.readFileSync(filePath, 'utf-8'));
  if (readError) {
    if (!isFileNotFound(readError)) {
      console.warn(`Warning: Failed to read env file "${filePath}": ${readError.message}`);
    }
    return [];
  }
  if (content === null) {
    return [];
  }
  return Object.entries(parse(content));
}

/**
 * Load environment variables from one or more `.env` files.
 *
 * Files are parsed using `dotenv.parse()`. Missing files are silently skipped.
 * When multiple files are provided, later files override earlier ones (right-wins).
 * Paths are resolved relative to `process.cwd()`.
 *
 * @param files - Path or array of paths to `.env` files
 * @returns Merged environment variables from all parsed files
 */
export function dotenv(files: string | readonly string[]): Record<string, string> {
  const normalized = normalizeFiles(files);
  const cwd = process.cwd();
  const allEntries = normalized.flatMap((file: string) =>
    readEnvFileEntries(path.resolve(cwd, file)),
  );
  return Object.fromEntries(allEntries);
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe('dotenv', () => {
    it('returns empty record for non-existent file', () => {
      const result = dotenv('.env.nonexistent');
      expect(result).toEqual({});
    });

    it('returns empty record for empty array', () => {
      const result = dotenv([]);
      expect(result).toEqual({});
    });

    it('accepts a single string path', () => {
      const result = dotenv('.env.does-not-exist');
      expect(result).toEqual({});
    });
  });
}
