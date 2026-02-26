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

import * as p from '@clack/prompts';

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

  it('has all expected methods', () => {
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
    logger.info('hello');
    expect(p.log.info).toHaveBeenCalledWith('hello');
  });

  it('delegates warn to p.log.warn', () => {
    const logger = createLogger();
    logger.warn('warning');
    expect(p.log.warn).toHaveBeenCalledWith('warning');
  });

  it('delegates error to p.log.error', () => {
    const logger = createLogger();
    logger.error('failure');
    expect(p.log.error).toHaveBeenCalledWith('failure');
  });

  it('delegates success to p.log.success', () => {
    const logger = createLogger();
    logger.success('done');
    expect(p.log.success).toHaveBeenCalledWith('done');
  });

  it('delegates message to p.log.message', () => {
    const logger = createLogger();
    logger.message('text');
    expect(p.log.message).toHaveBeenCalledWith('text');
  });

  it('newlines defaults to 1 call of console.log', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger();
    logger.newlines();
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it('newlines calls console.log n times', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger();
    logger.newlines(3);
    expect(consoleSpy).toHaveBeenCalledTimes(3);
  });

  it('newlines with 0 calls console.log zero times', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger();
    logger.newlines(0);
    expect(consoleSpy).toHaveBeenCalledTimes(0);
  });

  it('newlines with negative value calls console.log zero times', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger();
    logger.newlines(-5);
    expect(consoleSpy).toHaveBeenCalledTimes(0);
  });
});
