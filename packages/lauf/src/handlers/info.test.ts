import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../lib/config.ts', () => ({
  safeLoadLaufConfigWithMeta: vi.fn(),
}));

vi.mock('../lib/discovery.ts', () => ({
  discoverScripts: vi.fn(() => []),
  findScript: vi.fn(),
}));

vi.mock('../lib/paths.ts', () => ({
  getWorkspaceRoot: vi.fn(() => '/workspace'),
  LAUF_ROOT: '/lauf-root',
}));

vi.mock('../runtime/runner.ts', () => ({
  runScript: vi.fn(),
}));

vi.mock('../utils/prompt.ts', () => ({
  promptForScript: vi.fn(),
}));

import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { findScript } from '../lib/discovery.ts';
import type { DiscoveredScript } from '../lib/types.ts';
import { runScript } from '../runtime/runner.ts';
import { promptForScript } from '../utils/prompt.ts';
import infoHandler from './info.ts';

const mockScript: DiscoveredScript = {
  name: 'my-pkg/build',
  path: '/workspace/packages/my-pkg/scripts/build.ts',
  packageDir: '/workspace/packages/my-pkg',
  packageName: 'my-pkg',
};

const mockLoadedConfig = {
  config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
  configFile: '/workspace/lauf.config.ts',
  configDir: '/workspace',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('info handler', () => {
  it('shows help for a named script', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    await infoHandler({ parameters: { script: 'my-pkg/build' } } as never);

    expect(runScript).toHaveBeenCalledWith(mockScript, {}, { help: true, configDir: '/workspace' });
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('prompts for script when name not provided', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(promptForScript).mockResolvedValue([null, mockScript]);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    await infoHandler({ parameters: {} } as never);

    expect(promptForScript).toHaveBeenCalled();
    expect(runScript).toHaveBeenCalledWith(mockScript, {}, { help: true, configDir: '/workspace' });
  });

  it('fails when script not found by name', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(undefined);

    await infoHandler({ parameters: { script: 'nonexistent' } } as never);

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('fails when config cannot be loaded', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([new Error('err'), null]);

    await infoHandler({ parameters: { script: 'my-pkg/build' } } as never);

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('fails when help execution returns non-zero exit code', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 1, script: mockScript });

    await infoHandler({ parameters: { script: 'my-pkg/build' } } as never);

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('fails when prompt returns error', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(promptForScript).mockResolvedValue([{ message: 'Cancelled', exitCode: 0 }, null]);

    await infoHandler({ parameters: {} } as never);

    expect(process.exit).toHaveBeenCalledWith(0);
  });
});
