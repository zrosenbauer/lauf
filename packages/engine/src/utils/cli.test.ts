import { describe, expect, it } from 'vitest';

import { formatArgErrors, safeParseError } from './cli.ts';

describe('safeParseError', () => {
  it('returns message from Error instance', () => {
    const result = safeParseError(new Error('something broke'));
    expect(result).toBe('something broke');
  });

  it('returns string as-is', () => {
    const result = safeParseError('raw error string');
    expect(result).toBe('raw error string');
  });

  it('converts number to string', () => {
    const result = safeParseError(42);
    expect(result).toBe('42');
  });

  it('converts null to "null"', () => {
    const result = safeParseError(null);
    expect(result).toBe('null');
  });

  it('converts undefined to "undefined"', () => {
    const result = safeParseError(undefined);
    expect(result).toBe('undefined');
  });

  it('converts object to string representation', () => {
    const result = safeParseError({ key: 'value' });
    expect(result).toBe('[object Object]');
  });
});

describe('formatArgErrors', () => {
  it('formats a single issue', () => {
    const issues = [{ path: ['name'], message: 'Required' }] as ReadonlyArray<{
      path: readonly string[];
      message: string;
    }>;
    const result = formatArgErrors(issues as never);
    expect(result).toBe('Invalid arguments:\n  --name: Required');
  });

  it('formats multiple issues', () => {
    const issues = [
      { path: ['name'], message: 'Required' },
      { path: ['age'], message: 'Expected number' },
    ] as ReadonlyArray<{ path: readonly string[]; message: string }>;
    const result = formatArgErrors(issues as never);
    expect(result).toBe('Invalid arguments:\n  --name: Required\n  --age: Expected number');
  });

  it('formats nested paths with dot notation', () => {
    const issues = [{ path: ['foo', 'bar'], message: 'Invalid' }] as ReadonlyArray<{
      path: readonly string[];
      message: string;
    }>;
    const result = formatArgErrors(issues as never);
    expect(result).toBe('Invalid arguments:\n  --foo.bar: Invalid');
  });

  it('handles empty array', () => {
    const result = formatArgErrors([] as never);
    expect(result).toBe('Invalid arguments:\n');
  });
});
