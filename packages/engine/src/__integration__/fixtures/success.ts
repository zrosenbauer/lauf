import { writeFileSync } from 'node:fs';

import { z } from 'zod';

import type { ScriptConfig } from '../../types.ts';

const args = {
  markerPath: z.string(),
};

const config: ScriptConfig<typeof args> = {
  description: 'Integration test: basic success',
  args,
  run(ctx) {
    writeFileSync(ctx.args.markerPath, JSON.stringify({ ran: true, name: ctx.name }));
  },
};

export default config;
