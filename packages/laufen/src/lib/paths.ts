import { fileURLToPath } from 'node:url';

import * as path from 'pathe';

/**
 * Absolute path to the lauf package directory.
 */
export const LAUF_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
