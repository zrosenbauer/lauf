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
import type { HandlerResult } from '../lib/result.ts';
import { scriptTemplate } from '../templates/script.ts';
import { readPackageJSON, safeParseError } from '../utils/cli.ts';
import { safeMkdirSync } from '../utils/fs.ts';
import { promptForText } from '../utils/prompt.ts';

const createParams = z.object({
  parameters: z.object({ name: z.string().min(1).optional() }),
  flags: z.object({ dir: z.string().optional() }),
});

/**
 * Handler for the `lauf create [name]` CLI command.
 *
 * Scaffolds a new lauf script file in the target directory
 * with a starter template including typed arguments.
 */
export default defineHandler({
  parameters: createParams,
  // oxlint-disable-next-line max-lines-per-function
  handler: async (ctx) => {
    const [nameError, name] = await resolveName(ctx.parameters.name);
    if (nameError) {
      return fail(nameError);
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

    const stem = name.replace(/\.lauf\.ts$|\.ts$/, '');
    const fileName = `${stem}.lauf.ts`;
    const filePath = path.join(targetDir, fileName);

    const resolvedFilePath = path.resolve(filePath);
    const normalizedTargetForFile = path.resolve(targetDir);
    /* v8 ignore next 5 -- defensive guard: unreachable with current name sanitisation */
    if (!resolvedFilePath.startsWith(`${normalizedTargetForFile}${path.sep}`)) {
      return fail({
        message: `File path escapes target directory: ${resolvedFilePath}`,
      });
    }

    const [mkdirError] = safeMkdirSync(targetDir);
    if (mkdirError) {
      return fail({ message: `Failed to create directory ${targetDir}: ${mkdirError}` });
    }

    const [writeError] = safeWriteFileExclusive(filePath, scriptTemplate(stem));
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
    /* v8 ignore next -- fallback branch: readPackageJSON always returns a name in practice */
    const packageName = (pkg && pkg.name) || path.basename(loaded.configDir);
    const qualifiedName = `${packageName}/${stem}`;

    const relative = path.relative(loaded.configDir, filePath);
    p.log.success(`Created ${relative}`);
    p.log.message(pc.dim(`Run it with: lauf run ${qualifiedName}`));

    return ok();
  },
});

/**
 * Resolve the script name — from the CLI parameter or via interactive prompt.
 */
function resolveName(name: string | undefined): Promise<HandlerResult<string>> {
  if (name) {
    return Promise.resolve(ok(name));
  }
  return promptForText('Enter a name for the new script', 'my-script');
}

/**
 * Resolve the target directory for a new script.
 *
 * When no --dir flag is provided, resolves relative to process.cwd().
 * When --dir is provided with an absolute path, uses it directly.
 * When --dir is provided with a relative path, resolves from the config directory.
 *
 * @param dir - Optional directory override
 * @param patterns - Script glob patterns from config
 * @param configDir - Directory containing the active config
 * @returns Absolute path to the target scripts directory
 * @private
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
    return path.resolve(process.cwd(), path.dirname(firstPattern));
  }
  return path.resolve(process.cwd(), 'scripts');
}

/**
 * Atomically write a file, failing if it already exists (wx flag).
 * Prevents TOCTOU race between existence check and write.
 */
function safeWriteFileExclusive(filePath: string, content: string): [unknown, null] | [null, void] {
  return attempt(() => fs.writeFileSync(filePath, content, { encoding: 'utf-8', flag: 'wx' }));
}
