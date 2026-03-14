import { lauf, z } from 'laufen';

// Edit each group to match your project — remove entries for tools you don't use.

const BUILD_TARGETS = [
  // Generic: dist, build, out | Library: lib | TypeScript: .tsbuildinfo
  'dist',
  'build',
  'out',
  'lib',
  '.tsbuildinfo',
];

const CACHE_TARGETS = [
  // Monorepo: .turbo (Turborepo), .nx (NX)
  '.turbo',
  '.nx',

  // Frameworks: .next (Next.js), .nuxt + .output (Nuxt), .svelte-kit (SvelteKit)
  // .astro (Astro), .vercel (Vercel), .remix (Remix)
  '.next',
  '.nuxt',
  '.output',
  '.svelte-kit',
  '.astro',
  '.vercel',
  '.remix',

  // Bundlers: .parcel-cache (Parcel), .cache (Babel / webpack / generic)
  '.parcel-cache',
  '.cache',
];

const TEMP_TARGETS = ['coverage', 'tmp', 'temp'];

export default lauf({
  description: 'Remove build artifacts, caches, and temporary files',
  args: {
    build: z
      .boolean()
      .default(false)
      .describe('Only remove build outputs (dist, build, .tsbuildinfo, etc.)'),
    cache: z
      .boolean()
      .default(false)
      .describe('Only remove tool and framework caches (.turbo, .next, etc.)'),
    npm: z.boolean().default(false).describe('Also remove node_modules'),
    nuke: z
      .boolean()
      .default(false)
      .describe('Remove everything — build, cache, temp, and node_modules'),
    dryRun: z.boolean().default(false).describe('Show what would be deleted without deleting'),
  },
  async run(ctx) {
    const { build, cache, npm, nuke, dryRun } = ctx.args;

    const selective = build || cache || npm;

    const targets = [
      ...(nuke || build || !selective ? BUILD_TARGETS : []),
      ...(nuke || cache || !selective ? CACHE_TARGETS : []),
      ...(nuke || !selective ? TEMP_TARGETS : []),
      ...(nuke || npm ? ['node_modules'] : []),
    ];

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

    if (dryRun) {
      ctx.logger.info('Would delete:');
      existingTargets.forEach((target) => {
        ctx.logger.message(`  - ${target}`);
      });
      return;
    }

    ctx.spinner.start('Cleaning...');

    try {
      await Promise.all(existingTargets.map((target) => ctx.fs.rm(target)));
    } finally {
      ctx.spinner.stop();
    }

    ctx.logger.success(`Cleaned ${existingTargets.length} target(s)`);
  },
});
