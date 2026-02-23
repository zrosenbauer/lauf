import * as fs from 'node:fs';
import * as path from 'node:path';

import * as p from '@clack/prompts';
import { attempt } from 'es-toolkit';
import pc from 'picocolors';

import { findConfigFile } from '../lib/config-discovery.ts';
import { defineHandler } from '../lib/handler.ts';
import { fail, ok } from '../lib/result.ts';
import { configTemplate } from '../templates/config.ts';

const MANIFEST_FILE = 'lauf.config.ts';

/**
 * Handler for the `lauf init` CLI command.
 *
 * Initializes lauf in the current directory by writing a config file.
 * Checks for an existing reachable config via upward search first.
 */
export default defineHandler(() => {
  const cwd = process.cwd();

  // Check if there's already a reachable config
  const existing = findConfigFile(cwd);
  if (existing) {
    return fail({
      message: `Already initialized: config found at ${pc.dim(existing.configFile)}`,
    });
  }

  const filePath = path.join(cwd, MANIFEST_FILE);

  const [writeError] = attempt(() =>
    fs.writeFileSync(filePath, configTemplate(), { encoding: 'utf-8', flag: 'wx' }),
  );
  if (writeError) {
    if (writeError instanceof Error) {
      const nodeError = writeError as NodeJS.ErrnoException;
      if (nodeError.code === 'EEXIST') {
        return fail({ message: `Already initialized: ${MANIFEST_FILE} already exists` });
      }
    }
    return fail({ message: `Failed to write ${MANIFEST_FILE}: ${writeError}` });
  }

  p.log.success(`Initialized lauf at ${pc.cyan(MANIFEST_FILE)}`);

  return ok();
});
