/**
 * Shared utilities for lauf scripts.
 *
 * Import from scripts like: `import { formatDate } from '../lib/utils.js'`
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Format a date as YYYY-MM-DD.
 */
export const formatDate = (date: Date = new Date()): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Read and parse a JSON file.
 */
export const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
};

/**
 * Write data to a JSON file, creating parent directories if needed.
 */
export const writeJsonFile = async (filePath: string, data: unknown): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};
