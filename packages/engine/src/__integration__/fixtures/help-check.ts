import { z } from 'zod';

import type { ScriptConfig } from '../../types.ts';

const args = {
  name: z.string().describe('The user name'),
  verbose: z.boolean().default(false).describe('Enable verbose output'),
};

const config: ScriptConfig<typeof args> = {
  description: 'Integration test: help mode',
  args,
  run() {
    // Not reached in help mode
  },
};

export default config;
