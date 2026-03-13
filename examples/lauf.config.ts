import { defineConfig } from 'laufen';

export default defineConfig({
  scripts: ['scripts/*.ts'],
  // Workspace-level packages available to all scripts
  packages: {
    rimraf: '^6.0.0',
    execa: '^9.0.0',
  },
});
