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

vi.mock('../lib/paths.ts', () => ({
  LAUF_ROOT: '/lauf-root',
}));

vi.mock('../lib/workspace/index.ts', () => ({
  getWorkspaceState: vi.fn(() => ({
    root: { dir: '/workspace', source: 'git' },
    tree: { root: { dir: '/workspace', source: 'git' }, workspaces: [] },
    current: {
      name: 'my-pkg',
      dir: '/workspace/packages/my-pkg',
      configFile: '/workspace/packages/my-pkg/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    },
  })),
}));

vi.mock('@laufen/engine', () => ({
  runScript: vi.fn(),
  resolveEnvValue: vi.fn(() => Promise.resolve([null, {}])),
}));

vi.mock('../utils/resolve-script.ts', () => ({
  resolveScript: vi.fn(),
}));

import { resolveEnvValue, runScript } from '@laufen/engine';

import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import type { DiscoveredScript } from '../lib/workspace/types.ts';
import { resolveScript } from '../utils/resolve-script.ts';
import infoHandler from './info.ts';

const mockScript: DiscoveredScript = {
  name: 'my-pkg/build',
  path: '/workspace/packages/my-pkg/scripts/build.ts',
  packageDir: '/workspace/packages/my-pkg',
  workspaceName: 'my-pkg',
};

const mockLoadedConfig = {
  config: {
    root: false,
    scripts: ['scripts/*.ts'],
    logger: undefined,
    spinner: true,
    sandbox: true,
    env: {},
    packages: { chalk: '^5.0.0' },
    watch: undefined,
  },
  configFile: '/workspace/lauf.config.ts',
  configDir: '/workspace',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  // Default: resolveEnvValue succeeds with empty object
  vi.mocked(resolveEnvValue).mockResolvedValue([null, {}]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('info handler', () => {
  it('shows help for a named script', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(resolveScript).mockResolvedValue([null, mockScript]);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    await infoHandler({ parameters: { script: 'my-pkg/build' } } as never);

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      {},
      {
        help: true,
        workspaceRoot: '/workspace',
        cliPackageRoot: '/lauf-root',
        spinner: true,
        env: {},
        workspacePackages: { chalk: '^5.0.0' },
        sandbox: true,
      },
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('prompts for script when name not provided', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(resolveScript).mockResolvedValue([null, mockScript]);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    await infoHandler({ parameters: {} } as never);

    expect(resolveScript).toHaveBeenCalledWith(undefined, ['scripts/*.ts']);
    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      {},
      {
        help: true,
        workspaceRoot: '/workspace',
        cliPackageRoot: '/lauf-root',
        spinner: true,
        env: {},
        workspacePackages: { chalk: '^5.0.0' },
        sandbox: true,
      },
    );
  });

  it('fails when script not found by name', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(resolveScript).mockResolvedValue([
      {
        message: 'Script not found: nonexistent',
        hint: 'Run `lauf list` to see available scripts.',
      },
      null,
    ]);

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
    vi.mocked(resolveScript).mockResolvedValue([null, mockScript]);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 1, script: mockScript });

    await infoHandler({ parameters: { script: 'my-pkg/build' } } as never);

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('fails when prompt returns error', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(resolveScript).mockResolvedValue([{ message: 'Cancelled', exitCode: 0 }, null]);

    await infoHandler({ parameters: {} } as never);

    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('fails when resolveEnvValue returns error', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(resolveScript).mockResolvedValue([null, mockScript]);
    vi.mocked(resolveEnvValue).mockResolvedValue([new Error('env fn failed'), null]);

    await infoHandler({ parameters: { script: 'my-pkg/build' } } as never);

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
