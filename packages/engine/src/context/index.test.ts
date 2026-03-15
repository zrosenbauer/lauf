import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateLogger, mockCreatePrompts, mockCreateSpinner, mockCreateNoopSpinner } =
  vi.hoisted(() => ({
    mockCreateLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      message: vi.fn(),
      newlines: vi.fn(),
    })),
    mockCreatePrompts: vi.fn(() => ({
      text: vi.fn(),
      confirm: vi.fn(),
      select: vi.fn(),
      multiselect: vi.fn(),
      password: vi.fn(),
      path: vi.fn(),
    })),
    mockCreateSpinner: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    })),
    mockCreateNoopSpinner: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    })),
  }));

vi.mock('./logger.ts', () => ({ createLogger: mockCreateLogger }));
vi.mock('./prompts.ts', () => ({ createPrompts: mockCreatePrompts }));
vi.mock('./spinner.ts', () => ({
  createSpinner: mockCreateSpinner,
  createNoopSpinner: mockCreateNoopSpinner,
}));

import { createContext } from './index.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createContext', () => {
  const baseParams = {
    args: { name: 'Alice' },
    env: { NODE_ENV: 'test' },
    root: '/project',
    packageDir: '/project/packages/app',
    name: '@app/script',
    spinner: false,
    logger: undefined,
    watch: { enabled: false, changedFiles: [] as string[], patterns: [] as string[] },
  };

  it('returns context with correct args', () => {
    const ctx = createContext(baseParams);
    expect(ctx.args).toEqual({ name: 'Alice' });
  });

  it('returns context with frozen env', () => {
    const ctx = createContext(baseParams);
    expect(ctx.env).toEqual({ NODE_ENV: 'test' });
    expect(Object.isFrozen(ctx.env)).toBe(true);
  });

  it('returns context with correct root', () => {
    const ctx = createContext(baseParams);
    expect(ctx.root).toBe('/project');
  });

  it('returns context with correct packageDir', () => {
    const ctx = createContext(baseParams);
    expect(ctx.packageDir).toBe('/project/packages/app');
  });

  it('returns context with correct name', () => {
    const ctx = createContext(baseParams);
    expect(ctx.name).toBe('@app/script');
  });

  it('calls createLogger when logger is undefined', () => {
    createContext(baseParams);
    expect(mockCreateLogger).toHaveBeenCalledTimes(1);
  });

  it('uses provided logger when logger is defined', () => {
    const customLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      message: vi.fn(),
      newlines: vi.fn(),
    };
    const ctx = createContext({ ...baseParams, logger: customLogger });
    expect(ctx.logger).toBe(customLogger);
    expect(mockCreateLogger).not.toHaveBeenCalled();
  });

  it('calls createSpinner when spinner is true', () => {
    createContext({ ...baseParams, spinner: true });
    expect(mockCreateSpinner).toHaveBeenCalledTimes(1);
    expect(mockCreateNoopSpinner).not.toHaveBeenCalled();
  });

  it('calls createNoopSpinner when spinner is false', () => {
    createContext({ ...baseParams, spinner: false });
    expect(mockCreateNoopSpinner).toHaveBeenCalledTimes(1);
    expect(mockCreateSpinner).not.toHaveBeenCalled();
  });

  it('always creates prompts via createPrompts', () => {
    createContext(baseParams);
    expect(mockCreatePrompts).toHaveBeenCalledTimes(1);
  });

  it('assigns the result of createPrompts to context prompts', () => {
    const ctx = createContext(baseParams);
    expect(ctx.prompts).toBe(mockCreatePrompts.mock.results[0].value);
  });

  it('assigns the result of createNoopSpinner to context spinner when disabled', () => {
    const ctx = createContext({ ...baseParams, spinner: false });
    expect(ctx.spinner).toBe(mockCreateNoopSpinner.mock.results[0].value);
  });

  it('assigns the result of createSpinner to context spinner when enabled', () => {
    const ctx = createContext({ ...baseParams, spinner: true });
    expect(ctx.spinner).toBe(mockCreateSpinner.mock.results[0].value);
  });

  it('returns context with correct watch', () => {
    const ctx = createContext(baseParams);
    expect(ctx.watch).toEqual({ enabled: false, changedFiles: [], patterns: [] });
  });

  it('returns frozen watch context', () => {
    const ctx = createContext(baseParams);
    expect(Object.isFrozen(ctx.watch)).toBe(true);
    expect(Object.isFrozen(ctx.watch.changedFiles)).toBe(true);
    expect(Object.isFrozen(ctx.watch.patterns)).toBe(true);
  });
});
