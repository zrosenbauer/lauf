import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../lib/discovery.ts', () => ({
  ROOT_PACKAGE_NAME: '<root>',
  discoverScripts: vi.fn(),
  reattributeScripts: vi.fn((scripts: unknown[]) => scripts),
}));

vi.mock('../lib/paths.ts', () => ({
  getWorkspaceRoot: vi.fn(() => '/workspace'),
  LAUF_ROOT: '/lauf-root',
  resolveCurrentPackage: vi.fn(() => ({ name: 'my-pkg', dir: '/workspace/packages/my-pkg' })),
}));

vi.mock('@laufen/engine', () => ({
  loadDescriptions: vi.fn(() => Promise.resolve({})),
}));

import { loadDescriptions } from '@laufen/engine';

import { loadAllLaufConfigs, safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { discoverScripts } from '../lib/discovery.ts';
import { resolveCurrentPackage } from '../lib/paths.ts';
import listHandler from './list.ts';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  vi.mocked(resolveCurrentPackage).mockReturnValue({
    name: 'my-pkg',
    dir: '/workspace/packages/my-pkg',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('list handler', () => {
  it('displays scripts when found', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: 'my-pkg/build',
        path: '/workspace/packages/my-pkg/scripts/build.ts',
        packageDir: '/workspace/packages/my-pkg',
        packageName: 'my-pkg',
      },
      {
        name: 'my-pkg/test',
        path: '/workspace/packages/my-pkg/scripts/test.ts',
        packageDir: '/workspace/packages/my-pkg',
        packageName: 'my-pkg',
      },
    ]);

    await listHandler({ flags: {} });

    expect(p.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('2 script(s)'));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('shows warning when no scripts found', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([]);

    await listHandler({ flags: {} });

    expect(p.log.warn).toHaveBeenCalledWith('No scripts found.');
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('fails when config cannot be loaded', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([new Error('config error'), null]);

    await listHandler({ flags: {} });

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('calls discoverScripts with config patterns and packageDir', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['src/**/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([]);

    await listHandler({ flags: {} });

    expect(discoverScripts).toHaveBeenCalledWith(['src/**/*.ts'], {
      packageDir: '/workspace/packages/my-pkg',
    });
  });

  it('calls loadDescriptions with scripts and options', async () => {
    const scripts = [
      {
        name: 'my-pkg/build',
        path: '/workspace/packages/my-pkg/scripts/build.ts',
        packageDir: '/workspace/packages/my-pkg',
        packageName: 'my-pkg',
      },
    ];
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue(scripts);

    await listHandler({ flags: {} });

    expect(loadDescriptions).toHaveBeenCalledWith(scripts, {
      workspaceRoot: '/workspace',
      cliPackageRoot: '/lauf-root',
    });
  });

  it('displays descriptions from loadDescriptions in tree output', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: 'my-pkg/build',
        path: '/workspace/packages/my-pkg/scripts/build.ts',
        packageDir: '/workspace/packages/my-pkg',
        packageName: 'my-pkg',
      },
      {
        name: 'my-pkg/test',
        path: '/workspace/packages/my-pkg/scripts/test.ts',
        packageDir: '/workspace/packages/my-pkg',
        packageName: 'my-pkg',
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
  it('calls loadAllLaufConfigs and discoverScripts with scopeDir when --all is set', async () => {
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: 'pkg/build',
        path: '/workspace/packages/pkg/scripts/build.ts',
        packageDir: '/workspace/packages/pkg',
        packageName: 'pkg',
      },
    ]);

    await listHandler({ flags: { all: true } });

    expect(loadAllLaufConfigs).toHaveBeenCalledWith(process.cwd());
    expect(discoverScripts).toHaveBeenCalledWith(['scripts/*.ts'], { scopeDir: '/workspace' });
    expect(p.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('1 script(s)'));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('does not call safeLoadLaufConfigWithMeta when --all is set', async () => {
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([]);

    await listHandler({ flags: { all: true } });

    expect(safeLoadLaufConfigWithMeta).not.toHaveBeenCalled();
    expect(loadAllLaufConfigs).toHaveBeenCalled();
  });

  it('aggregates scripts from multiple configs', async () => {
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
      {
        config: {
          scripts: ['tasks/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace/packages/api',
      },
    ]);
    vi.mocked(discoverScripts)
      .mockReturnValueOnce([
        {
          name: 'app/build',
          path: '/workspace/packages/app/scripts/build.ts',
          packageDir: '/workspace/packages/app',
          packageName: 'app',
        },
      ])
      .mockReturnValueOnce([
        {
          name: 'api/migrate',
          path: '/workspace/packages/api/tasks/migrate.ts',
          packageDir: '/workspace/packages/api',
          packageName: 'api',
        },
      ]);

    await listHandler({ flags: { all: true } });

    expect(discoverScripts).toHaveBeenCalledTimes(2);
    expect(discoverScripts).toHaveBeenCalledWith(['scripts/*.ts'], { scopeDir: '/workspace' });
    expect(discoverScripts).toHaveBeenCalledWith(['tasks/*.ts'], {
      scopeDir: '/workspace/packages/api',
    });
    expect(p.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('2 script(s)'));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('deduplicates scripts by path across configs', async () => {
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace/packages/pkg',
      },
    ]);
    vi.mocked(discoverScripts)
      .mockReturnValueOnce([
        {
          name: 'pkg/build',
          path: '/workspace/packages/pkg/scripts/build.ts',
          packageDir: '/workspace/packages/pkg',
          packageName: 'pkg',
        },
      ])
      .mockReturnValueOnce([
        {
          name: 'pkg/build',
          path: '/workspace/packages/pkg/scripts/build.ts',
          packageDir: '/workspace/packages/pkg',
          packageName: 'pkg',
        },
      ]);

    await listHandler({ flags: { all: true } });

    // Should show only 1 script after deduplication
    expect(p.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('1 script(s)'));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('shows warning when --all finds no scripts across all configs', async () => {
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([]);

    await listHandler({ flags: { all: true } });

    expect(p.log.warn).toHaveBeenCalledWith('No scripts found.');
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('uses current package when --all is not set', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([]);

    await listHandler({ flags: {} });

    expect(safeLoadLaufConfigWithMeta).toHaveBeenCalledWith(process.cwd());
    expect(loadAllLaufConfigs).not.toHaveBeenCalled();
    expect(resolveCurrentPackage).toHaveBeenCalledWith(process.cwd());
    // discoverScripts should be called with packageDir from resolveCurrentPackage
    expect(discoverScripts).toHaveBeenCalledWith(['scripts/*.ts'], {
      packageDir: '/workspace/packages/my-pkg',
    });
  });
});

describe('list handler --filter flag', () => {
  it('calls discoverScripts with filterGlobs when --filter is set', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: '@apps/api/build',
        path: '/workspace/packages/api/scripts/build.ts',
        packageDir: '/workspace/packages/api',
        packageName: '@apps/api',
      },
    ]);

    await listHandler({ flags: { filter: '@apps/*' } });

    expect(safeLoadLaufConfigWithMeta).toHaveBeenCalledWith(process.cwd());
    expect(discoverScripts).toHaveBeenCalledWith(['scripts/*.ts'], {
      filterGlobs: ['@apps/*'],
    });
    expect(p.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('1 script(s)'));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('does not call loadAllLaufConfigs or resolveCurrentPackage when --filter is set', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([]);

    await listHandler({ flags: { filter: '@apps/*' } });

    expect(loadAllLaufConfigs).not.toHaveBeenCalled();
    expect(resolveCurrentPackage).not.toHaveBeenCalled();
  });

  it('--filter takes priority over --all', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([]);

    await listHandler({ flags: { filter: '@apps/*', all: true } });

    expect(discoverScripts).toHaveBeenCalledWith(['scripts/*.ts'], {
      filterGlobs: ['@apps/*'],
    });
    expect(loadAllLaufConfigs).not.toHaveBeenCalled();
  });

  it('fails when config cannot be loaded with --filter', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([new Error('config error'), null]);

    await listHandler({ flags: { filter: '@apps/*' } });

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

describe('list handler default mode (current package)', () => {
  it('fails with hint when resolveCurrentPackage returns undefined', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(resolveCurrentPackage).mockReturnValue(undefined);

    await listHandler({ flags: {} });

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(p.log.error).toHaveBeenCalledWith('Could not determine the current package.');
  });

  it('calls resolveCurrentPackage with process.cwd()', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([]);

    await listHandler({ flags: {} });

    expect(resolveCurrentPackage).toHaveBeenCalledWith(process.cwd());
  });
});

describe('root package scripts', () => {
  it('filters to only root scripts when current package is root', async () => {
    vi.mocked(resolveCurrentPackage).mockReturnValue({ name: '<root>', dir: '/workspace' });
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: 'root-script',
        path: '/workspace/scripts/root-script.ts',
        packageDir: '/workspace',
        packageName: '<root>',
      },
      {
        name: 'pkg/build',
        path: '/workspace/packages/pkg/scripts/build.ts',
        packageDir: '/workspace/packages/pkg',
        packageName: 'pkg',
      },
    ]);

    await listHandler({ flags: {} });

    // Only root scripts should appear (pkg/build is filtered out)
    expect(p.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('1 script(s)'));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('displays root-only scripts in monorepo mode', async () => {
    vi.mocked(resolveCurrentPackage).mockReturnValue({ name: '<root>', dir: '/workspace' });
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: 'root-script',
        path: '/workspace/scripts/root-script.ts',
        packageDir: '/workspace',
        packageName: '<root>',
      },
    ]);

    await listHandler({ flags: {} });

    expect(p.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('1 script(s)'));
    expect(p.log.warn).not.toHaveBeenCalledWith('No scripts found.');
    expect(process.exit).not.toHaveBeenCalled();
  });
});

describe('tree display format', () => {
  it('renders tree connectors for packages and scripts', async () => {
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: 'api/build',
        path: '/workspace/packages/api/scripts/build.ts',
        packageDir: '/workspace/packages/api',
        packageName: 'api',
      },
      {
        name: 'api/test',
        path: '/workspace/packages/api/scripts/test.ts',
        packageDir: '/workspace/packages/api',
        packageName: 'api',
      },
      {
        name: 'web/deploy',
        path: '/workspace/packages/web/scripts/deploy.ts',
        packageDir: '/workspace/packages/web',
        packageName: 'web',
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
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: 'my-pkg/build',
        path: '/workspace/packages/my-pkg/scripts/build.ts',
        packageDir: '/workspace/packages/my-pkg',
        packageName: 'my-pkg',
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
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: 'setup',
        path: '/workspace/scripts/setup.ts',
        packageDir: '/workspace',
        packageName: '<root>',
      },
      {
        name: 'api/build',
        path: '/workspace/packages/api/scripts/build.ts',
        packageDir: '/workspace/packages/api',
        packageName: 'api',
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
    // Root script should be a direct child (no indentation prefix)
    expect(output).toContain('├── ');
    expect(output).toContain('setup');
    // Sub-package should appear beneath root scripts
    expect(output).toContain('api');
  });

  it('renders <root> with only root scripts and no sub-packages', async () => {
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      {
        config: {
          scripts: ['scripts/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: 'setup',
        path: '/workspace/scripts/setup.ts',
        packageDir: '/workspace',
        packageName: '<root>',
      },
      {
        name: 'teardown',
        path: '/workspace/scripts/teardown.ts',
        packageDir: '/workspace',
        packageName: '<root>',
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
