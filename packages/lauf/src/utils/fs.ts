import * as fs from 'node:fs';

import { attempt } from 'es-toolkit';

/**
 * Safely create directories recursively. Returns `[error, null]` or `[null, string | undefined]`.
 */
export function safeMkdirSync(dirPath: string): [unknown, null] | [null, string | undefined] {
  return attempt(() => fs.mkdirSync(dirPath, { recursive: true }));
}
