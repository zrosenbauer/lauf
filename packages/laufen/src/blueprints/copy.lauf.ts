import { lauf, z } from 'laufen';

export default lauf({
  description: 'Copy a file to a destination path',
  args: {
    from: z.string().describe('Source file path'),
    to: z.string().describe('Destination file path'),
    overwrite: z.boolean().default(true).describe('Overwrite existing files'),
  },
  async run(ctx) {
    const { from, to, overwrite } = ctx.args;

    const sourceExists = await ctx.fs.exists(from);
    if (!sourceExists) {
      ctx.logger.error(`Source does not exist: ${from}`);
      return 1;
    }

    const destExists = await ctx.fs.exists(to);
    if (destExists && !overwrite) {
      ctx.logger.error(`Destination already exists: ${to}`);
      return 1;
    }

    const sourceStat = await ctx.fs.stat(from);

    if (sourceStat.isFile()) {
      ctx.spinner.start(`Copying ${from} → ${to}`);
      try {
        await ctx.fs.copyFile(from, to);
      } finally {
        ctx.spinner.stop();
      }
      ctx.logger.success(`Copied ${from} → ${to}`);
      return;
    }

    if (sourceStat.isDirectory()) {
      ctx.logger.error('Directory copying not yet implemented. Use a glob pattern instead.');
      return 1;
    }

    ctx.logger.error(`Unknown file type: ${from}`);
    return 1;
  },
});
