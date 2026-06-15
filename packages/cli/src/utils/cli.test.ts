import * as fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readPackageJSON, safeParseError } from './cli.ts';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('safeParseError', () => {
  it('extracts message from Error instance', () => {
    expect(safeParseError(new Error('test error'))).toBe('test error');
  });

  it('returns string errors as-is', () => {
    expect(safeParseError('string error')).toBe('string error');
  });

  it('converts numbers to string', () => {
    expect(safeParseError(42)).toBe('42');
  });

  it('converts null to string', () => {
    expect(safeParseError(null)).toBe('null');
  });

  it('converts undefined to string', () => {
    expect(safeParseError(undefined)).toBe('undefined');
  });

  it('converts objects to string', () => {
    expect(safeParseError({ code: 'ERR' })).toBe('[object Object]');
  });

  it('extracts message from Error subclass', () => {
    expect(safeParseError(new TypeError('type error'))).toBe('type error');
  });
});

describe('readPackageJSON', () => {
  it('reads and parses a valid package.json', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{"name": "test-pkg", "version": "1.0.0"}');
    const result = readPackageJSON('/some/dir');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ name: 'test-pkg', version: '1.0.0' });
    }
  });

  it('returns err when file cannot be read', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const result = readPackageJSON('/missing/dir');
    expect(result.ok).toBe(false);
  });

  it('returns err when JSON is invalid', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('not json');
    const result = readPackageJSON('/some/dir');
    expect(result.ok).toBe(false);
  });

  it('reads from correct path', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{"name": "pkg"}');
    readPackageJSON('/my/project');
    expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('package.json'), 'utf-8');
  });
});
