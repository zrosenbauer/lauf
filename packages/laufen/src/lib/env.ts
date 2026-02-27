import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse } from 'dotenv';
import { attempt } from 'es-toolkit';

/**
 * Load environment variables from one or more `.env` files.
 *
 * Files are parsed using `dotenv.parse()`. Missing files are silently skipped.
 * When multiple files are provided, later files override earlier ones (right-wins).
 *
 * @param envFile - Path or array of paths to `.env` files
 * @param baseDir - Base directory for resolving relative paths
 * @returns Merged environment variables from all parsed files
 */
/**
 * Normalize envFile to an array.
 */
function normalizeEnvFiles(envFile: string | readonly string[]): readonly string[] {
  if (typeof envFile === 'string') {
    return [envFile];
  }
  return envFile;
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

export function loadEnvFiles(
  envFile: string | readonly string[],
  baseDir: string,
): Record<string, string> {
  const files = normalizeEnvFiles(envFile);
  const allEntries = files.flatMap((file: string) =>
    readEnvFileEntries(path.resolve(baseDir, file)),
  );
  return Object.fromEntries(allEntries);
}

/**
 * Merge environment variable sources with right-wins priority.
 *
 * Merge order: envFile vars < config-level env < CLI --env flags.
 *
 * @param envFileVars - Variables loaded from .env files
 * @param configEnv - Variables from lauf.config.ts `env` property
 * @param cliEnv - Variables from CLI `--env KEY=VALUE` flags
 * @returns Merged environment record
 */
export function mergeEnvSources(
  envFileVars: Record<string, string>,
  configEnv: Record<string, string>,
  cliEnv: Record<string, string>,
): Record<string, string> {
  return { ...envFileVars, ...configEnv, ...cliEnv };
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe('loadEnvFiles', () => {
    it('returns empty record for non-existent file', () => {
      const result = loadEnvFiles('.env.nonexistent', '/tmp');
      expect(result).toEqual({});
    });

    it('returns empty record for empty array', () => {
      const result = loadEnvFiles([], '/tmp');
      expect(result).toEqual({});
    });
  });

  describe('mergeEnvSources', () => {
    it('merges with right-wins priority', () => {
      const result = mergeEnvSources(
        { A: 'from-file', B: 'from-file' },
        { B: 'from-config', C: 'from-config' },
        { C: 'from-cli', D: 'from-cli' },
      );
      expect(result).toEqual({
        A: 'from-file',
        B: 'from-config',
        C: 'from-cli',
        D: 'from-cli',
      });
    });

    it('returns empty record when all sources are empty', () => {
      const result = mergeEnvSources({}, {}, {});
      expect(result).toEqual({});
    });
  });
}
