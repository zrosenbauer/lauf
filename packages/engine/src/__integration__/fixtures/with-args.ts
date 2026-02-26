import { writeFileSync } from 'node:fs';

import { z } from 'zod';

import type { ScriptConfig } from '../../types.ts';

const args = {
  markerPath: z.string(),
  name: z.string(),
  count: z.coerce.number(),
};

const config: ScriptConfig<typeof args> = {
  description: 'Integration test: arg serialization',
  args,
  run(ctx) {
    writeFileSync(
      ctx.args.markerPath,
      JSON.stringify({ name: ctx.args.name, count: ctx.args.count }),
    );
  },
};

export default config;
