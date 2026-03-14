// oxlint-disable import/max-dependencies
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as p from '@clack/prompts';
import { attempt } from 'es-toolkit';
import pc from 'picocolors';
import { z } from 'zod';

import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { defineHandler } from '../lib/handler.ts';
import { fail, ok } from '../lib/result.ts';
import { BLUEPRINTS, getBlueprintTemplate, isBlueprintName } from '../templates/blueprint.ts';
import { readPackageJSON, safeParseError } from '../utils/cli.ts';
import { safeMkdirSync } from '../utils/fs.ts';

const blueprintParams = z.object({
  parameters: z.object({ name: z.string().min(1).optional() }),
  flags: z.object({ dir: z.string().optional() }),
});

/**
 * Handler for the `lauf blueprint [name]` CLI command.
 *
 * Lists available blueprints or scaffolds a blueprint script
 * into the target directory.
 */
export default defineHandler({
  parameters: blueprintParams,
  // oxlint-disable-next-line max-lines-per-function
  handler: async (ctx) => {
    const blueprintName = ctx.parameters.name;

    if (!blueprintName) {
      return listBlueprints();
    }

    if (!isBlueprintName(blueprintName)) {
      return fail({
        message: `Unknown blueprint: ${blueprintName}. Available: ${BLUEPRINTS.join(', ')}`,
      });
    }

    const { dir } = ctx.flags;

    const [configError, loaded] = await safeLoadLaufConfigWithMeta(process.cwd());
    if (configError) {
      return fail({ message: `Failed to load lauf config: ${safeParseError(configError)}` });
    }

    const targetDir = resolveTargetDir(dir, loaded.config.scripts, loaded.configDir);
    const normalizedTarget = path.normalize(targetDir);

    if (
      normalizedTarget !== loaded.configDir &&
      !normalizedTarget.startsWith(`${loaded.configDir}${path.sep}`)
    ) {
      return fail({
        message: `Target directory escapes config root: ${normalizedTarget}`,
      });
    }

    const fileName = `${blueprintName}.lauf.ts`;
    const filePath = path.join(targetDir, fileName);

    const resolvedFilePath = path.resolve(filePath);
    const normalizedTargetForFile = path.resolve(targetDir);
    /* v8 ignore next 5 -- defensive guard */
    if (!resolvedFilePath.startsWith(`${normalizedTargetForFile}${path.sep}`)) {
      return fail({
        message: `File path escapes target directory: ${resolvedFilePath}`,
      });
    }

    const [mkdirError] = safeMkdirSync(targetDir);
    if (mkdirError) {
      return fail({ message: `Failed to create directory ${targetDir}: ${mkdirError}` });
    }

    const template = getBlueprintTemplate(blueprintName);

    const [writeError] = safeWriteFileExclusive(filePath, template);
    if (writeError) {
      if (writeError instanceof Error) {
        const nodeError = writeError as NodeJS.ErrnoException;
        if (nodeError.code === 'EEXIST') {
          return fail({ message: `File already exists: ${filePath}` });
        }
      }
      return fail({ message: `Failed to write ${filePath}: ${writeError}` });
    }

    const [, pkg] = readPackageJSON(loaded.configDir);
    /* v8 ignore next -- fallback branch */
    const packageName = (pkg && pkg.name) || path.basename(loaded.configDir);

    const relative = path.relative(loaded.configDir, filePath);
    p.log.success(`Created ${relative}`);
    p.log.message(pc.dim(`Run it with: lauf run ${packageName}/${blueprintName}`));

    return ok();
  },
});

/**
 * List all available blueprints.
 */
function listBlueprints() {
  p.log.message('Available blueprints:');
  p.log.message('');
  BLUEPRINTS.forEach((name) => {
    p.log.message(pc.cyan(`  ${name}`));
  });
  p.log.message('');
  p.log.message(pc.dim('Usage: lauf blueprint <name>'));
  return ok();
}

/**
 * Resolve the target directory for a blueprint script.
 */
function resolveTargetDir(dir: string | undefined, patterns: string[], configDir: string): string {
  if (dir) {
    if (path.isAbsolute(dir)) {
      return path.normalize(dir);
    }
    return path.resolve(configDir, dir);
  }
  const firstPattern = patterns[0];
  if (firstPattern) {
    return path.resolve(configDir, path.dirname(firstPattern));
  }
  return path.resolve(configDir, 'scripts');
}

/**
 * Atomically write a file, failing if it already exists (wx flag).
 */
function safeWriteFileExclusive(filePath: string, content: string): [unknown, null] | [null, void] {
  return attempt(() => fs.writeFileSync(filePath, content, { encoding: 'utf-8', flag: 'wx' }));
}
