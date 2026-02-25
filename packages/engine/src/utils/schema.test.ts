import { describe, expect, it } from 'vitest';

import { extractSchemaFields, resolveType } from './schema.ts';

describe('resolveType', () => {
  it('returns string type directly', () => {
    const result = resolveType({ type: 'number' });
    expect(result).toBe('number');
  });

  it('joins array type with pipe', () => {
    const result = resolveType({ type: ['string', 'null'] });
    expect(result).toBe('string | null');
  });

  it('returns "string" for empty array type', () => {
    const result = resolveType({ type: [] });
    expect(result).toBe('string');
  });

  it('resolves anyOf with types', () => {
    const result = resolveType({
      anyOf: [{ type: 'string' }, { type: 'null' }],
    });
    expect(result).toBe('string | null');
  });

  it('resolves oneOf with types', () => {
    const result = resolveType({
      oneOf: [{ type: 'number' }, { type: 'boolean' }],
    });
    expect(result).toBe('number | boolean');
  });

  it('falls back to "string" when no type info', () => {
    const result = resolveType({});
    expect(result).toBe('string');
  });

  it('falls back to "string" when anyOf has no extractable types', () => {
    const result = resolveType({
      anyOf: [{ description: 'no type here' }, { description: 'none here either' }],
    });
    expect(result).toBe('string');
  });

  it('falls back to "string" when oneOf has no extractable types', () => {
    const result = resolveType({
      oneOf: [{ description: 'no type' }],
    });
    expect(result).toBe('string');
  });

  it('resolves anyOf with array types inside variants', () => {
    const result = resolveType({
      anyOf: [{ type: ['string', 'number'] }, { type: 'null' }],
    });
    expect(result).toBe('string | number | null');
  });
});

describe('extractSchemaFields', () => {
  it('extracts properties and required from valid schema', () => {
    const raw = {
      properties: {
        name: { type: 'string', description: 'The name' },
        age: { type: 'number' },
      },
      required: ['name'],
    };
    const result = extractSchemaFields(raw);
    expect(result.properties).toEqual({
      name: { type: 'string', description: 'The name' },
      age: { type: 'number' },
    });
    expect(result.required).toEqual(['name']);
  });

  it('returns defaults for null input', () => {
    const result = extractSchemaFields(null);
    expect(result).toEqual({ properties: {}, required: [] });
  });

  it('returns defaults for undefined input', () => {
    const result = extractSchemaFields(undefined);
    expect(result).toEqual({ properties: {}, required: [] });
  });

  it('returns defaults for number input', () => {
    const result = extractSchemaFields(42);
    expect(result).toEqual({ properties: {}, required: [] });
  });

  it('returns defaults for string input', () => {
    const result = extractSchemaFields('not an object');
    expect(result).toEqual({ properties: {}, required: [] });
  });

  it('returns empty properties when properties field is missing', () => {
    const result = extractSchemaFields({ required: ['name'] });
    expect(result.properties).toEqual({});
    expect(result.required).toEqual(['name']);
  });

  it('returns empty required when required is not an array', () => {
    const result = extractSchemaFields({
      properties: { name: { type: 'string' } },
      required: 'name',
    });
    expect(result.properties).toEqual({ name: { type: 'string' } });
    expect(result.required).toEqual([]);
  });

  it('returns empty required when required contains non-strings', () => {
    const result = extractSchemaFields({
      properties: {},
      required: [1, 2, 3],
    });
    expect(result.properties).toEqual({});
    expect(result.required).toEqual([]);
  });

  it('handles schema with no properties and no required', () => {
    const result = extractSchemaFields({});
    expect(result).toEqual({ properties: {}, required: [] });
  });
});
