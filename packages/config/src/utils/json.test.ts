import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { safeParseJSON } from './json.ts';

describe('safeParseJSON', () => {
  it('parses valid JSON object', () => {
    const result = safeParseJSON('{"key": "value"}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ key: 'value' });
    }
  });

  it('parses valid JSON array', () => {
    const result = safeParseJSON('[1, 2, 3]');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([1, 2, 3]);
    }
  });

  it('parses valid JSON string', () => {
    const result = safeParseJSON('"hello"');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('hello');
    }
  });

  it('parses valid JSON number', () => {
    const result = safeParseJSON('42');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('parses valid JSON boolean', () => {
    const result = safeParseJSON('true');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  it('parses valid JSON null', () => {
    const result = safeParseJSON('null');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  it('returns err for invalid JSON', () => {
    const result = safeParseJSON('not json');
    expect(result.ok).toBe(false);
  });

  it('returns err for empty string', () => {
    const result = safeParseJSON('');
    expect(result.ok).toBe(false);
  });

  it('returns err for malformed JSON', () => {
    const result = safeParseJSON('{key: value}');
    expect(result.ok).toBe(false);
  });

  it('returns err for trailing comma', () => {
    const result = safeParseJSON('{"a": 1,}');
    expect(result.ok).toBe(false);
  });

  it('returns unknown when called without schema', () => {
    const result = safeParseJSON('{"name": "test"}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ name: 'test' });
    }
  });
});

describe('safeParseJSON with Zod schema', () => {
  it('validates parsed JSON against a Zod schema', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = safeParseJSON('{"name": "Alice", "age": 30}', schema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ name: 'Alice', age: 30 });
    }
  });

  it('returns err when JSON is valid but fails schema validation', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = safeParseJSON('{"name": 123, "age": "not a number"}', schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('JSON validation failed');
    }
  });

  it('returns parse err when JSON is invalid even with schema', () => {
    const schema = z.object({ name: z.string() });
    const result = safeParseJSON('not json', schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('works without schema (backwards compatible)', () => {
    const result = safeParseJSON('{"key": "value"}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ key: 'value' });
    }
  });

  it('validates array schema', () => {
    const schema = z.array(z.string());
    const result = safeParseJSON('["a", "b", "c"]', schema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(['a', 'b', 'c']);
    }
  });

  it('rejects extra data with strict schema', () => {
    const schema = z.object({ name: z.string() }).strict();
    const result = safeParseJSON('{"name": "Alice", "extra": true}', schema);
    expect(result.ok).toBe(false);
  });
});
