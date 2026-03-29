import { lauf, z } from 'laufen';

export default lauf({
  description: 'Example using ctx.dirs and ctx.fs',
  args: {
    output: z.string().default('dist/output.json'),
  },
  async run(ctx) {
    // Read from package directory
    const pkgContent = await ctx.fs.readFile('package.json', 'utf-8');
    const pkg = JSON.parse(pkgContent as string);

    // Access workspace paths
    ctx.logger.info(`Workspace root: ${ctx.dirs.root}`);
    ctx.logger.info(`Package directory: ${ctx.dirs.package}`);
    ctx.logger.info(`Script name: ${ctx.name}`);

    // Write output using ctx.fs
    const output = {
      name: pkg.name,
      version: pkg.version,
      workspace: ctx.dirs.root,
      package: ctx.dirs.package,
    };

    await ctx.fs.writeFile(ctx.args.output, JSON.stringify(output, null, 2));

    ctx.logger.success(`Wrote output to ${ctx.args.output}`);
  },
});
