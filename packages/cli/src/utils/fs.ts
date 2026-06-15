import * as fs from 'node:fs';

import { attempt, type Result } from 'massaman/control';

/**
 * Safely create directories recursively.
 */
export function safeMkdirSync(dirPath: string): Result<string | undefined> {
  return attempt(() => fs.mkdirSync(dirPath, { recursive: true }));
}
