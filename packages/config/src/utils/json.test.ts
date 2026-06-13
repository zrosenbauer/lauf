import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { safeParseJSON } from './json.ts';

describe('safeParseJSON', () => {
  it('parses valid JSON object', () => {
    const [error, result] = safeParseJSON('{"key": "value"}');
    expect(error).toBeNull();
    expect(result).toEqual({ key: 'value' });
  });

  it('parses valid JSON array', () => {
    const [error, result] = safeParseJSON('[1, 2, 3]');
    expect(error).toBeNull();
    expect(result).toEqual([1, 2, 3]);
  });

  it('parses valid JSON string', () => {
    const [error, result] = safeParseJSON('"hello"');
    expect(error).toBeNull();
    expect(result).toBe('hello');
  });

  it('parses valid JSON number', () => {
    const [error, result] = safeParseJSON('42');
    expect(error).toBeNull();
    expect(result).toBe(42);
  });

  it('parses valid JSON boolean', () => {
    const [error, result] = safeParseJSON('true');
    expect(error).toBeNull();
    expect(result).toBe(true);
  });

  it('parses valid JSON null', () => {
    const [error, result] = safeParseJSON('null');
    expect(error).toBeNull();
    expect(result).toBeNull();
  });

  it('returns error for invalid JSON', () => {
    const [error, result] = safeParseJSON('not json');
    expect(error).not.toBeNull();
    expect(result).toBeNull();
  });

  it('returns error for empty string', () => {
    const [error, result] = safeParseJSON('');
    expect(error).not.toBeNull();
    expect(result).toBeNull();
  });

  it('returns error for malformed JSON', () => {
    const [error, result] = safeParseJSON('{key: value}');
    expect(error).not.toBeNull();
    expect(result).toBeNull();
  });

  it('returns error for trailing comma', () => {
    const [error, result] = safeParseJSON('{"a": 1,}');
    expect(error).not.toBeNull();
    expect(result).toBeNull();
  });

  it('returns unknown when called without schema', () => {
    const [error, result] = safeParseJSON('{"name": "test"}');
    expect(error).toBeNull();
    expect(result).toEqual({ name: 'test' });
  });
});

describe('safeParseJSON with Zod schema', () => {
  it('validates parsed JSON against a Zod schema', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const [error, result] = safeParseJSON('{"name": "Alice", "age": 30}', schema);
    expect(error).toBeNull();
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('returns error when JSON is valid but fails schema validation', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const [error, result] = safeParseJSON('{"name": 123, "age": "not a number"}', schema);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('JSON validation failed');
    expect(result).toBeNull();
  });

  it('returns parse error when JSON is invalid even with schema', () => {
    const schema = z.object({ name: z.string() });
    const [error, result] = safeParseJSON('not json', schema);
    expect(error).toBeInstanceOf(Error);
    expect(result).toBeNull();
  });

  it('works without schema (backwards compatible)', () => {
    const [error, result] = safeParseJSON('{"key": "value"}');
    expect(error).toBeNull();
    expect(result).toEqual({ key: 'value' });
  });

  it('validates array schema', () => {
    const schema = z.array(z.string());
    const [error, result] = safeParseJSON('["a", "b", "c"]', schema);
    expect(error).toBeNull();
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('rejects extra data with strict schema', () => {
    const schema = z.object({ name: z.string() }).strict();
    const [error, result] = safeParseJSON('{"name": "Alice", "extra": true}', schema);
    expect(error).toBeInstanceOf(Error);
    expect(result).toBeNull();
  });
});
