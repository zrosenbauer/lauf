import type { ScriptConfig } from '../../types.ts';

const args = {};

const config: ScriptConfig<typeof args> = {
  description: 'Integration test: non-zero exit',
  args,
  run() {
    return 2;
  },
};

export default config;
