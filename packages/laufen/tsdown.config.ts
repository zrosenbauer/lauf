import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/lauf.ts'],
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  clean: true,
  unbundle: false,
  platform: 'node',
  target: 'node22',
});
