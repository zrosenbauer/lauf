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
