import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/lauf.ts', 'src/runtime/executor.ts', 'src/runtime/metadata.ts'],
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  clean: true,
  unbundle: false,
  platform: 'node',
  target: 'node22',
});
