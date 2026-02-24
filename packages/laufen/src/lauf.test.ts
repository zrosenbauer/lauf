import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineConfig, lauf } from './lauf.ts';

describe('lauf', () => {
  it('returns the config object as-is', () => {
    const config = {
      description: 'test script',
      args: { name: z.string() },
      run: () => {},
    };
    const result = lauf(config);
    expect(result).toBe(config);
  });

  it('preserves all config properties', () => {
    const runFn = vi.fn();
    const config = {
      description: 'my script',
      args: {
        verbose: z.boolean().default(false),
        output: z.string().optional(),
      },
      run: runFn,
    };
    const result = lauf(config);
    expect(result.description).toBe('my script');
    expect(result.args).toBe(config.args);
    expect(result.run).toBe(runFn);
  });

  it('works with empty args', () => {
    const config = {
      description: 'no args',
      args: {},
      run: () => {},
    };
    const result = lauf(config);
    expect(result).toBe(config);
  });
});

describe('defineConfig', () => {
  it('returns the config object as-is', () => {
    const config = { scripts: ['scripts/*.lauf.ts'] };
    const result = defineConfig(config);
    expect(result).toBe(config);
  });

  it('preserves scripts array', () => {
    const config = { scripts: ['src/**/*.lauf.ts', 'tools/*.ts'] };
    const result = defineConfig(config);
    expect(result.scripts).toEqual(['src/**/*.lauf.ts', 'tools/*.ts']);
  });

  it('works with empty config', () => {
    const config = {};
    const result = defineConfig(config);
    expect(result).toBe(config);
  });

  it('preserves logger if provided', () => {
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      success: () => {},
      message: () => {},
      newlines: () => {},
    };
    const config = { scripts: ['scripts/*.lauf.ts'], logger };
    const result = defineConfig(config);
    expect(result.logger).toBe(logger);
  });
});
