import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    includeSource: ['src/**/*.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/__integration__/**',
        'src/types.ts',
        'src/result.ts',
        'src/index.ts',
      ],
    },
  },
});
