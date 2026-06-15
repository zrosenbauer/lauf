import * as fs from 'node:fs';

import type { Result } from '@laufen/config';
import { attempt } from '@laufen/config';

/**
 * Safely create directories recursively.
 */
export function safeMkdirSync(dirPath: string): Result<string | undefined> {
  return attempt(() => fs.mkdirSync(dirPath, { recursive: true }));
}
