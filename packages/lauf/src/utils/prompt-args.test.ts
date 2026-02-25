import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { PromptCancelled, Prompts } from '../types.ts';
import { promptForMissingArgs } from './prompt-args.ts';

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

const cancelled: PromptCancelled = { cancelled: true };

function createMockPrompts(overrides?: Partial<Prompts>): Prompts {
  return {
    text: vi.fn<Prompts['text']>(),
    confirm: vi.fn<Prompts['confirm']>(),
    select: vi.fn(),
    multiselect: vi.fn(),
    password: vi.fn(),
    path: vi.fn(),
    ...overrides,
  } as Prompts;
}

beforeEach(() => {
  toJSONSchemaOverride.value = undefined;
});

describe('promptForMissingArgs', () => {
  it('returns rawArgs unchanged when no args are missing', async () => {
    const argDefs = { name: z.string().describe('Name') };
    const rawArgs = { name: 'Alice' };
    const prompts = createMockPrompts();

    const [error, result] = await promptForMissingArgs(argDefs, rawArgs, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ name: 'Alice' });
    expect(prompts.text).not.toHaveBeenCalled();
  });

  it('returns rawArgs unchanged when argDefs is empty', async () => {
    const rawArgs = { extra: 'value' };
    const prompts = createMockPrompts();

    const [error, result] = await promptForMissingArgs({}, rawArgs, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ extra: 'value' });
  });

  it('prompts for missing required string args via text', async () => {
    const argDefs = { name: z.string().describe('Your name') };
    const prompts = createMockPrompts({
      text: vi.fn<Prompts['text']>().mockResolvedValue([null, 'Bob']),
    });

    const [error, result] = await promptForMissingArgs(argDefs, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ name: 'Bob' });
    expect(prompts.text).toHaveBeenCalledWith(expect.objectContaining({ message: 'Your name' }));
  });

  it('prompts for missing required boolean args via confirm', async () => {
    const argDefs = { verbose: z.boolean().describe('Enable verbose') };
    const prompts = createMockPrompts({
      confirm: vi.fn<Prompts['confirm']>().mockResolvedValue([null, true]),
    });

    const [error, result] = await promptForMissingArgs(argDefs, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ verbose: true });
    expect(prompts.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Enable verbose' }),
    );
  });

  it('prompts for missing required number args via text with validation', async () => {
    const argDefs = { count: z.number().describe('Item count') };
    const prompts = createMockPrompts({
      text: vi.fn<Prompts['text']>().mockResolvedValue([null, '42']),
    });

    const [error, result] = await promptForMissingArgs(argDefs, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ count: 42 });
    expect(prompts.text).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Item count',
        validate: expect.any(Function),
      }),
    );
  });

  it('prompts for enum args via select', async () => {
    const argDefs = { env: z.enum(['dev', 'staging', 'prod']).describe('Environment') };
    const prompts = createMockPrompts({
      select: vi.fn().mockResolvedValue([null, 'staging']) as Prompts['select'],
    });

    const [error, result] = await promptForMissingArgs(argDefs, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ env: 'staging' });
    expect(prompts.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Environment',
        options: expect.arrayContaining([
          expect.objectContaining({ value: 'dev', label: 'dev' }),
          expect.objectContaining({ value: 'staging', label: 'staging' }),
          expect.objectContaining({ value: 'prod', label: 'prod' }),
        ]),
      }),
    );
  });

  it('returns cancellation error when user cancels a prompt', async () => {
    const argDefs = { name: z.string().describe('Name') };
    const prompts = createMockPrompts({
      text: vi.fn<Prompts['text']>().mockResolvedValue([cancelled, null]),
    });

    const [error, result] = await promptForMissingArgs(argDefs, {}, prompts);

    expect(error).toEqual(cancelled);
    expect(result).toBeNull();
  });

  it('merges prompted values with existing rawArgs', async () => {
    const argDefs = {
      name: z.string().describe('Name'),
      age: z.number().describe('Age'),
    };
    const rawArgs = { name: 'Alice' };
    const prompts = createMockPrompts({
      text: vi.fn<Prompts['text']>().mockResolvedValue([null, '30']),
    });

    const [error, result] = await promptForMissingArgs(argDefs, rawArgs, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('prompts for multiple missing args sequentially', async () => {
    const argDefs = {
      name: z.string().describe('Name'),
      verbose: z.boolean().describe('Verbose'),
    };
    const textMock = vi.fn<Prompts['text']>().mockResolvedValue([null, 'Charlie']);
    const confirmMock = vi.fn<Prompts['confirm']>().mockResolvedValue([null, false]);
    const prompts = createMockPrompts({
      text: textMock,
      confirm: confirmMock,
    });

    const [error, result] = await promptForMissingArgs(argDefs, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ name: 'Charlie', verbose: false });
    expect(textMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });

  it('number prompt validation rejects empty string', async () => {
    const argDefs = { count: z.number().describe('Count') };
    const textMock = vi.fn<Prompts['text']>().mockResolvedValue([null, '5']);
    const prompts = createMockPrompts({ text: textMock });

    await promptForMissingArgs(argDefs, {}, prompts);

    const validateFn = textMock.mock.calls[0][0].validate as (
      value: string | undefined,
    ) => string | undefined;
    expect(validateFn('')).toBe('A value is required');
    expect(validateFn(undefined)).toBe('A value is required');
  });

  it('number prompt validation rejects non-numeric string', async () => {
    const argDefs = { count: z.number().describe('Count') };
    const textMock = vi.fn<Prompts['text']>().mockResolvedValue([null, '5']);
    const prompts = createMockPrompts({ text: textMock });

    await promptForMissingArgs(argDefs, {}, prompts);

    const validateFn = textMock.mock.calls[0][0].validate as (
      value: string | undefined,
    ) => string | undefined;
    expect(validateFn('abc')).toBe('Must be a valid number');
  });

  it('returns cancellation error when number prompt is cancelled', async () => {
    const argDefs = { count: z.number().describe('Count') };
    const prompts = createMockPrompts({
      text: vi.fn<Prompts['text']>().mockResolvedValue([cancelled, null]),
    });

    const [error, result] = await promptForMissingArgs(argDefs, {}, prompts);

    expect(error).toEqual(cancelled);
    expect(result).toBeNull();
  });

  it('handles integer type via number prompt', async () => {
    const argDefs = { port: z.number().int().describe('Port') };
    const prompts = createMockPrompts({
      text: vi.fn<Prompts['text']>().mockResolvedValue([null, '8080']),
    });

    const [error, result] = await promptForMissingArgs(argDefs, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ port: 8080 });
  });

  it('skips prompting for args with defaults', async () => {
    const argDefs = {
      name: z.string().describe('Name'),
      verbose: z.boolean().default(false).describe('Enable verbose'),
    };
    const prompts = createMockPrompts({
      text: vi.fn<Prompts['text']>().mockResolvedValue([null, 'Alice']),
    });

    const [error, result] = await promptForMissingArgs(argDefs, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ name: 'Alice' });
    expect(prompts.text).toHaveBeenCalledTimes(1);
    expect(prompts.confirm).not.toHaveBeenCalled();
  });

  it('skips prompting for all args when all have defaults', async () => {
    const argDefs = {
      verbose: z.boolean().default(false).describe('Enable verbose'),
      count: z.number().default(42).describe('Count'),
    };
    const prompts = createMockPrompts();

    const [error, result] = await promptForMissingArgs(argDefs, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({});
    expect(prompts.text).not.toHaveBeenCalled();
    expect(prompts.confirm).not.toHaveBeenCalled();
  });

  it('still prompts for args without defaults even when others have defaults', async () => {
    const argDefs = {
      name: z.string().describe('Name'),
      env: z.enum(['dev', 'prod']).describe('Environment'),
      verbose: z.boolean().default(false).describe('Enable verbose'),
      count: z.number().default(10).describe('Count'),
    };
    const textMock = vi.fn<Prompts['text']>().mockResolvedValue([null, 'Bob']);
    const selectMock = vi.fn().mockResolvedValue([null, 'dev']) as Prompts['select'];
    const prompts = createMockPrompts({
      text: textMock,
      select: selectMock,
    });

    const [error, result] = await promptForMissingArgs(argDefs, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ name: 'Bob', env: 'dev' });
    expect(textMock).toHaveBeenCalledTimes(1);
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(prompts.confirm).not.toHaveBeenCalled();
  });

  it('respects CLI-provided values for args that also have defaults', async () => {
    const argDefs = {
      name: z.string().describe('Name'),
      verbose: z.boolean().default(false).describe('Enable verbose'),
    };
    const rawArgs = { name: 'Alice', verbose: true };
    const prompts = createMockPrompts();

    const [error, result] = await promptForMissingArgs(argDefs, rawArgs, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ name: 'Alice', verbose: true });
    expect(prompts.text).not.toHaveBeenCalled();
    expect(prompts.confirm).not.toHaveBeenCalled();
  });
});

describe('promptForMissingArgs with mocked toJSONSchema', () => {
  it('resolves array-typed JSON Schema property to joined type', async () => {
    toJSONSchemaOverride.value = {
      type: 'object',
      properties: { tag: { type: ['string', 'null'], description: 'Tag' } },
      required: ['tag'],
    };
    const mod = await import('./prompt-args.ts');
    const { z: mockedZ } = await import('zod');
    const prompts = createMockPrompts({
      text: vi.fn<Prompts['text']>().mockResolvedValue([null, 'v1']),
    });

    const [error, result] = await mod.promptForMissingArgs({ tag: mockedZ.string() }, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ tag: 'v1' });
  });

  it('resolves empty array-typed JSON Schema property to string default', async () => {
    toJSONSchemaOverride.value = {
      type: 'object',
      properties: { tag: { type: [], description: 'Tag' } },
      required: ['tag'],
    };
    const mod = await import('./prompt-args.ts');
    const { z: mockedZ } = await import('zod');
    const prompts = createMockPrompts({
      text: vi.fn<Prompts['text']>().mockResolvedValue([null, 'v1']),
    });

    const [error, result] = await mod.promptForMissingArgs({ tag: mockedZ.string() }, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ tag: 'v1' });
  });

  it('returns rawArgs when toJSONSchema returns null', async () => {
    toJSONSchemaOverride.value = null;
    const mod = await import('./prompt-args.ts');
    const { z: mockedZ } = await import('zod');
    const prompts = createMockPrompts();

    const [error, result] = await mod.promptForMissingArgs(
      { name: mockedZ.string() },
      { name: 'Alice' },
      prompts,
    );

    expect(error).toBeNull();
    expect(result).toEqual({ name: 'Alice' });
    expect(prompts.text).not.toHaveBeenCalled();
  });

  it('treats non-string required array as empty required', async () => {
    toJSONSchemaOverride.value = {
      type: 'object',
      properties: { name: { type: 'string', description: 'Name' } },
      required: [123, true],
    };
    const mod = await import('./prompt-args.ts');
    const { z: mockedZ } = await import('zod');
    const prompts = createMockPrompts();

    const [error, result] = await mod.promptForMissingArgs({ name: mockedZ.string() }, {}, prompts);

    // Non-string required means no args are considered required, so no prompts
    expect(error).toBeNull();
    expect(result).toEqual({});
    expect(prompts.text).not.toHaveBeenCalled();
  });

  it('defaults to string type when property has no type field', async () => {
    toJSONSchemaOverride.value = {
      type: 'object',
      properties: { data: { description: 'Some data' } },
      required: ['data'],
    };
    const mod = await import('./prompt-args.ts');
    const { z: mockedZ } = await import('zod');
    const prompts = createMockPrompts({
      text: vi.fn<Prompts['text']>().mockResolvedValue([null, 'hello']),
    });

    const [error, result] = await mod.promptForMissingArgs({ data: mockedZ.string() }, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({ data: 'hello' });
    expect(prompts.text).toHaveBeenCalled();
  });

  it('falls back to empty properties when properties field is not an object', async () => {
    toJSONSchemaOverride.value = {
      type: 'object',
      properties: 'invalid',
      required: ['name'],
    };
    const mod = await import('./prompt-args.ts');
    const { z: mockedZ } = await import('zod');
    const prompts = createMockPrompts();

    const [error, result] = await mod.promptForMissingArgs({ name: mockedZ.string() }, {}, prompts);

    expect(error).toBeNull();
    expect(result).toEqual({});
    expect(prompts.text).not.toHaveBeenCalled();
  });

  it('uses arg name as description fallback when description is missing', async () => {
    toJSONSchemaOverride.value = {
      type: 'object',
      properties: { username: { type: 'string' } },
      required: ['username'],
    };
    const mod = await import('./prompt-args.ts');
    const { z: mockedZ } = await import('zod');
    const prompts = createMockPrompts({
      text: vi.fn<Prompts['text']>().mockResolvedValue([null, 'alice']),
    });

    const [error, result] = await mod.promptForMissingArgs(
      { username: mockedZ.string() },
      {},
      prompts,
    );

    expect(error).toBeNull();
    expect(result).toEqual({ username: 'alice' });
    // The prompt message should be the arg name since no description was provided
    expect(prompts.text).toHaveBeenCalledWith(expect.objectContaining({ message: 'username' }));
  });
});
