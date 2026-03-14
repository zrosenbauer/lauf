import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { lauf, z } from 'laufen';

const DEFAULT_TARGETS = ['dist', 'node_modules', '.turbo', 'coverage'];

function matchesTarget(name: string, targets: ReadonlyArray<string>): boolean {
  return targets.includes(name);
}

export default lauf({
  description: 'Clean build artifacts from a workspace package',
  // Uses rimraf from workspace packages - no project dependency needed!
  args: {
    targets: z
      .string()
      .default(DEFAULT_TARGETS.join(','))
      .describe('Comma-separated list of directories to remove'),
    force: z.boolean().default(false).describe('Skip confirmation prompt'),
  },
  async run(ctx) {
    // Dynamic import - rimraf comes from workspace packages in lauf.config.ts
    const { rimraf } = await import('rimraf');

    const targets = ctx.args.targets.split(',').map((t) => t.trim());

    ctx.spinner.start('Scanning for artifacts...');

    const entries = await readdir(ctx.dir.package, { withFileTypes: true });
    const matched = entries
      .filter((entry) => matchesTarget(entry.name, targets))
      .map((entry) => entry.name);

    ctx.spinner.stop(`Found ${matched.length} matching target(s)`);

    if (matched.length === 0) {
      ctx.logger.info('Nothing to clean');
      return;
    }

    ctx.logger.newlines();
    matched.map((name) => ctx.logger.warn(`Will remove: ${name}`));
    ctx.logger.newlines();

    if (!ctx.args.force) {
      const [err, confirmed] = await ctx.prompts.confirm({
        message: `Remove ${matched.length} director${matched.length === 1 ? 'y' : 'ies'}? This cannot be undone.`,
        initialValue: false,
      });

      if (err) {
        ctx.logger.warn('Cancelled');
        return;
      }

      if (!confirmed) {
        ctx.logger.info('Aborted');
        return;
      }
    }

    ctx.spinner.start('Removing artifacts...');

    const paths = matched.map((name) => join(ctx.dir.package, name));
    await rimraf(paths);

    ctx.spinner.stop('Cleanup complete');
    ctx.logger.newlines();
    matched.map((name) => ctx.logger.success(`Removed: ${name}`));
  },
});
