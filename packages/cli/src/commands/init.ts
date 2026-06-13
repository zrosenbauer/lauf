import * as fs from 'node:fs';

import { command } from '@kidd-cli/core';
import { findNearestWorkspace, resolveRoot } from '@laufen/config/workspace';
import { attempt } from 'massaman/control';
import * as path from 'pathe';

import { configTemplate } from '../templates/config.ts';

const MANIFEST_FILE = 'lauf.config.ts';

/**
 * `lauf init` — write a `lauf.config.ts` in the current directory if
 * no reachable config exists upward from `cwd`.
 */
export default command({
  description: 'Initialize lauf in the current package',
  handler: (ctx) => {
    const cwd = process.cwd();

    const root = resolveRoot(cwd);
    const existing = findNearestWorkspace(cwd, root);
    if (existing) {
      ctx.fail(`Already initialized: config found at ${ctx.colors.dim(existing.configFile)}`);
    }

    const filePath = path.join(cwd, MANIFEST_FILE);

    const result = attempt(() =>
      fs.writeFileSync(filePath, configTemplate(), { encoding: 'utf-8', flag: 'wx' }),
    );
    if (!result.ok) {
      const writeError = result.error as NodeJS.ErrnoException;
      if (writeError.code === 'EEXIST') {
        ctx.fail(`Already initialized: ${MANIFEST_FILE} already exists`);
      }
      ctx.fail(`Failed to write ${MANIFEST_FILE}: ${writeError.message}`);
    }

    ctx.log.success(`Initialized lauf at ${ctx.colors.cyan(MANIFEST_FILE)}`);
  },
});
