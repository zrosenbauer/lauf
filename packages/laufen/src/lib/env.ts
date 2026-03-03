import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { EnvContext, EnvFn } from '@laufen/engine';
import { parse } from 'dotenv';
import { attemptAsync } from 'es-toolkit';

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
async function readEnvFileEntries(
  filePath: string,
): Promise<readonly (readonly [string, string])[]> {
  const [readError, content] = await attemptAsync<string, Error>(() =>
    fs.readFile(filePath, 'utf-8'),
  );
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
 * Returns an {@link EnvFn} that, when called, reads and merges the given files.
 * Files are parsed using `dotenv.parse()`. Missing files are silently skipped.
 * When multiple files are provided, later files override earlier ones (right-wins).
 * Paths are resolved relative to `ctx.workspace`.
 *
 * @param files - Paths to `.env` files (defaults to `['.env']` when none provided)
 * @returns An EnvFn that resolves the merged environment variables
 */
export function dotenv(...files: readonly string[]): EnvFn {
  const resolved = files.length === 0 ? ['.env'] : files; // oxlint-disable-line no-ternary -- simple default

  return async (ctx: EnvContext): Promise<Record<string, string>> => {
    const allEntries = await Promise.all(
      resolved.map((file: string) => readEnvFileEntries(path.resolve(ctx.workspace, file))),
    );
    return Object.fromEntries(allEntries.flat());
  };
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  const ctx: EnvContext = {
    script: { name: 'test', path: '/test.ts', packageDir: '/pkg' },
    workspace: '/nonexistent-workspace',
  };

  describe('dotenv', () => {
    it('returns an EnvFn', () => {
      const fn = dotenv();
      expect(typeof fn).toBe('function');
    });

    it('returns empty record for non-existent file', async () => {
      const fn = dotenv('.env.nonexistent');
      const result = await fn(ctx);
      expect(result).toEqual({});
    });

    it('returns empty record when no files match', async () => {
      const fn = dotenv('.env.a', '.env.b');
      const result = await fn(ctx);
      expect(result).toEqual({});
    });

    it('defaults to .env when called with no arguments', async () => {
      const fn = dotenv();
      const result = await fn(ctx);
      expect(result).toEqual({});
    });
  });
}
