import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockText, mockConfirm, mockSelect, mockMultiselect, mockPassword, mockPath, mockIsCancel } =
  vi.hoisted(() => ({
    mockText: vi.fn(),
    mockConfirm: vi.fn(),
    mockSelect: vi.fn(),
    mockMultiselect: vi.fn(),
    mockPassword: vi.fn(),
    mockPath: vi.fn(),
    mockIsCancel: vi.fn(),
  }));

vi.mock('@clack/prompts', () => ({
  text: mockText,
  confirm: mockConfirm,
  select: mockSelect,
  multiselect: mockMultiselect,
  password: mockPassword,
  path: mockPath,
  isCancel: mockIsCancel,
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

  it('has all 6 methods', () => {
    const prompts = createPrompts();
    expect(typeof prompts.text).toBe('function');
    expect(typeof prompts.confirm).toBe('function');
    expect(typeof prompts.select).toBe('function');
    expect(typeof prompts.multiselect).toBe('function');
    expect(typeof prompts.password).toBe('function');
    expect(typeof prompts.path).toBe('function');
  });

  describe('text', () => {
    it('returns ok tuple on success', async () => {
      mockText.mockResolvedValue('hello');
      mockIsCancel.mockReturnValue(false);
      const prompts = createPrompts();

      const [error, value] = await prompts.text({ message: 'Enter text' });

      expect(error).toBeNull();
      expect(value).toBe('hello');
      expect(mockText).toHaveBeenCalledWith({ message: 'Enter text' });
    });

    it('returns cancelled tuple on cancel', async () => {
      const cancelSymbol = Symbol('cancel');
      mockText.mockResolvedValue(cancelSymbol);
      mockIsCancel.mockReturnValue(true);
      const prompts = createPrompts();

      const [error, value] = await prompts.text({ message: 'Enter text' });

      expect(error).toEqual({ cancelled: true });
      expect(value).toBeNull();
    });
  });

  describe('confirm', () => {
    it('returns ok tuple on success', async () => {
      mockConfirm.mockResolvedValue(true);
      mockIsCancel.mockReturnValue(false);
      const prompts = createPrompts();

      const [error, value] = await prompts.confirm({ message: 'Continue?' });

      expect(error).toBeNull();
      expect(value).toBe(true);
      expect(mockConfirm).toHaveBeenCalledWith({ message: 'Continue?' });
    });

    it('returns cancelled tuple on cancel', async () => {
      const cancelSymbol = Symbol('cancel');
      mockConfirm.mockResolvedValue(cancelSymbol);
      mockIsCancel.mockReturnValue(true);
      const prompts = createPrompts();

      const [error, value] = await prompts.confirm({ message: 'Continue?' });

      expect(error).toEqual({ cancelled: true });
      expect(value).toBeNull();
    });
  });

  describe('select', () => {
    it('returns ok tuple on success', async () => {
      mockSelect.mockResolvedValue('option-a');
      mockIsCancel.mockReturnValue(false);
      const prompts = createPrompts();
      const opts = {
        message: 'Pick one',
        options: [{ value: 'option-a', label: 'Option A' }],
      };

      const [error, value] = await prompts.select(opts);

      expect(error).toBeNull();
      expect(value).toBe('option-a');
    });

    it('returns cancelled tuple on cancel', async () => {
      const cancelSymbol = Symbol('cancel');
      mockSelect.mockResolvedValue(cancelSymbol);
      mockIsCancel.mockReturnValue(true);
      const prompts = createPrompts();
      const opts = {
        message: 'Pick one',
        options: [{ value: 'option-a', label: 'Option A' }],
      };

      const [error, value] = await prompts.select(opts);

      expect(error).toEqual({ cancelled: true });
      expect(value).toBeNull();
    });
  });

  describe('multiselect', () => {
    it('returns ok tuple on success', async () => {
      mockMultiselect.mockResolvedValue(['a', 'b']);
      mockIsCancel.mockReturnValue(false);
      const prompts = createPrompts();
      const opts = {
        message: 'Pick many',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      };

      const [error, value] = await prompts.multiselect(opts);

      expect(error).toBeNull();
      expect(value).toEqual(['a', 'b']);
    });

    it('returns cancelled tuple on cancel', async () => {
      const cancelSymbol = Symbol('cancel');
      mockMultiselect.mockResolvedValue(cancelSymbol);
      mockIsCancel.mockReturnValue(true);
      const prompts = createPrompts();
      const opts = {
        message: 'Pick many',
        options: [{ value: 'a', label: 'A' }],
      };

      const [error, value] = await prompts.multiselect(opts);

      expect(error).toEqual({ cancelled: true });
      expect(value).toBeNull();
    });
  });

  describe('password', () => {
    it('returns ok tuple on success', async () => {
      mockPassword.mockResolvedValue('secret');
      mockIsCancel.mockReturnValue(false);
      const prompts = createPrompts();

      const [error, value] = await prompts.password({ message: 'Enter password' });

      expect(error).toBeNull();
      expect(value).toBe('secret');
      expect(mockPassword).toHaveBeenCalledWith({ message: 'Enter password' });
    });

    it('returns cancelled tuple on cancel', async () => {
      const cancelSymbol = Symbol('cancel');
      mockPassword.mockResolvedValue(cancelSymbol);
      mockIsCancel.mockReturnValue(true);
      const prompts = createPrompts();

      const [error, value] = await prompts.password({ message: 'Enter password' });

      expect(error).toEqual({ cancelled: true });
      expect(value).toBeNull();
    });
  });

  describe('path', () => {
    it('returns ok tuple on success', async () => {
      mockPath.mockResolvedValue('/usr/local');
      mockIsCancel.mockReturnValue(false);
      const prompts = createPrompts();

      const [error, value] = await prompts.path({ message: 'Enter path' });

      expect(error).toBeNull();
      expect(value).toBe('/usr/local');
      expect(mockPath).toHaveBeenCalledWith({ message: 'Enter path' });
    });

    it('returns cancelled tuple on cancel', async () => {
      const cancelSymbol = Symbol('cancel');
      mockPath.mockResolvedValue(cancelSymbol);
      mockIsCancel.mockReturnValue(true);
      const prompts = createPrompts();

      const [error, value] = await prompts.path({ message: 'Enter path' });

      expect(error).toEqual({ cancelled: true });
      expect(value).toBeNull();
    });
  });
});
