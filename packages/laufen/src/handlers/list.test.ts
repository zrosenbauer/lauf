import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Workspace, WorkspaceRoot } from '../lib/workspace/types.ts';

vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
  },
  note: vi.fn(),
}));

vi.mock('../lib/config.ts', () => ({
  safeLoadLaufConfigWithMeta: vi.fn(),
  loadAllLaufConfigs: vi.fn(),
}));

vi.mock('../lib/paths.ts', () => ({
  LAUF_ROOT: '/lauf-root',
}));

const mockRoot: WorkspaceRoot = { dir: '/workspace', source: 'git' };

const mockCurrentWorkspace: Workspace = {
  name: 'my-pkg',
  dir: '/workspace/packages/my-pkg',
  configFile: '/workspace/packages/my-pkg/lauf.config.ts',
  configName: 'lauf',
  isRoot: false,
};

vi.mock('../lib/workspace/index.ts', () => ({
  getWorkspaceState: vi.fn(() => ({
    root: mockRoot,
    tree: { root: mockRoot, workspaces: [mockCurrentWorkspace] },
    current: mockCurrentWorkspace,
  })),
}));

vi.mock('../lib/workspace/scripts.ts', () => ({
  ROOT_WORKSPACE_NAME: '<root>',
  discoverWorkspaceScripts: vi.fn(() => []),
}));

vi.mock('@laufen/engine', () => ({
  loadDescriptions: vi.fn(() => Promise.resolve({})),
}));

import { loadDescriptions } from '@laufen/engine';

import { loadAllLaufConfigs, safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { getWorkspaceState } from '../lib/workspace/index.ts';
import { discoverWorkspaceScripts } from '../lib/workspace/scripts.ts';
import listHandler from './list.ts';

const baseConfig = {
  root: false,
  scripts: ['scripts/*.ts'],
  logger: undefined,
  spinner: true,
  sandbox: true,
  env: {},
  packages: {},
  watch: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getWorkspaceState).mockReturnValue({
    root: mockRoot,
    tree: { root: mockRoot, workspaces: [mockCurrentWorkspace] },
    current: mockCurrentWorkspace,
  });
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('list handler', () => {
  it('displays scripts when found', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace' },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue([
      {
        name: 'my-pkg/build',
        path: '/workspace/packages/my-pkg/scripts/build.ts',
        packageDir: '/workspace/packages/my-pkg',
        workspaceName: 'my-pkg',
      },
      {
        name: 'my-pkg/test',
        path: '/workspace/packages/my-pkg/scripts/test.ts',
        packageDir: '/workspace/packages/my-pkg',
        workspaceName: 'my-pkg',
      },
    ]);

    await listHandler({ flags: {} });

    expect(p.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('2 script(s)'));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('shows warning when no scripts found', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace' },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue([]);

    await listHandler({ flags: {} });

    expect(p.log.warn).toHaveBeenCalledWith('No scripts found.');
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('fails when config cannot be loaded', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([new Error('config error'), null]);

    await listHandler({ flags: {} });

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('calls discoverWorkspaceScripts with current workspace and config patterns', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { ...baseConfig, scripts: ['src/**/*.ts'] },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue([]);

    await listHandler({ flags: {} });

    expect(discoverWorkspaceScripts).toHaveBeenCalledWith(
      mockCurrentWorkspace,
      ['src/**/*.ts'],
      mockRoot,
    );
  });

  it('calls loadDescriptions with scripts and options', async () => {
    const scripts = [
      {
        name: 'my-pkg/build',
        path: '/workspace/packages/my-pkg/scripts/build.ts',
        packageDir: '/workspace/packages/my-pkg',
        workspaceName: 'my-pkg',
      },
    ];
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace' },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue(scripts);

    await listHandler({ flags: {} });

    expect(loadDescriptions).toHaveBeenCalledWith(scripts, {
      workspaceRoot: '/workspace',
      cliPackageRoot: '/lauf-root',
    });
  });

  it('displays descriptions from loadDescriptions in tree output', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace' },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue([
      {
        name: 'my-pkg/build',
        path: '/workspace/packages/my-pkg/scripts/build.ts',
        packageDir: '/workspace/packages/my-pkg',
        workspaceName: 'my-pkg',
      },
      {
        name: 'my-pkg/test',
        path: '/workspace/packages/my-pkg/scripts/test.ts',
        packageDir: '/workspace/packages/my-pkg',
        workspaceName: 'my-pkg',
      },
    ]);
    vi.mocked(loadDescriptions).mockResolvedValue({
      '/workspace/packages/my-pkg/scripts/build.ts': 'Build the project',
      '/workspace/packages/my-pkg/scripts/test.ts': 'Run tests',
    });

    await listHandler({ flags: {} });

    expect(p.note).toHaveBeenCalledWith(
      expect.stringContaining('Build the project'),
      expect.stringContaining('2 script(s)'),
    );
    expect(process.exit).not.toHaveBeenCalled();
  });
});

describe('list handler --all flag', () => {
  it('calls loadAllLaufConfigs and discoverWorkspaceScripts when --all is set', async () => {
    const ws: Workspace = {
      name: 'pkg',
      dir: '/workspace/packages/pkg',
      configFile: '/workspace/packages/pkg/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    };
    vi.mocked(getWorkspaceState).mockReturnValue({
      root: mockRoot,
      tree: { root: mockRoot, workspaces: [ws] },
      current: ws,
    });
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace/packages/pkg' },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue([
      {
        name: 'pkg/build',
        path: '/workspace/packages/pkg/scripts/build.ts',
        packageDir: '/workspace/packages/pkg',
        workspaceName: 'pkg',
      },
    ]);

    await listHandler({ flags: { all: true } });

    expect(loadAllLaufConfigs).toHaveBeenCalledWith(process.cwd());
    expect(discoverWorkspaceScripts).toHaveBeenCalledWith(ws, ['scripts/*.ts'], mockRoot);
    expect(p.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('1 script(s)'));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('does not call safeLoadLaufConfigWithMeta when --all is set', async () => {
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace' },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue([]);

    await listHandler({ flags: { all: true } });

    expect(safeLoadLaufConfigWithMeta).not.toHaveBeenCalled();
    expect(loadAllLaufConfigs).toHaveBeenCalled();
  });

  it('aggregates scripts from multiple configs', async () => {
    const wsA: Workspace = {
      name: 'app',
      dir: '/workspace/packages/app',
      configFile: '/workspace/packages/app/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    };
    const wsB: Workspace = {
      name: 'api',
      dir: '/workspace/packages/api',
      configFile: '/workspace/packages/api/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    };
    vi.mocked(getWorkspaceState).mockReturnValue({
      root: mockRoot,
      tree: { root: mockRoot, workspaces: [wsA, wsB] },
      current: wsA,
    });
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace/packages/app' },
      {
        config: { ...baseConfig, scripts: ['tasks/*.ts'] },
        configFile: 'lauf.config.ts',
        configDir: '/workspace/packages/api',
      },
    ]);
    vi.mocked(discoverWorkspaceScripts)
      .mockReturnValueOnce([
        {
          name: 'app/build',
          path: '/workspace/packages/app/scripts/build.ts',
          packageDir: '/workspace/packages/app',
          workspaceName: 'app',
        },
      ])
      .mockReturnValueOnce([
        {
          name: 'api/migrate',
          path: '/workspace/packages/api/tasks/migrate.ts',
          packageDir: '/workspace/packages/api',
          workspaceName: 'api',
        },
      ]);

    await listHandler({ flags: { all: true } });

    expect(discoverWorkspaceScripts).toHaveBeenCalledTimes(2);
    expect(p.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('2 script(s)'));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('shows warning when --all finds no scripts across all configs', async () => {
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace' },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue([]);

    await listHandler({ flags: { all: true } });

    expect(p.log.warn).toHaveBeenCalledWith('No scripts found.');
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('uses current workspace when --all is not set', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace' },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue([]);

    await listHandler({ flags: {} });

    expect(safeLoadLaufConfigWithMeta).toHaveBeenCalledWith(process.cwd());
    expect(loadAllLaufConfigs).not.toHaveBeenCalled();
    expect(discoverWorkspaceScripts).toHaveBeenCalledWith(
      mockCurrentWorkspace,
      ['scripts/*.ts'],
      mockRoot,
    );
  });
});

describe('list handler --filter flag', () => {
  it('filters workspaces by name glob when --filter is set', async () => {
    const wsApi: Workspace = {
      name: '@apps/api',
      dir: '/workspace/packages/api',
      configFile: '/workspace/packages/api/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    };
    vi.mocked(getWorkspaceState).mockReturnValue({
      root: mockRoot,
      tree: { root: mockRoot, workspaces: [wsApi] },
      current: wsApi,
    });
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace/packages/api' },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue([
      {
        name: '@apps/api/build',
        path: '/workspace/packages/api/scripts/build.ts',
        packageDir: '/workspace/packages/api',
        workspaceName: '@apps/api',
      },
    ]);

    await listHandler({ flags: { filter: '@apps/*' } });

    expect(loadAllLaufConfigs).toHaveBeenCalledWith(process.cwd());
    expect(p.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('1 script(s)'));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('--filter takes priority over --all', async () => {
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace' },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue([]);

    await listHandler({ flags: { filter: '@apps/*', all: true } });

    expect(loadAllLaufConfigs).toHaveBeenCalledWith(process.cwd());
    // Filter mode still calls loadAllLaufConfigs, but filters by name
    expect(safeLoadLaufConfigWithMeta).not.toHaveBeenCalled();
  });
});

describe('list handler default mode (current workspace)', () => {
  it('fails with hint when no current workspace found', async () => {
    vi.mocked(getWorkspaceState).mockReturnValue({
      root: mockRoot,
      tree: { root: mockRoot, workspaces: [] },
      current: undefined,
    });

    await listHandler({ flags: {} });

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(p.log.error).toHaveBeenCalledWith('Could not determine the current workspace.');
  });
});

describe('tree display format', () => {
  it('renders tree connectors for packages and scripts', async () => {
    const wsApi: Workspace = {
      name: 'api',
      dir: '/workspace/packages/api',
      configFile: '/workspace/packages/api/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    };
    const wsWeb: Workspace = {
      name: 'web',
      dir: '/workspace/packages/web',
      configFile: '/workspace/packages/web/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    };
    vi.mocked(getWorkspaceState).mockReturnValue({
      root: mockRoot,
      tree: { root: mockRoot, workspaces: [wsApi, wsWeb] },
      current: wsApi,
    });
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace/packages/api' },
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace/packages/web' },
    ]);
    vi.mocked(discoverWorkspaceScripts)
      .mockReturnValueOnce([
        {
          name: 'api/build',
          path: '/workspace/packages/api/scripts/build.ts',
          packageDir: '/workspace/packages/api',
          workspaceName: 'api',
        },
        {
          name: 'api/test',
          path: '/workspace/packages/api/scripts/test.ts',
          packageDir: '/workspace/packages/api',
          workspaceName: 'api',
        },
      ])
      .mockReturnValueOnce([
        {
          name: 'web/deploy',
          path: '/workspace/packages/web/scripts/deploy.ts',
          packageDir: '/workspace/packages/web',
          workspaceName: 'web',
        },
      ]);

    await listHandler({ flags: { all: true } });

    const noteCall = vi.mocked(p.note).mock.calls[0];
    const output = noteCall[0] as string;
    // Tree connectors should be present
    expect(output).toContain('├── ');
    expect(output).toContain('└── ');
    expect(output).toContain('│   ');
  });

  it('renders single package as header with scripts directly beneath', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace' },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue([
      {
        name: 'my-pkg/build',
        path: '/workspace/packages/my-pkg/scripts/build.ts',
        packageDir: '/workspace/packages/my-pkg',
        workspaceName: 'my-pkg',
      },
    ]);

    await listHandler({ flags: {} });

    const noteCall = vi.mocked(p.note).mock.calls[0];
    const output = noteCall[0] as string;
    const lines = output.split('\n');
    // Single package should render as header (like <root>), not nested with └──
    expect(lines[0]).toContain('my-pkg');
    expect(lines[0]).not.toContain('└── ');
    expect(lines[0]).not.toContain('├── ');
    // Script should be a direct child with └── (last item)
    expect(lines[1]).toContain('└── ');
    expect(lines[1]).toContain('build');
  });

  it('renders <root> as top-level heading with scripts and packages nested beneath', async () => {
    const wsRoot: Workspace = {
      name: '<root>',
      dir: '/workspace',
      configFile: '/workspace/lauf.config.ts',
      configName: 'lauf',
      isRoot: true,
    };
    const wsApi: Workspace = {
      name: 'api',
      dir: '/workspace/packages/api',
      configFile: '/workspace/packages/api/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    };
    vi.mocked(getWorkspaceState).mockReturnValue({
      root: mockRoot,
      tree: { root: mockRoot, workspaces: [wsRoot, wsApi] },
      current: wsRoot,
    });
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace' },
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace/packages/api' },
    ]);
    vi.mocked(discoverWorkspaceScripts)
      .mockReturnValueOnce([
        {
          name: 'setup',
          path: '/workspace/scripts/setup.ts',
          packageDir: '/workspace',
          workspaceName: '<root>',
        },
      ])
      .mockReturnValueOnce([
        {
          name: 'api/build',
          path: '/workspace/packages/api/scripts/build.ts',
          packageDir: '/workspace/packages/api',
          workspaceName: 'api',
        },
      ]);

    await listHandler({ flags: { all: true } });

    const noteCall = vi.mocked(p.note).mock.calls[0];
    const output = noteCall[0] as string;
    const lines = output.split('\n');
    // First line should be the <root> header (no tree connector prefix)
    expect(lines[0]).toContain('<root>');
    expect(lines[0]).not.toContain('├── <root>');
    expect(lines[0]).not.toContain('└── <root>');
    // Root script should be a direct child
    expect(output).toContain('├── ');
    expect(output).toContain('setup');
    // Sub-package should appear beneath root scripts
    expect(output).toContain('api');
  });

  it('renders <root> with only root scripts and no sub-packages', async () => {
    const wsRoot: Workspace = {
      name: '<root>',
      dir: '/workspace',
      configFile: '/workspace/lauf.config.ts',
      configName: 'lauf',
      isRoot: true,
    };
    vi.mocked(getWorkspaceState).mockReturnValue({
      root: mockRoot,
      tree: { root: mockRoot, workspaces: [wsRoot] },
      current: wsRoot,
    });
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      { config: baseConfig, configFile: 'lauf.config.ts', configDir: '/workspace' },
    ]);
    vi.mocked(discoverWorkspaceScripts).mockReturnValue([
      {
        name: 'setup',
        path: '/workspace/scripts/setup.ts',
        packageDir: '/workspace',
        workspaceName: '<root>',
      },
      {
        name: 'teardown',
        path: '/workspace/scripts/teardown.ts',
        packageDir: '/workspace',
        workspaceName: '<root>',
      },
    ]);

    await listHandler({ flags: { all: true } });

    const noteCall = vi.mocked(p.note).mock.calls[0];
    const output = noteCall[0] as string;
    const lines = output.split('\n');
    // Header is <root>, no tree connector
    expect(lines[0]).toContain('<root>');
    expect(lines[0]).not.toContain('├──');
    // Last root script uses └── connector
    expect(output).toContain('└── ');
    expect(output).toContain('setup');
    expect(output).toContain('teardown');
  });
});
