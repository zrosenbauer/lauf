import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSpinnerHandle } = vi.hoisted(() => ({
  mockSpinnerHandle: {
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock('@clack/prompts', () => ({
  spinner: vi.fn(() => mockSpinnerHandle),
}));

import * as p from '@clack/prompts';

import { createNoopSpinner, createSpinner } from './spinner.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createSpinner', () => {
  it('returns a frozen object', () => {
    const spinner = createSpinner();
    expect(Object.isFrozen(spinner)).toBe(true);
  });

  it('calls p.spinner to create the handle', () => {
    createSpinner();
    expect(p.spinner).toHaveBeenCalledTimes(1);
  });

  it('delegates start to spinner handle', () => {
    const spinner = createSpinner();
    spinner.start('loading');
    expect(mockSpinnerHandle.start).toHaveBeenCalledWith('loading');
  });

  it('delegates stop to spinner handle', () => {
    const spinner = createSpinner();
    spinner.stop('done');
    expect(mockSpinnerHandle.stop).toHaveBeenCalledWith('done');
  });

  it('delegates message to spinner handle', () => {
    const spinner = createSpinner();
    spinner.message('updating');
    expect(mockSpinnerHandle.message).toHaveBeenCalledWith('updating');
  });

  it('delegates start without message', () => {
    const spinner = createSpinner();
    spinner.start();
    expect(mockSpinnerHandle.start).toHaveBeenCalledWith(undefined);
  });

  it('delegates stop without message', () => {
    const spinner = createSpinner();
    spinner.stop();
    expect(mockSpinnerHandle.stop).toHaveBeenCalledWith(undefined);
  });

  it('delegates message without argument', () => {
    const spinner = createSpinner();
    spinner.message();
    expect(mockSpinnerHandle.message).toHaveBeenCalledWith(undefined);
  });
});

describe('createNoopSpinner', () => {
  it('returns a frozen object', () => {
    const spinner = createNoopSpinner();
    expect(Object.isFrozen(spinner)).toBe(true);
  });

  it('does not call p.spinner', () => {
    vi.clearAllMocks();
    createNoopSpinner();
    expect(p.spinner).not.toHaveBeenCalled();
  });

  it('start does not throw', () => {
    const spinner = createNoopSpinner();
    expect(() => spinner.start('test')).not.toThrow();
  });

  it('stop does not throw', () => {
    const spinner = createNoopSpinner();
    expect(() => spinner.stop('test')).not.toThrow();
  });

  it('message does not throw', () => {
    const spinner = createNoopSpinner();
    expect(() => spinner.message('test')).not.toThrow();
  });

  it('start does not delegate to spinner handle', () => {
    vi.clearAllMocks();
    const spinner = createNoopSpinner();
    spinner.start('test');
    expect(mockSpinnerHandle.start).not.toHaveBeenCalled();
  });

  it('has all expected methods', () => {
    const spinner = createNoopSpinner();
    expect(typeof spinner.start).toBe('function');
    expect(typeof spinner.stop).toBe('function');
    expect(typeof spinner.message).toBe('function');
  });
});
