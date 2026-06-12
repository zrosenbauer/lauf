import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Workspace, WorkspaceRoot } from '../lib/workspace/types.ts';

const { mockWriteFileSync } = vi.hoisted(() => ({
  mockWriteFileSync: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    writeFileSync: mockWriteFileSync,
  };
});

vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../lib/workspace/discovery.ts', () => ({
  findNearestWorkspace: vi.fn(() => undefined),
}));

vi.mock('../lib/workspace/root.ts', () => ({
  resolveRoot: vi.fn((): WorkspaceRoot => ({ dir: '/workspace', source: 'git' })),
}));

vi.mock('../templates/config.ts', () => ({
  configTemplate: vi.fn(() => 'config content'),
}));

import { findNearestWorkspace } from '../lib/workspace/discovery.ts';
import { resolveRoot } from '../lib/workspace/root.ts';
import initHandler from './init.ts';

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteFileSync.mockReset();
  vi.mocked(findNearestWorkspace).mockReturnValue(undefined);
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  vi.spyOn(process, 'cwd').mockReturnValue('/workspace/packages/my-pkg');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('init handler', () => {
  it('writes config file to cwd using wx flag', async () => {
    mockWriteFileSync.mockReturnValue(undefined);

    await initHandler({} as never);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/workspace/packages/my-pkg/lauf.config.ts',
      'config content',
      {
        encoding: 'utf-8',
        flag: 'wx',
      },
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('logs success message on successful init', async () => {
    mockWriteFileSync.mockReturnValue(undefined);

    await initHandler({} as never);

    expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining('lauf.config.ts'));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('fails when findNearestWorkspace returns an existing workspace', async () => {
    const existing: Workspace = {
      name: 'my-project',
      dir: '/workspace',
      configFile: '/workspace/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    };
    vi.mocked(findNearestWorkspace).mockReturnValue(existing);

    await initHandler({} as never);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Already initialized'));
  });

  it('fails when config file already exists (EEXIST)', async () => {
    const eexistError = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    mockWriteFileSync.mockImplementation(() => {
      throw eexistError;
    });

    await initHandler({} as never);

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('already exists'));
  });

  it('fails when write errors with non-EEXIST error', async () => {
    mockWriteFileSync.mockImplementation(() => {
      throw new Error('EACCES');
    });

    await initHandler({} as never);

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Failed to write'));
  });

  it('calls resolveRoot and findNearestWorkspace with cwd', async () => {
    mockWriteFileSync.mockReturnValue(undefined);

    await initHandler({} as never);

    expect(resolveRoot).toHaveBeenCalledWith('/workspace/packages/my-pkg');
    expect(findNearestWorkspace).toHaveBeenCalledWith('/workspace/packages/my-pkg', {
      dir: '/workspace',
      source: 'git',
    });
  });
});
