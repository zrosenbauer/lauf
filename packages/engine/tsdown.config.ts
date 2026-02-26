import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/executor.ts', 'src/metadata-extractor.ts'],
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  clean: true,
  unbundle: false,
  platform: 'node',
  target: 'node22',
});
