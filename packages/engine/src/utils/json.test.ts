import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { safeParseJSON } from './json.ts';

describe('safeParseJSON', () => {
  describe('without schema', () => {
    it('parses a valid JSON object', () => {
      const [error, value] = safeParseJSON('{"key":"value"}');
      expect(error).toBeNull();
      expect(value).toEqual({ key: 'value' });
    });

    it('parses a valid JSON array', () => {
      const [error, value] = safeParseJSON('[1,2,3]');
      expect(error).toBeNull();
      expect(value).toEqual([1, 2, 3]);
    });

    it('parses a JSON string', () => {
      const [error, value] = safeParseJSON('"hello"');
      expect(error).toBeNull();
      expect(value).toBe('hello');
    });

    it('parses a JSON number', () => {
      const [error, value] = safeParseJSON('42');
      expect(error).toBeNull();
      expect(value).toBe(42);
    });

    it('parses a JSON boolean', () => {
      const [error, value] = safeParseJSON('true');
      expect(error).toBeNull();
      expect(value).toBe(true);
    });

    it('parses JSON null', () => {
      const [error, value] = safeParseJSON('null');
      expect(error).toBeNull();
      expect(value).toBeNull();
    });

    it('returns error for invalid JSON', () => {
      const [error, value] = safeParseJSON('{not json}');
      expect(error).toBeInstanceOf(Error);
      expect(value).toBeNull();
    });

    it('returns error for empty string', () => {
      const [error, value] = safeParseJSON('');
      expect(error).toBeInstanceOf(Error);
      expect(value).toBeNull();
    });

    it('returns error for malformed JSON', () => {
      const [error, value] = safeParseJSON('{"key":}');
      expect(error).toBeInstanceOf(Error);
      expect(value).toBeNull();
    });
  });

  describe('with schema', () => {
    it('returns validated data when schema passes', () => {
      const schema = z.object({ name: z.string() });
      const [error, value] = safeParseJSON('{"name":"Alice"}', schema);
      expect(error).toBeNull();
      expect(value).toEqual({ name: 'Alice' });
    });

    it('returns error when schema validation fails', () => {
      const schema = z.object({ name: z.string() });
      const [error, value] = safeParseJSON('{"name":123}', schema);
      expect(error).toBeInstanceOf(Error);
      if (error === null) {
        return;
      }
      expect(error.message).toContain('JSON validation failed');
      expect(value).toBeNull();
    });

    it('returns parse error when JSON is invalid even with schema', () => {
      const schema = z.object({ name: z.string() });
      const [error, value] = safeParseJSON('{invalid}', schema);
      expect(error).toBeInstanceOf(Error);
      expect(value).toBeNull();
    });
  });
});
