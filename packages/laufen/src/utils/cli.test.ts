import * as fs from 'node:fs';

import { InvalidParametersError, MissingRequiredFlagError, NoSuchCommandError } from 'clerc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHint, formatArgErrors, readPackageJSON, safeParseError } from './cli.ts';

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
    const result = safeParseError({ code: 'ERR' });
    expect(result).toBe('[object Object]');
  });

  it('extracts message from Error subclass', () => {
    expect(safeParseError(new TypeError('type error'))).toBe('type error');
  });
});

describe('formatArgErrors', () => {
  it('formats a single issue', () => {
    const issues = [{ path: ['name'], message: 'Required', code: 'invalid_type' }];
    const result = formatArgErrors(issues as never);
    expect(result).toContain('Invalid arguments:');
    expect(result).toContain('--name: Required');
  });

  it('formats multiple issues', () => {
    const issues = [
      { path: ['name'], message: 'Required', code: 'invalid_type' },
      { path: ['count'], message: 'Expected number', code: 'invalid_type' },
    ];
    const result = formatArgErrors(issues as never);
    expect(result).toContain('--name: Required');
    expect(result).toContain('--count: Expected number');
  });

  it('handles nested paths', () => {
    const issues = [{ path: ['config', 'output'], message: 'Invalid', code: 'invalid_type' }];
    const result = formatArgErrors(issues as never);
    expect(result).toContain('--config.output: Invalid');
  });

  it('handles empty issues array', () => {
    const result = formatArgErrors([]);
    expect(result).toBe('Invalid arguments:\n');
  });
});

describe('errorHint', () => {
  it('returns help hint for InvalidParametersError', () => {
    const err = new InvalidParametersError('test');
    const hint = errorHint(err);
    expect(hint).toBe('Run `lauf <command> --help` for usage information.');
  });

  it('returns help hint for MissingRequiredFlagError', () => {
    const err = new MissingRequiredFlagError(['test']);
    const hint = errorHint(err);
    expect(hint).toBe('Run `lauf <command> --help` for usage information.');
  });

  it('returns command hint for NoSuchCommandError', () => {
    const err = new NoSuchCommandError('test');
    const hint = errorHint(err);
    expect(hint).toBe('Run `lauf --help` to see available commands.');
  });

  it('returns undefined for generic Error', () => {
    expect(errorHint(new Error('generic'))).toBeUndefined();
  });

  it('returns undefined for string error', () => {
    expect(errorHint('string error')).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(errorHint(null)).toBeUndefined();
  });
});

describe('readPackageJSON', () => {
  it('reads and parses a valid package.json', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{"name": "test-pkg", "version": "1.0.0"}');
    const [error, pkg] = readPackageJSON('/some/dir');
    expect(error).toBeNull();
    expect(pkg).toEqual({ name: 'test-pkg', version: '1.0.0' });
  });

  it('returns error when file cannot be read', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const [error, pkg] = readPackageJSON('/missing/dir');
    expect(error).not.toBeNull();
    expect(pkg).toBeNull();
  });

  it('returns error when JSON is invalid', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('not json');
    const [error, pkg] = readPackageJSON('/some/dir');
    expect(error).not.toBeNull();
    expect(pkg).toBeNull();
  });

  it('reads from correct path', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{"name": "pkg"}');
    readPackageJSON('/my/project');
    expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('package.json'), 'utf-8');
  });
});
