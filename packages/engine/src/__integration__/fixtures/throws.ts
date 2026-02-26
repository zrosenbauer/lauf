import type { ScriptConfig } from '../../types.ts';

const args = {};

const config: ScriptConfig<typeof args> = {
  description: 'Integration test: throws error',
  args,
  run() {
    throw new Error('intentional test error');
  },
};

export default config;
