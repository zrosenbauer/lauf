import { writeFileSync } from 'node:fs';

import { z } from 'zod';

import type { ScriptConfig } from '../../types.ts';

// Top-level await — must be supported in ESM
const delay = await Promise.resolve(42);

const args = {
  markerPath: z.string(),
};

const config: ScriptConfig<typeof args> = {
  description: `Integration test: top-level await (value=${delay})`,
  args,
  run(ctx) {
    writeFileSync(ctx.args.markerPath, JSON.stringify({ ran: true, delay }));
  },
};

export default config;
