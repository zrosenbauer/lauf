import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the lauf package directory.
 */
export const LAUF_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
