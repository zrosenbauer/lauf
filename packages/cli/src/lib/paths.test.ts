import { describe, expect, it } from 'vitest';

import { LAUF_ROOT } from './paths.ts';

describe('LAUF_ROOT', () => {
  it('is a non-empty string', () => {
    expect(typeof LAUF_ROOT).toBe('string');
    expect(LAUF_ROOT.length).toBeGreaterThan(0);
  });

  it('is an absolute path', () => {
    expect(LAUF_ROOT.startsWith('/')).toBe(true);
  });
});
