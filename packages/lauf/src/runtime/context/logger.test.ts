import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clack/prompts', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  },
}));

import { createLogger } from './logger.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createLogger', () => {
  it('returns a frozen object', () => {
    const logger = createLogger();
    expect(Object.isFrozen(logger)).toBe(true);
  });

  it('has all required methods', () => {
    const logger = createLogger();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.success).toBe('function');
    expect(typeof logger.message).toBe('function');
    expect(typeof logger.newlines).toBe('function');
  });

  it('delegates info to p.log.info', () => {
    const logger = createLogger();
    logger.info('info message');
    expect(p.log.info).toHaveBeenCalledWith('info message');
  });

  it('delegates warn to p.log.warn', () => {
    const logger = createLogger();
    logger.warn('warning');
    expect(p.log.warn).toHaveBeenCalledWith('warning');
  });

  it('delegates error to p.log.error', () => {
    const logger = createLogger();
    logger.error('error message');
    expect(p.log.error).toHaveBeenCalledWith('error message');
  });

  it('delegates success to p.log.success', () => {
    const logger = createLogger();
    logger.success('done');
    expect(p.log.success).toHaveBeenCalledWith('done');
  });

  it('delegates message to p.log.message', () => {
    const logger = createLogger();
    logger.message('plain message');
    expect(p.log.message).toHaveBeenCalledWith('plain message');
  });

  it('newlines calls console.log n times', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger();

    logger.newlines(3);
    expect(consoleSpy).toHaveBeenCalledTimes(3);

    consoleSpy.mockRestore();
  });

  it('newlines defaults to 1', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger();

    logger.newlines();
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });
});
