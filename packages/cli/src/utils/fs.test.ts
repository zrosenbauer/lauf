import * as fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { safeMkdirSync } from './fs.ts';

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('safeMkdirSync', () => {
  it('returns ok with path on success', () => {
    vi.mocked(fs.mkdirSync).mockReturnValue('/new/dir');
    const result = safeMkdirSync('/new/dir');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('/new/dir');
    }
  });

  it('returns ok with undefined when directory already exists', () => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    const result = safeMkdirSync('/existing/dir');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeUndefined();
    }
  });

  it('returns err when fs throws', () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => {
      throw new Error('EACCES');
    });
    const result = safeMkdirSync('/some/dir');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('passes recursive option to fs.mkdirSync', () => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    safeMkdirSync('/deep/nested/dir');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/deep/nested/dir', { recursive: true });
  });
});
