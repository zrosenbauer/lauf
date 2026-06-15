import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/workspace.ts'],
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  clean: true,
  unbundle: false,
  platform: 'node',
  target: 'node22',
});
