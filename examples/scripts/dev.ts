import { glob } from 'node:fs/promises';

import { lauf } from 'laufen';

async function findSourceFiles(cwd: string): Promise<string[]> {
  const files = await Array.fromAsync(glob('src/**/*.ts', { cwd, exclude: ['**/*.test.ts', '**/*.spec.ts'] }));
  return files.toSorted();
}

export default lauf({
  description: 'Watch TypeScript source files and report changes',
  watch: {
    patterns: ['src/**/*.ts'],
    debounce: 150,
    ignored: ['**/*.test.ts', '**/*.spec.ts'],
  },
  async run(ctx) {
    if (ctx.watch.enabled && ctx.watch.changedFiles.length > 0) {
      ctx.logger.info(`Files changed:`);
      ctx.watch.changedFiles.map((f) => ctx.logger.info(`  • ${f}`));
      ctx.logger.newlines();
    }

    ctx.spinner.start('Scanning source files...');

    const files = await findSourceFiles(ctx.dir.package);

    ctx.spinner.stop(`Found ${files.length} TypeScript file(s)`);
    ctx.logger.newlines();
    files.map((f) => ctx.logger.info(`  ${f}`));
    ctx.logger.newlines();

    if (ctx.watch.enabled) {
      ctx.logger.info(`Watching: ${ctx.watch.patterns.join(', ')}`);
    }
  },
});
