import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { extractArgMeta, formatHelp } from './help.ts';

describe('extractArgMeta', () => {
  it('extracts metadata from string arg', () => {
    const meta = extractArgMeta({ name: z.string().describe('User name') });
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({
      name: 'name',
      type: 'string',
      description: 'User name',
      required: true,
    });
  });

  it('extracts metadata from boolean arg', () => {
    const meta = extractArgMeta({ verbose: z.boolean().describe('Enable verbose') });
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({
      name: 'verbose',
      type: 'boolean',
      description: 'Enable verbose',
    });
  });

  it('extracts metadata from number arg', () => {
    const meta = extractArgMeta({ count: z.number().describe('Item count') });
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({
      name: 'count',
      type: expect.stringContaining('number'),
      description: 'Item count',
    });
  });

  it('detects required args without defaults', () => {
    const meta = extractArgMeta({ name: z.string() });
    expect(meta[0]).toMatchObject({ required: true });
  });

  it('detects optional args with defaults', () => {
    const meta = extractArgMeta({ verbose: z.boolean().default(false) });
    expect(meta[0]).toMatchObject({
      required: false,
      defaultValue: false,
    });
  });

  it('handles empty args object', () => {
    const meta = extractArgMeta({});
    expect(meta).toHaveLength(0);
  });

  it('handles args without description', () => {
    const meta = extractArgMeta({ name: z.string() });
    expect(meta[0]).toMatchObject({ description: '' });
  });

  it('resolves nullable schema type via anyOf', () => {
    const meta = extractArgMeta({ name: z.string().nullable().describe('Nullable name') });
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({
      name: 'name',
      description: 'Nullable name',
    });
    expect(meta[0].type).toContain('string');
    expect(meta[0].type).toContain('null');
  });

  it('handles multiple args', () => {
    const meta = extractArgMeta({
      name: z.string().describe('Name'),
      count: z.number().describe('Count'),
      verbose: z.boolean().default(false).describe('Verbose'),
    });
    expect(meta).toHaveLength(3);
  });

  it('returns string type when schema has no type, anyOf, or oneOf', () => {
    const meta = extractArgMeta({ data: z.any() });
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({ name: 'data', type: 'string' });
  });

  it('resolves optional nullable schema type', () => {
    const meta = extractArgMeta({
      label: z.string().nullable().optional().describe('Optional label'),
    });
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({
      name: 'label',
      description: 'Optional label',
    });
    expect(meta[0].type).toContain('string');
    expect(meta[0].type).toContain('null');
  });
});

describe('formatHelp', () => {
  it('includes script name in output', () => {
    const result = formatHelp('my-pkg/script', 'Does stuff', []);
    expect(result).toContain('my-pkg/script');
  });

  it('includes description in output', () => {
    const result = formatHelp('my-pkg/script', 'Does important stuff', []);
    expect(result).toContain('Does important stuff');
  });

  it('shows no flags message when args are empty', () => {
    const result = formatHelp('my-pkg/script', 'Does stuff', []);
    expect(result).toContain('No flags defined.');
  });

  it('shows FLAGS header when args exist', () => {
    const meta = [
      {
        name: 'verbose',
        type: 'boolean',
        description: 'Enable verbose',
        defaultValue: false,
        required: false,
      },
    ];
    const result = formatHelp('my-pkg/script', 'Does stuff', meta);
    expect(result).toContain('FLAGS:');
  });

  it('formats flag with type and description', () => {
    const meta = [
      {
        name: 'name',
        type: 'string',
        description: 'The name',
        defaultValue: undefined,
        required: true,
      },
    ];
    const result = formatHelp('my-pkg/script', 'Does stuff', meta);
    expect(result).toContain('--name <string>');
    expect(result).toContain('The name');
  });

  it('shows required marker for required args', () => {
    const meta = [
      {
        name: 'name',
        type: 'string',
        description: 'The name',
        defaultValue: undefined,
        required: true,
      },
    ];
    const result = formatHelp('my-pkg/script', 'Does stuff', meta);
    expect(result).toContain('(required)');
  });

  it('shows default value for args with defaults', () => {
    const meta = [
      { name: 'count', type: 'number', description: 'Count', defaultValue: 10, required: false },
    ];
    const result = formatHelp('my-pkg/script', 'Does stuff', meta);
    expect(result).toContain('[default: 10]');
  });

  it('shows default value string for string defaults', () => {
    const meta = [
      {
        name: 'host',
        type: 'string',
        description: 'Hostname',
        defaultValue: 'localhost',
        required: false,
      },
    ];
    const result = formatHelp('my-pkg/script', 'Does stuff', meta);
    expect(result).toContain('[default: localhost]');
    expect(result).not.toContain('(required)');
  });

  it('formats multiple flags with aligned output', () => {
    const meta = [
      {
        name: 'name',
        type: 'string',
        description: 'The name',
        defaultValue: undefined,
        required: true,
      },
      {
        name: 'verbose',
        type: 'boolean',
        description: 'Verbose',
        defaultValue: false,
        required: false,
      },
    ];
    const result = formatHelp('my-pkg/script', 'Does stuff', meta);
    expect(result).toContain('--name');
    expect(result).toContain('--verbose');
  });

  it('shows no suffix for optional args without defaults', () => {
    const meta = [
      {
        name: 'label',
        type: 'string',
        description: 'Optional label',
        defaultValue: undefined,
        required: false,
      },
    ];
    const result = formatHelp('my-pkg/script', 'Does stuff', meta);
    expect(result).toContain('--label <string>');
    expect(result).toContain('Optional label');
    expect(result).not.toContain('(required)');
    expect(result).not.toContain('[default:');
  });

  it('formats flag with no description and no suffix', () => {
    const meta = [
      {
        name: 'silent',
        type: 'boolean',
        description: '',
        defaultValue: undefined,
        required: false,
      },
    ];
    const result = formatHelp('my-pkg/script', 'Does stuff', meta);
    expect(result).toContain('--silent <boolean>');
    expect(result).not.toContain('(required)');
    expect(result).not.toContain('[default:');
  });
});

describe('extractArgMeta with mocked toJSONSchema', () => {
  const toJSONSchemaOverride = vi.hoisted(() => ({
    value: undefined as unknown,
  }));

  vi.mock('zod', async (importOriginal) => {
    const actual = await importOriginal<typeof import('zod')>();
    return {
      ...actual,
      z: {
        ...actual.z,
        toJSONSchema: (...args: Parameters<typeof actual.z.toJSONSchema>) => {
          if (toJSONSchemaOverride.value !== undefined) {
            return toJSONSchemaOverride.value;
          }
          return actual.z.toJSONSchema(...args);
        },
      },
    };
  });

  beforeEach(() => {
    toJSONSchemaOverride.value = undefined;
  });

  it('returns empty metadata when toJSONSchema returns null', async () => {
    toJSONSchemaOverride.value = null;
    const mod = await import('./help.ts');
    const { z: mockedZ } = await import('zod');
    const meta = mod.extractArgMeta({ name: mockedZ.string() });
    expect(meta).toHaveLength(0);
  });

  it('returns empty metadata when toJSONSchema returns non-object', async () => {
    toJSONSchemaOverride.value = 'invalid';
    const mod = await import('./help.ts');
    const { z: mockedZ } = await import('zod');
    const meta = mod.extractArgMeta({ name: mockedZ.string() });
    expect(meta).toHaveLength(0);
  });

  it('treats non-string required array as empty required', async () => {
    toJSONSchemaOverride.value = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: [123, true],
    };
    const mod = await import('./help.ts');
    const { z: mockedZ } = await import('zod');
    const meta = mod.extractArgMeta({ name: mockedZ.string() });
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({ name: 'name', required: false });
  });

  it('resolves type from array-typed property', async () => {
    toJSONSchemaOverride.value = {
      type: 'object',
      properties: { tag: { type: ['string', 'number'] } },
      required: ['tag'],
    };
    const mod = await import('./help.ts');
    const { z: mockedZ } = await import('zod');
    const meta = mod.extractArgMeta({ tag: mockedZ.string() });
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({ name: 'tag', type: 'string | number' });
  });

  it('resolves type from oneOf variants', async () => {
    toJSONSchemaOverride.value = {
      type: 'object',
      properties: {
        value: {
          oneOf: [{ type: 'string' }, { type: 'integer' }],
        },
      },
      required: ['value'],
    };
    const mod = await import('./help.ts');
    const { z: mockedZ } = await import('zod');
    const meta = mod.extractArgMeta({ value: mockedZ.string() });
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({ name: 'value', type: 'string | integer' });
  });

  it('falls back to empty properties when properties field is not an object', async () => {
    toJSONSchemaOverride.value = {
      type: 'object',
      properties: 'not-an-object',
      required: [],
    };
    const mod = await import('./help.ts');
    const { z: mockedZ } = await import('zod');
    const meta = mod.extractArgMeta({ name: mockedZ.string() });
    expect(meta).toHaveLength(0);
  });

  it('handles anyOf variants with array-typed entries', async () => {
    toJSONSchemaOverride.value = {
      type: 'object',
      properties: {
        data: {
          anyOf: [{ type: ['string', 'number'] }, { type: 'null' }],
        },
      },
      required: ['data'],
    };
    const mod = await import('./help.ts');
    const { z: mockedZ } = await import('zod');
    const meta = mod.extractArgMeta({ data: mockedZ.string() });
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({ type: 'string | number | null' });
  });

  it('returns string when anyOf variants have no extractable types', async () => {
    toJSONSchemaOverride.value = {
      type: 'object',
      properties: {
        data: {
          anyOf: [{ description: 'no type here' }],
        },
      },
      required: ['data'],
    };
    const mod = await import('./help.ts');
    const { z: mockedZ } = await import('zod');
    const meta = mod.extractArgMeta({ data: mockedZ.string() });
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({ type: 'string' });
  });

  it('returns empty metadata when properties is null', async () => {
    toJSONSchemaOverride.value = { properties: null };
    const mod = await import('./help.ts');
    const { z: mockedZ } = await import('zod');
    const meta = mod.extractArgMeta({ name: mockedZ.string() });
    expect(meta).toEqual([]);
  });
});
