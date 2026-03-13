import { lauf, z } from 'laufen';

export default lauf({
  description: 'Remove build artifacts, caches, and temporary files',
  args: {
    nodeModules: z.boolean().default(false).describe('Also remove node_modules'),
    dryRun: z.boolean().default(false).describe('Show what would be deleted without deleting'),
  },
  async run(ctx) {
    const targets = [
      'dist',
      'build',
      '.next',
      '.turbo',
      'coverage',
      '.cache',
      'tmp',
      'temp',
      '.tsbuildinfo',
    ];

    if (ctx.args.nodeModules) {
      targets.push('node_modules');
    }

    const existingTargets = await Promise.all(
      targets.map(async (target) => {
        const exists = await ctx.fs.exists(target);
        return exists ? target : null;
      }),
    ).then((results) => results.filter((t): t is string => t !== null));

    if (existingTargets.length === 0) {
      ctx.logger.info('Nothing to clean');
      return;
    }

    if (ctx.args.dryRun) {
      ctx.logger.info('Would delete:');
      existingTargets.forEach((target) => {
        ctx.logger.message(`  - ${target}`);
      });
      return;
    }

    ctx.spinner.start('Cleaning...');

    await Promise.all(existingTargets.map((target) => ctx.fs.rm(target)));

    ctx.spinner.stop();
    ctx.logger.success(`Cleaned ${existingTargets.length} target(s)`);
  },
});
