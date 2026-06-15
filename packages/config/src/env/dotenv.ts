import * as fs from 'node:fs/promises';

import type { EnvContext, EnvFn } from '@laufen/engine';
import { parse } from 'dotenv';
import * as path from 'pathe';

import { attempt, attemptAsync, isErr } from '../result.ts';

function resolveFiles(files: readonly string[]): readonly string[] {
  if (files.length === 0) {
    return ['.env'];
  }
  return files;
}

function isFileNotFound(error: Error): boolean {
  return 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function readEnvFileEntries(
  filePath: string,
): Promise<readonly (readonly [string, string])[]> {
  const readResult = await attemptAsync(() => fs.readFile(filePath, 'utf-8'));
  if (isErr(readResult)) {
    if (isFileNotFound(readResult.error)) {
      return [];
    }
    throw readResult.error;
  }
  const parseResult = attempt(() => parse(readResult.value));
  if (isErr(parseResult)) {
    throw parseResult.error;
  }
  return Object.entries(parseResult.value);
}

/**
 * Load environment variables from one or more `.env` files.
 *
 * Returns an {@link EnvFn} that reads and merges the given files when
 * called. Missing files (ENOENT) are silently skipped; other read or
 * parse failures reject so the engine surfaces them. Later files
 * overwrite earlier ones. Paths resolve relative to `ctx.workspace`.
 *
 * @param files - `.env` paths (defaults to `['.env']`)
 */
export function dotenv(...files: readonly string[]): EnvFn {
  const resolved = resolveFiles(files);

  return async (ctx: EnvContext): Promise<Record<string, string>> => {
    const allEntries = await Promise.all(
      resolved.map((file) => readEnvFileEntries(path.resolve(ctx.workspace, file))),
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
