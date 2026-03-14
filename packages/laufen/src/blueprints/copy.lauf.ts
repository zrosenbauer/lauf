import { glob as globNative } from 'node:fs/promises';
import * as path from 'node:path';

import { lauf, z } from 'laufen';

// Files to copy — edit the patterns below to match your project.
// Paths are matched relative to the package root. Remove patterns you don't need.
const COPY_PATTERNS = [
  'src/**/*.ts',
  // 'public/**/*',
  // 'assets/**/*',
  // 'config/**/*.json',
];

export default lauf({
  description: 'Copy files matching defined patterns to a destination directory',
  args: {
    to: z.string().describe('Destination directory'),
    dryRun: z.boolean().default(false).describe('Show what would be copied without copying'),
  },
  async run(ctx) {
    const { to, dryRun } = ctx.args;

    const allFiles = await Promise.all(COPY_PATTERNS.map((p) => glob(p))).then((results) =>
      results.flat(),
    );

    if (allFiles.length === 0) {
      ctx.logger.info('No files matched the defined patterns');
      return;
    }

    if (dryRun) {
      ctx.logger.info(`Would copy ${allFiles.length} file(s) to ${to}:`);
      allFiles.forEach((file) => {
        ctx.logger.message(`  ${file} → ${path.join(to, file)}`);
      });
      return;
    }

    ctx.spinner.start(`Copying ${allFiles.length} file(s) to ${to}...`);

    try {
      await Promise.all(
        allFiles.map(async (file) => {
          const dest = path.join(to, file);
          await ctx.fs.mkdir(path.dirname(dest));
          await ctx.fs.copyFile(file, dest);
        }),
      );
    } finally {
      ctx.spinner.stop();
    }

    ctx.logger.success(`Copied ${allFiles.length} file(s) to ${to}`);
  },
});

/**
 * Collect all files matching a glob pattern into an array.
 */
async function glob(pattern: string): Promise<string[]> {
  const files: string[] = [];
  for await (const file of globNative(pattern)) {
    files.push(file);
  }
  return files;
}
