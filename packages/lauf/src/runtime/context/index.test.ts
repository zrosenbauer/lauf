import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  message: vi.fn(),
  newlines: vi.fn(),
};

const mockSpinner = {
  start: vi.fn(),
  stop: vi.fn(),
  message: vi.fn(),
};

const mockNoopSpinner = {
  start: vi.fn(),
  stop: vi.fn(),
  message: vi.fn(),
};

const mockPrompts = {
  text: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  password: vi.fn(),
  path: vi.fn(),
};

vi.mock('./logger.ts', () => ({
  createLogger: vi.fn(() => mockLogger),
}));

vi.mock('./spinner.ts', () => ({
  createSpinner: vi.fn(() => mockSpinner),
  createNoopSpinner: vi.fn(() => mockNoopSpinner),
}));

vi.mock('./prompts.ts', () => ({
  createPrompts: vi.fn(() => mockPrompts),
}));

import { createContext } from './index.ts';
import { createLogger } from './logger.ts';
import { createNoopSpinner, createSpinner } from './spinner.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createContext', () => {
  const baseParams = {
    args: { name: 'test', verbose: true },
    root: '/workspace',
    packageDir: '/workspace/packages/my-pkg',
    name: 'my-pkg/build',
    config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
  };

  it('returns context with all required fields', () => {
    const ctx = createContext(baseParams);
    expect(ctx.args).toEqual({ name: 'test', verbose: true });
    expect(ctx.root).toBe('/workspace');
    expect(ctx.packageDir).toBe('/workspace/packages/my-pkg');
    expect(ctx.name).toBe('my-pkg/build');
    expect(ctx.logger).toBeDefined();
    expect(ctx.spinner).toBeDefined();
    expect(ctx.prompts).toBeDefined();
  });

  it('uses default logger when config.logger is undefined', () => {
    createContext(baseParams);
    expect(createLogger).toHaveBeenCalled();
  });

  it('uses config logger when provided', () => {
    const customLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      message: vi.fn(),
      newlines: vi.fn(),
    };
    const params = {
      ...baseParams,
      config: { scripts: ['scripts/*.ts'], logger: customLogger, spinner: true },
    };

    const ctx = createContext(params);
    expect(ctx.logger).toBe(customLogger);
  });

  it('passes args through to context', () => {
    const args = { output: '/dist', count: 5 };
    const ctx = createContext({ ...baseParams, args });
    expect(ctx.args).toBe(args);
  });

  it('creates spinner when config.spinner is true', () => {
    const ctx = createContext(baseParams);
    expect(ctx.spinner).toBe(mockSpinner);
    expect(createSpinner).toHaveBeenCalled();
  });

  it('creates noop spinner when config.spinner is false', () => {
    const params = {
      ...baseParams,
      config: { ...baseParams.config, spinner: false },
    };
    const ctx = createContext(params);
    expect(ctx.spinner).toBe(mockNoopSpinner);
    expect(createNoopSpinner).toHaveBeenCalled();
    expect(createSpinner).not.toHaveBeenCalled();
  });

  it('creates prompts for context', () => {
    const ctx = createContext(baseParams);
    expect(ctx.prompts).toBe(mockPrompts);
  });
});
