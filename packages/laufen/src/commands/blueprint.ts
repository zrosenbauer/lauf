// oxlint-disable import/max-dependencies
import * as fs from 'node:fs';

import type { CommandContext } from '@kidd-cli/core';
import { command } from '@kidd-cli/core';
import { attempt } from 'es-toolkit';
import * as path from 'pathe';
import { z } from 'zod';

import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { assertOk } from '../lib/result.ts';
import { BLUEPRINTS, getBlueprintTemplate, isBlueprintName } from '../templates/blueprint.ts';
import { readPackageJSON, safeParseError } from '../utils/cli.ts';
import { safeMkdirSync } from '../utils/fs.ts';

const positionals = z.object({
  name: z.string().min(1).optional().describe('Blueprint name (omit to list available)'),
});

const options = z.object({
  dir: z.string().optional().describe('Target directory (relative to monorepo root)'),
});

/**
 * `lauf blueprint [name]` — list blueprints or scaffold one into the workspace.
 */
export default command({
  description: 'Scaffold a pre-built script blueprint',
  positionals,
  options,
  // oxlint-disable-next-line max-lines-per-function
  handler: async (ctx) => {
    const blueprintName = ctx.args.name;

    if (!blueprintName) {
      listBlueprints(ctx);
      return;
    }

    if (!isBlueprintName(blueprintName)) {
      ctx.fail(`Unknown blueprint: ${blueprintName}. Available: ${BLUEPRINTS.join(', ')}`);
      return;
    }

    const configResult = await safeLoadLaufConfigWithMeta(process.cwd());
    assertOk(configResult, ctx.fail, 'Failed to load lauf config');
    const loaded = configResult[1];

    const targetDir = resolveTargetDir(ctx.args.dir, loaded.config.scripts, loaded.configDir);
    const normalizedTarget = path.normalize(targetDir);

    if (
      normalizedTarget !== loaded.configDir &&
      !normalizedTarget.startsWith(`${loaded.configDir}${path.sep}`)
    ) {
      ctx.fail(`Target directory escapes config root: ${normalizedTarget}`);
    }

    const fileName = `${blueprintName}.ts`;
    const filePath = path.join(targetDir, fileName);

    const resolvedFilePath = path.resolve(filePath);
    const normalizedTargetForFile = path.resolve(targetDir);
    if (!resolvedFilePath.startsWith(`${normalizedTargetForFile}${path.sep}`)) {
      ctx.fail(`File path escapes target directory: ${resolvedFilePath}`);
    }

    const [mkdirError] = safeMkdirSync(targetDir);
    if (mkdirError) {
      ctx.fail(`Failed to create directory ${targetDir}: ${mkdirError}`);
    }

    const templateResult = getBlueprintTemplate(blueprintName);
    assertOk(templateResult, ctx.fail, `Failed to load blueprint template "${blueprintName}"`);
    const template = templateResult[1];

    const [writeError] = attempt(() =>
      fs.writeFileSync(filePath, template, { encoding: 'utf-8', flag: 'wx' }),
    );
    if (writeError) {
      const nodeError = writeError as NodeJS.ErrnoException;
      if (nodeError.code === 'EEXIST') {
        ctx.fail(`File already exists: ${filePath}`);
      }
      ctx.fail(`Failed to write ${filePath}: ${safeParseError(writeError)}`);
    }

    const [, pkg] = readPackageJSON(loaded.configDir);
    const packageName = (pkg && pkg.name) || path.basename(loaded.configDir);

    const relative = path.relative(loaded.configDir, filePath);
    ctx.log.success(`Created ${relative}`);
    ctx.log.message(ctx.colors.dim(`Run it with: lauf run ${packageName}/${blueprintName}`));
  },
});

function listBlueprints(ctx: CommandContext): void {
  ctx.log.message('Available blueprints:');
  ctx.log.message('');
  BLUEPRINTS.forEach((name) => {
    ctx.log.message(ctx.colors.cyan(`  ${name}`));
  });
  ctx.log.message('');
  ctx.log.message(ctx.colors.dim('Usage: lauf blueprint <name>'));
}

function resolveTargetDir(dir: string | undefined, patterns: string[], configDir: string): string {
  if (dir) {
    if (path.isAbsolute(dir)) {
      return path.normalize(dir);
    }
    return path.resolve(configDir, dir);
  }
  const firstPattern = patterns[0];
  if (!firstPattern) {
    return path.resolve(configDir, 'scripts');
  }
  const baseDir = resolveGlobBase(firstPattern);
  if (baseDir === '.') {
    return path.resolve(configDir, 'scripts');
  }
  return path.resolve(configDir, baseDir);
}

function resolveGlobBase(pattern: string): string {
  const wildcardIndex = pattern.search(/[*?[\]{}]/);
  if (wildcardIndex === -1) {
    return path.dirname(pattern);
  }
  const staticPrefix = pattern.slice(0, wildcardIndex);
  if (staticPrefix.endsWith('/') || staticPrefix.endsWith(path.sep)) {
    return staticPrefix.slice(0, -1);
  }
  return path.dirname(staticPrefix);
}
