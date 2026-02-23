import { describe, expect, it } from 'vitest';

import { configTemplate } from './config.ts';

describe('configTemplate', () => {
  it('includes defineConfig import from laufen', () => {
    const result = configTemplate();
    expect(result).toContain("import { defineConfig } from 'laufen'");
  });

  it('includes default export with defineConfig', () => {
    const result = configTemplate();
    expect(result).toContain('export default defineConfig');
  });

  it('includes default scripts glob pattern', () => {
    const result = configTemplate();
    expect(result).toContain("scripts: ['scripts/*.ts']");
  });

  it('returns a non-empty string', () => {
    const result = configTemplate();
    expect(result.length).toBeGreaterThan(0);
  });

  it('ends with a newline', () => {
    const result = configTemplate();
    expect(result.endsWith('\n')).toBe(true);
  });
});
