#!/usr/bin/env node
// oxlint-disable import/max-dependencies

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as p from '@clack/prompts';
import { Clerc, completionsPlugin, helpPlugin, versionPlugin } from 'clerc';
import pc from 'picocolors';

import handleBlueprint from './handlers/blueprint.ts';
import handleCreate from './handlers/create.ts';
import handleInfo from './handlers/info.ts';
import handleInit from './handlers/init.ts';
import handleList from './handlers/list.ts';
import handleRun from './handlers/run.ts';
import { markScriptHelpRequested } from './state/script-help.ts';
import { errorHint, readPackageJSON, safeParseError } from './utils/cli.ts';
import { rewriteHelpArgv } from './utils/help-rewrite.ts';

const pkgDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [pkgError, pkg] = readPackageJSON(pkgDir);

if (pkgError || pkg === null || !pkg.version) {
  p.log.error(
    'Fatal error, unable to execute lauf, please log an issue on github: https://github.com/zrosenbauer/lauf/issues',
  );
  process.exit(1);
}

const { argv: rewrittenArgv, scriptHelpRequested } = rewriteHelpArgv(process.argv.slice(2));

if (scriptHelpRequested) {
  markScriptHelpRequested();
}

Clerc.create()
  .name('lauf')
  .scriptName('lauf')
  .description('Typed script runner for monorepos')
  .version(pkg.version)
  .use(helpPlugin())
  .use(versionPlugin())
  .use(completionsPlugin())
  .errorHandler((err: unknown) => {
    const message = safeParseError(err);
    p.log.error(message);
    const hint = errorHint(err);
    if (hint) {
      p.log.message(pc.dim(hint));
    }
    process.exit(1);
  })
  .command('init', 'Initialize lauf in the current package')
  .on('init', handleInit)
  .command('list', 'List all available scripts', {
    flags: {
      all: {
        type: Boolean,
        description: 'Discover scripts from all nested configs',
        alias: 'a',
      },
      filter: {
        type: String,
        description: 'Filter packages by name glob (e.g. "@apps/*")',
        alias: 'f',
      },
    },
  })
  .on('list', handleList)
  .command('info', 'Show info for a script', {
    parameters: ['[script]'],
  })
  .on('info', handleInfo)
  .command('run', 'Run a script', {
    parameters: ['[script]'],
  })
  .on('run', handleRun)
  .command('create', 'Create a new script', {
    parameters: ['[name]'],
    flags: {
      dir: {
        type: String,
        description: 'Target directory (relative to monorepo root)',
      },
    },
  })
  .on('create', handleCreate)
  .command('blueprint', 'Scaffold a pre-built script blueprint', {
    parameters: ['[name]'],
    flags: {
      dir: {
        type: String,
        description: 'Target directory (relative to monorepo root)',
      },
    },
  })
  .on('blueprint', handleBlueprint)
  .parse([...rewrittenArgv]);
