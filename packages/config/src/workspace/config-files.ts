import * as fs from 'node:fs';

import * as path from 'pathe';

import { attempt, isErr } from '../result.ts';

/**
 * Config file names lauf looks for, in priority order.
 * `lauf.config.ts` is preferred over `laufen.config.ts` in the same dir.
 */
export const CONFIG_FILE_NAMES: readonly string[] = ['lauf.config.ts', 'laufen.config.ts'];

/**
 * Derive the config name (`lauf` or `laufen`) from a config filename.
 */
export function configNameFromFile(fileName: string): 'lauf' | 'laufen' {
  if (fileName.startsWith('laufen')) {
    return 'laufen';
  }
  return 'lauf';
}

/**
 * Whether the config file at the given path is marked as a workspace root.
 *
 * Uses a lightweight `root\s*:\s*true` regex on the raw file content to
 * avoid full jiti import during root resolution.
 */
export function isRootConfig(configFile: string): boolean {
  const read = attempt(() => fs.readFileSync(configFile, 'utf-8'));
  if (isErr(read)) {
    return false;
  }
  return /root\s*:\s*true/.test(read.value);
}

/**
 * Whether a directory contains any lauf config (regardless of `root` flag).
 */
export function hasConfigFile(dir: string): boolean {
  return CONFIG_FILE_NAMES.some((name) => fs.existsSync(path.join(dir, name)));
}

/**
 * Find the first matching config filename in `dir`, or `undefined`.
 */
export function findConfigFileName(dir: string): string | undefined {
  return CONFIG_FILE_NAMES.find((name) => fs.existsSync(path.join(dir, name)));
}
