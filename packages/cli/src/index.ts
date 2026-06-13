#!/usr/bin/env node
// oxlint-disable import/max-dependencies
import { fileURLToPath } from 'node:url';

import { cli } from '@kidd-cli/core';
import * as path from 'pathe';

import blueprint from './commands/blueprint.ts';
import create from './commands/create.ts';
import info from './commands/info.ts';
import init from './commands/init.ts';
import list from './commands/list.ts';
import run from './commands/run.ts';
import { workspaceMiddleware } from './middleware/workspace.ts';
import { readPackageJSON } from './utils/cli.ts';

const pkgDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [pkgError, pkg] = readPackageJSON(pkgDir);

if (pkgError || pkg === null || !pkg.version) {
  process.stderr.write(
    'Fatal error, unable to execute lauf, please log an issue on github: https://github.com/zrosenbauer/lauf/issues\n',
  );
  process.exit(1);
}

await cli({
  name: 'lauf',
  version: pkg.version,
  description: 'Typed script runner for monorepos',
  middleware: [workspaceMiddleware],
  commands: {
    init,
    list,
    info,
    run,
    create,
    blueprint,
  },
});
