import { describe, expect, it } from 'vitest';

import { fail, ok } from './result.ts';

describe('ok', () => {
  it('returns success tuple with no value', () => {
    const result = ok();
    expect(result).toEqual([null, undefined]);
  });

  it('returns success tuple with a value', () => {
    const result = ok(42);
    expect(result).toEqual([null, 42]);
  });

  it('returns success tuple with a string', () => {
    const result = ok('hello');
    expect(result).toEqual([null, 'hello']);
  });

  it('returns success tuple with an object', () => {
    const value = { name: 'test', count: 1 };
    const result = ok(value);
    expect(result[0]).toBeNull();
    expect(result[1]).toBe(value);
  });

  it('returns success tuple with null value', () => {
    const result = ok(null);
    expect(result).toEqual([null, null]);
  });

  it('returns success tuple with boolean', () => {
    expect(ok(true)).toEqual([null, true]);
    expect(ok(false)).toEqual([null, false]);
  });
});

describe('fail', () => {
  it('returns failure tuple with message only', () => {
    const error = { message: 'something went wrong' };
    const result = fail(error);
    expect(result).toEqual([error, null]);
  });

  it('returns failure tuple with message and hint', () => {
    const error = { message: 'oops', hint: 'try again' };
    const result = fail(error);
    expect(result[0]).toEqual({ message: 'oops', hint: 'try again' });
    expect(result[1]).toBeNull();
  });

  it('returns failure tuple with exit code', () => {
    const error = { message: 'fatal', exitCode: 2 };
    const result = fail(error);
    expect(result[0]).toEqual({ message: 'fatal', exitCode: 2 });
    expect(result[1]).toBeNull();
  });

  it('returns failure tuple with all fields', () => {
    const error = { message: 'err', hint: 'fix it', exitCode: 3 };
    const result = fail(error);
    expect(result[0]).toBe(error);
    expect(result[1]).toBeNull();
  });
});
