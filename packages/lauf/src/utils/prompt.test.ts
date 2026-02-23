import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { promptForScript, promptForText } from './prompt.ts';

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  text: vi.fn(),
  isCancel: vi.fn(),
  cancel: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('promptForScript', () => {
  it('returns fail when scripts array is empty', async () => {
    const [error, result] = await promptForScript([]);
    expect(error).not.toBeNull();
    expect(error).toMatchObject({ message: 'No scripts found' });
    expect(result).toBeNull();
  });

  it('returns fail with hint when scripts array is empty', async () => {
    const [error] = await promptForScript([]);
    expect(error).toMatchObject({ hint: 'Run `lauf init` to get started.' });
  });

  it('returns selected script on success', async () => {
    const script = {
      name: 'pkg/my-script',
      path: '/path/to/script.ts',
      packageDir: '/path/to',
      packageName: 'pkg',
    };
    vi.mocked(p.select).mockResolvedValue(script);
    vi.mocked(p.isCancel).mockReturnValue(false);

    const [error, result] = await promptForScript([script]);
    expect(error).toBeNull();
    expect(result).toBe(script);
  });

  it('returns fail when user cancels', async () => {
    const script = {
      name: 'pkg/my-script',
      path: '/path/to/script.ts',
      packageDir: '/path/to',
      packageName: 'pkg',
    };
    vi.mocked(p.select).mockResolvedValue(Symbol('cancel'));
    vi.mocked(p.isCancel).mockReturnValue(true);

    const [error, result] = await promptForScript([script]);
    expect(error).toMatchObject({ message: 'Cancelled', exitCode: 0 });
    expect(result).toBeNull();
  });

  it('calls p.cancel on cancellation', async () => {
    const script = {
      name: 'pkg/my-script',
      path: '/path/to/script.ts',
      packageDir: '/path/to',
      packageName: 'pkg',
    };
    vi.mocked(p.select).mockResolvedValue(Symbol('cancel'));
    vi.mocked(p.isCancel).mockReturnValue(true);

    await promptForScript([script]);
    expect(p.cancel).toHaveBeenCalledWith('Cancelled');
  });

  it('presents scripts as select options', async () => {
    const scripts = [
      { name: 'pkg/a', path: '/a.ts', packageDir: '/pkg', packageName: 'pkg' },
      { name: 'pkg/b', path: '/b.ts', packageDir: '/pkg', packageName: 'pkg' },
    ];
    vi.mocked(p.select).mockResolvedValue(scripts[0]);
    vi.mocked(p.isCancel).mockReturnValue(false);

    await promptForScript(scripts);
    expect(p.select).toHaveBeenCalledWith({
      message: 'Select a script',
      options: [
        { value: scripts[0], label: 'pkg/a' },
        { value: scripts[1], label: 'pkg/b' },
      ],
    });
  });
});

describe('promptForText', () => {
  it('returns entered text on success', async () => {
    vi.mocked(p.text).mockResolvedValue('hello world');
    vi.mocked(p.isCancel).mockReturnValue(false);

    const [error, result] = await promptForText('Enter value');
    expect(error).toBeNull();
    expect(result).toBe('hello world');
  });

  it('returns fail when user cancels', async () => {
    vi.mocked(p.text).mockResolvedValue(Symbol('cancel'));
    vi.mocked(p.isCancel).mockReturnValue(true);

    const [error, result] = await promptForText('Enter value');
    expect(error).toMatchObject({ message: 'Cancelled', exitCode: 0 });
    expect(result).toBeNull();
  });

  it('passes message and placeholder to p.text', async () => {
    vi.mocked(p.text).mockResolvedValue('value');
    vi.mocked(p.isCancel).mockReturnValue(false);

    await promptForText('Enter name', 'my-name');
    expect(p.text).toHaveBeenCalledWith({
      message: 'Enter name',
      placeholder: 'my-name',
    });
  });

  it('passes undefined placeholder when not provided', async () => {
    vi.mocked(p.text).mockResolvedValue('value');
    vi.mocked(p.isCancel).mockReturnValue(false);

    await promptForText('Enter name');
    expect(p.text).toHaveBeenCalledWith({
      message: 'Enter name',
      placeholder: undefined,
    });
  });

  it('calls p.cancel on cancellation', async () => {
    vi.mocked(p.text).mockResolvedValue(Symbol('cancel'));
    vi.mocked(p.isCancel).mockReturnValue(true);

    await promptForText('Enter name');
    expect(p.cancel).toHaveBeenCalledWith('Cancelled');
  });
});
