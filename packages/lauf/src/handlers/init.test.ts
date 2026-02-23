import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DiscoveredConfig } from '../lib/config-discovery.ts';

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

vi.mock('../lib/config-discovery.ts', () => ({
  findConfigFile: vi.fn(() => undefined),
}));

vi.mock('../templates/config.ts', () => ({
  configTemplate: vi.fn(() => 'config content'),
}));

import { findConfigFile } from '../lib/config-discovery.ts';
import initHandler from './init.ts';

beforeEach(() => {
  vi.clearAllMocks();
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

  it('fails when findConfigFile returns an existing config', async () => {
    const existing: DiscoveredConfig = {
      configFile: '/workspace/lauf.config.ts',
      configDir: '/workspace',
      configName: 'lauf',
    };
    vi.mocked(findConfigFile).mockReturnValue(existing);

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

  it('calls findConfigFile with cwd', async () => {
    mockWriteFileSync.mockReturnValue(undefined);

    await initHandler({} as never);

    expect(findConfigFile).toHaveBeenCalledWith('/workspace/packages/my-pkg');
  });
});
