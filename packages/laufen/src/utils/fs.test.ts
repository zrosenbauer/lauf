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
  it('returns [null, path] on success', () => {
    vi.mocked(fs.mkdirSync).mockReturnValue('/new/dir');
    const [error, result] = safeMkdirSync('/new/dir');
    expect(error).toBeNull();
    expect(result).toBe('/new/dir');
  });

  it('returns [null, undefined] when directory already exists', () => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    const [error, result] = safeMkdirSync('/existing/dir');
    expect(error).toBeNull();
    expect(result).toBeUndefined();
  });

  it('returns [error, null] when fs throws', () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => {
      throw new Error('EACCES');
    });
    const [error, result] = safeMkdirSync('/some/dir');
    expect(error).toBeInstanceOf(Error);
    expect(result).toBeNull();
  });

  it('passes recursive option to fs.mkdirSync', () => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    safeMkdirSync('/deep/nested/dir');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/deep/nested/dir', { recursive: true });
  });
});
