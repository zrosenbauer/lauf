// oxlint-disable import/max-dependencies
import * as fs from 'node:fs';

import type { CommandContext } from '@kidd-cli/core';
import { command } from '@kidd-cli/core';
import { createConfigLoader } from '@laufen/config';
import type { Workspace } from '@laufen/config/workspace';
import { qualifyScriptName } from '@laufen/config/workspace';
import { attempt, isErr } from 'massaman/control';
import * as path from 'pathe';
import { z } from 'zod';

import { scriptTemplate } from '../templates/script.ts';
import { safeParseError } from '../utils/cli.ts';
import { safeMkdirSync } from '../utils/fs.ts';

const positionals = z.object({
  name: z.string().min(1).optional().describe('Name of the new script'),
});

const options = z.object({
  dir: z.string().optional().describe('Target directory (relative to monorepo root)'),
});

/**
 * `lauf create [name]` — scaffold a new lauf script file.
 */
export default command({
  description: 'Create a new script',
  positionals,
  options,
  // oxlint-disable-next-line max-lines-per-function
  handler: async (ctx) => {
    const name = await resolveName(ctx, ctx.args.name);

    const configResult = await createConfigLoader().safeLoadWithMeta();
    if (isErr(configResult)) {
      ctx.fail(`Failed to load lauf config: ${configResult.error.message}`);
      return;
    }
    const loaded = configResult.value;

    const targetDir = resolveTargetDir(ctx.args.dir, loaded.config.scripts, loaded.configDir);
    const normalizedTarget = path.normalize(targetDir);

    if (
      normalizedTarget !== loaded.configDir &&
      !normalizedTarget.startsWith(`${loaded.configDir}${path.sep}`)
    ) {
      ctx.fail(`Target directory escapes config root: ${normalizedTarget}`);
    }

    const stem = name.replace(/\.ts$/, '');
    const fileName = `${stem}.ts`;
    const filePath = path.join(targetDir, fileName);

    const resolvedFilePath = path.resolve(filePath);
    const normalizedTargetForFile = path.resolve(targetDir);
    if (!resolvedFilePath.startsWith(`${normalizedTargetForFile}${path.sep}`)) {
      ctx.fail(`File path escapes target directory: ${resolvedFilePath}`);
    }

    const mkdir = safeMkdirSync(targetDir);
    if (isErr(mkdir)) {
      ctx.fail(`Failed to create directory ${targetDir}: ${safeParseError(mkdir.error)}`);
      return;
    }

    const written = attempt(() =>
      fs.writeFileSync(filePath, scriptTemplate(stem), { encoding: 'utf-8', flag: 'wx' }),
    );
    if (isErr(written)) {
      const nodeError = written.error as NodeJS.ErrnoException;
      if (nodeError.code === 'EEXIST') {
        ctx.fail(`File already exists: ${filePath}`);
        return;
      }
      ctx.fail(`Failed to write ${filePath}: ${safeParseError(written.error)}`);
      return;
    }

    const ownerWorkspace: Workspace | undefined = ctx.workspace.tree.workspaces.find(
      (w) => path.resolve(w.dir) === path.resolve(loaded.configDir),
    );
    const qualifiedName = qualifyOwnedName(ownerWorkspace, stem);

    const relative = path.relative(loaded.configDir, filePath);
    ctx.log.success(`Created ${relative}`);
    ctx.log.message(ctx.colors.dim(`Run it with: lauf run ${qualifiedName}`));
  },
});

function resolveName(ctx: CommandContext, name: string | undefined): Promise<string> {
  if (name) {
    return Promise.resolve(name);
  }
  return ctx.prompts.text({
    message: 'Enter a name for the new script',
    placeholder: 'my-script',
  });
}

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

function qualifyOwnedName(ownerWorkspace: Workspace | undefined, stem: string): string {
  if (!ownerWorkspace) {
    return stem;
  }
  return qualifyScriptName(ownerWorkspace, stem);
}
