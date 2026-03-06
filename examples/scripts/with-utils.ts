import { lauf, z } from 'laufen';

export default lauf({
  description: 'Example using ctx.dir and ctx.fs',
  args: {
    output: z.string().default('dist/output.json'),
  },
  async run(ctx) {
    // Read from package directory
    const pkgContent = await ctx.fs.readFile('package.json', 'utf-8');
    const pkg = JSON.parse(pkgContent as string);

    // Access workspace paths
    ctx.logger.info(`Workspace root: ${ctx.dir.root}`);
    ctx.logger.info(`Package directory: ${ctx.dir.package}`);
    ctx.logger.info(`Script name: ${ctx.name}`);

    // Write output using ctx.fs
    const output = {
      name: pkg.name,
      version: pkg.version,
      workspace: ctx.dir.root,
      package: ctx.dir.package,
    };

    await ctx.fs.writeFile(ctx.args.output, JSON.stringify(output, null, 2));

    ctx.logger.success(`Wrote output to ${ctx.args.output}`);
  },
});
