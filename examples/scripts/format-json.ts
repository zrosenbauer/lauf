import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { lauf, z } from 'laufen';

export default lauf({
  description: 'Format JSON files with prettier',
  // Script-level packages - only available to this script
  packages: {
    prettier: '^3.0.0',
  },
  args: {
    file: z.string().describe('JSON file to format'),
    write: z.boolean().default(false).describe('Write formatted output back to file'),
  },
  async run(ctx) {
    // Type-safe import - prettier installed to ~/.lauf/packages/<hash>/
    const prettier = await ctx.import('prettier');

    const filePath = join(ctx.dir.package, ctx.args.file);

    ctx.spinner.start(`Reading ${ctx.args.file}...`);
    const content = await readFile(filePath, 'utf-8');
    ctx.spinner.stop();

    ctx.spinner.start('Formatting...');
    const formatted = await prettier.format(content, {
      parser: 'json',
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
    });
    ctx.spinner.stop('Formatted');

    if (ctx.args.write) {
      await writeFile(filePath, formatted, 'utf-8');
      ctx.logger.success(`Wrote formatted output to ${ctx.args.file}`);
    } else {
      ctx.logger.newlines();
      ctx.logger.info(formatted);
      ctx.logger.newlines();
      ctx.logger.info(`Run with --write to save changes to ${ctx.args.file}`);
    }
  },
});
