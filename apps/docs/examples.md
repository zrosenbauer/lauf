# Examples

Each example below demonstrates a different aspect of the Lauf script API. These examples live in the `examples/scripts/` directory of the repository.

## `docs.ts` -- AI-Powered Documentation

A script that reads a source file and generates API documentation using the Vercel AI SDK and Anthropic:

```ts
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
```

**Run it:**

```bash
lauf run @examples/lauf/docs -- --src src/index.ts
lauf run @examples/lauf/docs -- --src src/index.ts --out api-docs/api.md
```

**Key takeaways:**

- Third-party libraries like the Vercel AI SDK work seamlessly inside lauf scripts
- `ctx.spinner.start()` / `ctx.spinner.message()` / `ctx.spinner.stop()` provide a full progress lifecycle
- Scripts can combine file I/O with external API calls in a single `run` function

## `clean.ts` -- Rimraf + Confirmation Prompt

A cleanup script that removes build artifacts using `rimraf`, with a confirmation prompt before destructive operations:

```ts
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { rimraf } from 'rimraf';

import { lauf, z } from 'laufen';

const DEFAULT_TARGETS = ['dist', 'node_modules', '.turbo', 'coverage'];

export default lauf({
  description: 'Clean build artifacts from a workspace package',
  args: {
    targets: z
      .string()
      .default(DEFAULT_TARGETS.join(','))
      .describe('Comma-separated list of directories to remove'),
    force: z.boolean().default(false).describe('Skip confirmation prompt'),
  },
  async run(ctx) {
    const targets = ctx.args.targets.split(',').map((t) => t.trim());

    ctx.spinner.start('Scanning for artifacts...');

    const entries = await readdir(ctx.packageDir, { withFileTypes: true });
    const matched = entries
      .filter((entry) => targets.includes(entry.name))
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

    const paths = matched.map((name) => join(ctx.packageDir, name));
    await rimraf(paths);

    ctx.spinner.stop('Cleanup complete');
    ctx.logger.newlines();
    matched.map((name) => ctx.logger.success(`Removed: ${name}`));
  },
});
```

**Run it:**

```bash
lauf run @examples/lauf/clean
lauf run @examples/lauf/clean -- --force
lauf run @examples/lauf/clean -- --targets=dist,.turbo
```

**Key takeaways:**

- `ctx.prompts.confirm()` gates destructive operations behind user confirmation
- The `--force` flag bypasses the prompt for CI/automation use
- Third-party tools like `rimraf` integrate naturally

## `fetch-releases.ts` -- Remote Data Fetching

A script that fetches GitHub releases for a repository and saves a summary to a local JSON file:

```ts
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { lauf, z } from 'laufen';

interface Release {
  readonly tag_name: string;
  readonly name: string | null;
  readonly published_at: string | null;
  readonly html_url: string;
  readonly prerelease: boolean;
  readonly draft: boolean;
}

interface ReleaseSummary {
  readonly tag: string;
  readonly name: string;
  readonly date: string;
  readonly url: string;
}

function toSummary(release: Release): ReleaseSummary {
  return {
    tag: release.tag_name,
    name: release.name ?? release.tag_name,
    date: release.published_at ?? 'unknown',
    url: release.html_url,
  };
}

function stableOnly(release: Release): boolean {
  return !release.prerelease && !release.draft;
}

export default lauf({
  description: 'Fetch GitHub releases for a repo and save locally',
  args: {
    repo: z.string().describe('GitHub repo in owner/name format (e.g. "vercel/next.js")'),
    out: z.string().default('releases.json').describe('Output file path'),
    limit: z.coerce.number().default(10).describe('Max number of releases to fetch'),
  },
  async run(ctx) {
    const url = `https://api.github.com/repos/${ctx.args.repo}/releases?per_page=${ctx.args.limit}`;

    ctx.spinner.start(`Fetching releases from ${ctx.args.repo}...`);

    const response = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (!response.ok) {
      ctx.spinner.stop('Failed');
      ctx.logger.error(`GitHub API returned ${response.status}: ${response.statusText}`);
      return 1;
    }

    const releases: ReadonlyArray<Release> = await response.json();
    const summaries = releases.filter(stableOnly).map(toSummary);

    ctx.spinner.stop(`Fetched ${summaries.length} stable release(s)`);

    const outPath = join(ctx.packageDir, ctx.args.out);
    await writeFile(outPath, JSON.stringify(summaries, null, 2), 'utf-8');

    ctx.logger.newlines();
    summaries.map((r) => ctx.logger.info(`${r.tag} — ${r.name}`));
    ctx.logger.newlines();
    ctx.logger.success(`Saved to ${ctx.args.out}`);
  },
});
```

**Run it:**

```bash
lauf run @examples/lauf/fetch-releases -- --repo "vercel/next.js"
lauf run @examples/lauf/fetch-releases -- --repo "denoland/deno" --limit=5 --out=deno-releases.json
```

**Key takeaways:**

- Node's built-in `fetch` works out of the box for HTTP requests
- Helper functions like `toSummary` and `stableOnly` keep the `run` function declarative
- Returning `1` from `run` signals a non-zero exit code on failure
