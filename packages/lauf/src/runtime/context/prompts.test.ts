import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clack/prompts', () => ({
  text: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  password: vi.fn(),
  path: vi.fn(),
  isCancel: vi.fn(),
}));

import { createPrompts } from './prompts.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createPrompts', () => {
  it('returns a frozen object', () => {
    const prompts = createPrompts();
    expect(Object.isFrozen(prompts)).toBe(true);
  });

  it('has all prompt methods', () => {
    const prompts = createPrompts();
    expect(typeof prompts.text).toBe('function');
    expect(typeof prompts.confirm).toBe('function');
    expect(typeof prompts.select).toBe('function');
    expect(typeof prompts.multiselect).toBe('function');
    expect(typeof prompts.password).toBe('function');
    expect(typeof prompts.path).toBe('function');
  });
});

describe('prompts.text', () => {
  it('returns [null, value] on success', async () => {
    vi.mocked(p.text).mockResolvedValue('hello');
    vi.mocked(p.isCancel).mockReturnValue(false);

    const prompts = createPrompts();
    const result = await prompts.text({ message: 'Enter text' });
    expect(result).toEqual([null, 'hello']);
  });

  it('returns [cancelled, null] on cancel', async () => {
    vi.mocked(p.text).mockResolvedValue(Symbol.for('cancel'));
    vi.mocked(p.isCancel).mockReturnValue(true);

    const prompts = createPrompts();
    const result = await prompts.text({ message: 'Enter text' });
    expect(result[0]).toEqual({ cancelled: true });
    expect(result[1]).toBeNull();
  });
});

describe('prompts.confirm', () => {
  it('returns [null, true] on confirm', async () => {
    vi.mocked(p.confirm).mockResolvedValue(true);
    vi.mocked(p.isCancel).mockReturnValue(false);

    const prompts = createPrompts();
    const result = await prompts.confirm({ message: 'Continue?' });
    expect(result).toEqual([null, true]);
  });

  it('returns [null, false] on deny', async () => {
    vi.mocked(p.confirm).mockResolvedValue(false);
    vi.mocked(p.isCancel).mockReturnValue(false);

    const prompts = createPrompts();
    const result = await prompts.confirm({ message: 'Continue?' });
    expect(result).toEqual([null, false]);
  });

  it('returns [cancelled, null] on cancel', async () => {
    vi.mocked(p.confirm).mockResolvedValue(Symbol.for('cancel'));
    vi.mocked(p.isCancel).mockReturnValue(true);

    const prompts = createPrompts();
    const result = await prompts.confirm({ message: 'Continue?' });
    expect(result[0]).toEqual({ cancelled: true });
    expect(result[1]).toBeNull();
  });
});

describe('prompts.select', () => {
  it('returns [null, value] on selection', async () => {
    vi.mocked(p.select).mockResolvedValue('option-a');
    vi.mocked(p.isCancel).mockReturnValue(false);

    const prompts = createPrompts();
    const result = await prompts.select({
      message: 'Choose',
      options: [{ value: 'option-a', label: 'Option A' }],
    });
    expect(result).toEqual([null, 'option-a']);
  });

  it('returns [cancelled, null] on cancel', async () => {
    vi.mocked(p.select).mockResolvedValue(Symbol.for('cancel'));
    vi.mocked(p.isCancel).mockReturnValue(true);

    const prompts = createPrompts();
    const result = await prompts.select({
      message: 'Choose',
      options: [{ value: 'a', label: 'A' }],
    });
    expect(result[0]).toEqual({ cancelled: true });
    expect(result[1]).toBeNull();
  });
});

describe('prompts.multiselect', () => {
  it('returns [null, values] on selection', async () => {
    vi.mocked(p.multiselect).mockResolvedValue(['a', 'b']);
    vi.mocked(p.isCancel).mockReturnValue(false);

    const prompts = createPrompts();
    const result = await prompts.multiselect({
      message: 'Choose many',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    });
    expect(result).toEqual([null, ['a', 'b']]);
  });

  it('returns [cancelled, null] on cancel', async () => {
    vi.mocked(p.multiselect).mockResolvedValue(Symbol.for('cancel'));
    vi.mocked(p.isCancel).mockReturnValue(true);

    const prompts = createPrompts();
    const result = await prompts.multiselect({
      message: 'Choose many',
      options: [{ value: 'a', label: 'A' }],
    });
    expect(result[0]).toEqual({ cancelled: true });
    expect(result[1]).toBeNull();
  });
});

describe('prompts.password', () => {
  it('returns [null, value] on success', async () => {
    vi.mocked(p.password).mockResolvedValue('secret123');
    vi.mocked(p.isCancel).mockReturnValue(false);

    const prompts = createPrompts();
    const result = await prompts.password({ message: 'Enter password' });
    expect(result).toEqual([null, 'secret123']);
  });

  it('returns [cancelled, null] on cancel', async () => {
    vi.mocked(p.password).mockResolvedValue(Symbol.for('cancel'));
    vi.mocked(p.isCancel).mockReturnValue(true);

    const prompts = createPrompts();
    const result = await prompts.password({ message: 'Enter password' });
    expect(result[0]).toEqual({ cancelled: true });
    expect(result[1]).toBeNull();
  });
});

describe('prompts.path', () => {
  it('returns [null, value] on success', async () => {
    vi.mocked(p.path).mockResolvedValue('/home/user/file.txt');
    vi.mocked(p.isCancel).mockReturnValue(false);

    const prompts = createPrompts();
    const result = await prompts.path({ message: 'Select path' });
    expect(result).toEqual([null, '/home/user/file.txt']);
  });

  it('returns [cancelled, null] on cancel', async () => {
    vi.mocked(p.path).mockResolvedValue(Symbol.for('cancel'));
    vi.mocked(p.isCancel).mockReturnValue(true);

    const prompts = createPrompts();
    const result = await prompts.path({ message: 'Select path' });
    expect(result[0]).toEqual({ cancelled: true });
    expect(result[1]).toBeNull();
  });
});
