import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSpinner = {
  start: vi.fn(),
  stop: vi.fn(),
  message: vi.fn(),
};

vi.mock('@clack/prompts', () => ({
  spinner: vi.fn(() => mockSpinner),
}));

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

  it('has start, stop, and message methods', () => {
    const spinner = createSpinner();
    expect(typeof spinner.start).toBe('function');
    expect(typeof spinner.stop).toBe('function');
    expect(typeof spinner.message).toBe('function');
  });

  it('calls p.spinner on creation', () => {
    createSpinner();
    expect(p.spinner).toHaveBeenCalled();
  });

  it('delegates start with message', () => {
    const spinner = createSpinner();
    spinner.start('Loading...');
    expect(mockSpinner.start).toHaveBeenCalledWith('Loading...');
  });

  it('delegates start without message', () => {
    const spinner = createSpinner();
    spinner.start();
    expect(mockSpinner.start).toHaveBeenCalledWith(undefined);
  });

  it('delegates stop with message', () => {
    const spinner = createSpinner();
    spinner.stop('Done');
    expect(mockSpinner.stop).toHaveBeenCalledWith('Done');
  });

  it('delegates stop without message', () => {
    const spinner = createSpinner();
    spinner.stop();
    expect(mockSpinner.stop).toHaveBeenCalledWith(undefined);
  });

  it('delegates message update', () => {
    const spinner = createSpinner();
    spinner.message('Processing...');
    expect(mockSpinner.message).toHaveBeenCalledWith('Processing...');
  });

  it('delegates message without value', () => {
    const spinner = createSpinner();
    spinner.message();
    expect(mockSpinner.message).toHaveBeenCalledWith(undefined);
  });
});

describe('createNoopSpinner', () => {
  it('returns a frozen object', () => {
    const spinner = createNoopSpinner();
    expect(Object.isFrozen(spinner)).toBe(true);
  });

  it('has start, stop, and message methods', () => {
    const spinner = createNoopSpinner();
    expect(typeof spinner.start).toBe('function');
    expect(typeof spinner.stop).toBe('function');
    expect(typeof spinner.message).toBe('function');
  });

  it('does not call p.spinner', () => {
    createNoopSpinner();
    expect(p.spinner).not.toHaveBeenCalled();
  });

  it('start does nothing', () => {
    const spinner = createNoopSpinner();
    spinner.start('Loading...');
    expect(mockSpinner.start).not.toHaveBeenCalled();
  });

  it('stop does nothing', () => {
    const spinner = createNoopSpinner();
    spinner.stop('Done');
    expect(mockSpinner.stop).not.toHaveBeenCalled();
  });

  it('message does nothing', () => {
    const spinner = createNoopSpinner();
    spinner.message('Processing...');
    expect(mockSpinner.message).not.toHaveBeenCalled();
  });
});
