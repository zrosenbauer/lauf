import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

import { lauf, z } from 'laufen';

export default lauf({
  description: 'Generate API docs from a source file using AI',
  args: {
    src: z.string().describe('Path to the source file'),
    out: z.string().default('docs/api.md').describe('Output file path'),
  },
  async run(ctx) {
    ctx.spinner.start(`Reading ${ctx.args.src}...`);

    const sourcePath = join(ctx.packageDir, ctx.args.src);
    const source = await readFile(sourcePath, 'utf-8');

    ctx.spinner.message('Generating docs with AI...');

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: `Write concise markdown API documentation for the following source file.\n\n${source}`,
    });

    const outPath = join(ctx.packageDir, ctx.args.out);
    await writeFile(outPath, text, 'utf-8');

    ctx.spinner.stop('Done');
    ctx.logger.success(`Docs written to ${ctx.args.out}`);
  },
});
