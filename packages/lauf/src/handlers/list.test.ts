import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExistsSync, mockExecFile } = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockExecFile: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync,
  };
});

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}));

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
  discoverScripts: vi.fn(),
}));

vi.mock('../lib/paths.ts', () => ({
  getWorkspaceRoot: vi.fn(() => '/workspace'),
  LAUF_ROOT: '/lauf-root',
  resolveTsx: vi.fn(() => [null, '/lauf-root/node_modules/.bin/tsx']),
}));

import { loadAllLaufConfigs, safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { discoverScripts } from '../lib/discovery.ts';
import { resolveTsx } from '../lib/paths.ts';
import listHandler from './list.ts';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  // Reset automock implementations (Vitest 4 no longer restores vi.fn via restoreAllMocks)
  vi.mocked(resolveTsx).mockReturnValue([null, '/lauf-root/node_modules/.bin/tsx']);
  // Default: dist metadata path exists
  mockExistsSync.mockReturnValue(true);
  // Default: execFile fails (tsx not available in test environment)
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: readonly string[],
      _opts: unknown,
      cb: (error: Error | null, result: { stdout: string } | null) => void,
    ) => {
      cb(new Error('spawn ENOENT'), null);
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('list handler', () => {
  it('displays scripts when found', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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
      {
        name: 'pkg/test',
        path: '/workspace/packages/pkg/scripts/test.ts',
        packageDir: '/workspace/packages/pkg',
        packageName: 'pkg',
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
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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

  it('calls discoverScripts with config patterns', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['src/**/*.lauf.ts'], logger: undefined, spinner: true },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([]);

    await listHandler({ flags: {} });

    expect(discoverScripts).toHaveBeenCalledWith(['src/**/*.lauf.ts']);
  });

  it('warns when metadata extractor is not found', async () => {
    mockExistsSync.mockReturnValue(false);
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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

    await listHandler({ flags: {} });

    expect(p.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('metadata extractor not found'),
    );
    expect(p.note).toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('falls back to source .ts path when dist is not available', async () => {
    mockExistsSync.mockImplementation((filePath: string) => {
      if (filePath.includes('dist')) {
        return false;
      }
      return true;
    });
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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

    await listHandler({ flags: {} });

    // Should not warn about metadata extractor not found since src exists
    expect(p.log.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('metadata extractor not found'),
    );
  });

  it('warns when tsx binary is not found via resolveTsx', async () => {
    vi.mocked(resolveTsx).mockReturnValue([new Error('tsx binary not found'), null]);
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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

    await listHandler({ flags: {} });

    expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('tsx binary not found'));
    expect(p.note).toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('warns when description extraction times out or fails', async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: readonly string[],
        _opts: unknown,
        cb: (error: Error | null, result: { stdout: string } | null) => void,
      ) => {
        cb(new Error('spawn failed'), null);
      },
    );
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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

    await listHandler({ flags: {} });

    // The execFileAsync will fail in tests (tsx not available), triggering the warning
    expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('timed out or failed'));
    // Should still show the note (scripts without descriptions)
    expect(p.note).toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('displays descriptions when execFileAsync returns valid JSON', async () => {
    const descriptions: Record<string, string> = {
      '/workspace/packages/pkg/scripts/build.ts': 'Build the project',
      '/workspace/packages/pkg/scripts/test.ts': 'Run tests',
    };
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: readonly string[],
        _opts: unknown,
        cb: (error: Error | null, result: { stdout: string } | null) => void,
      ) => {
        cb(null, { stdout: JSON.stringify(descriptions) });
      },
    );
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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
      {
        name: 'pkg/test',
        path: '/workspace/packages/pkg/scripts/test.ts',
        packageDir: '/workspace/packages/pkg',
        packageName: 'pkg',
      },
    ]);

    await listHandler({ flags: {} });

    expect(p.log.warn).not.toHaveBeenCalled();
    expect(p.note).toHaveBeenCalledWith(
      expect.stringContaining('Build the project'),
      expect.stringContaining('2 script(s)'),
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('warns when JSON parsing of description output fails', async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: readonly string[],
        _opts: unknown,
        cb: (error: Error | null, result: { stdout: string } | null) => void,
      ) => {
        cb(null, { stdout: 'not valid json {{{' });
      },
    );
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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

    await listHandler({ flags: {} });

    expect(p.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('could not parse metadata output'),
    );
    expect(p.note).toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('includes process.env.NODE_PATH in spawned metadata extractor env', async () => {
    const originalNodePath = process.env.NODE_PATH;
    process.env.NODE_PATH = '/custom/node_modules';

    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: readonly string[],
        opts: { env: Record<string, string> },
        cb: (error: Error | null, result: { stdout: string } | null) => void,
      ) => {
        // Verify NODE_PATH includes the custom path
        expect(opts.env.NODE_PATH).toContain('/custom/node_modules');
        cb(null, { stdout: JSON.stringify({}) });
      },
    );
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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

    await listHandler({ flags: {} });

    expect(mockExecFile).toHaveBeenCalled();

    // Restore
    if (originalNodePath === undefined) {
      delete process.env.NODE_PATH;
    } else {
      process.env.NODE_PATH = originalNodePath;
    }
  });

  it('warns when description extraction returns empty results for existing scripts', async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        _args: readonly string[],
        _opts: unknown,
        cb: (error: Error | null, result: { stdout: string } | null) => void,
      ) => {
        cb(null, { stdout: JSON.stringify({}) });
      },
    );
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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

    await listHandler({ flags: {} });

    expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('returned no results'));
    expect(p.note).toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });
});

describe('list handler --all flag', () => {
  it('calls loadAllLaufConfigs and discoverScripts with scopeDir when --all is set', async () => {
    vi.mocked(loadAllLaufConfigs).mockResolvedValue([
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
      {
        config: { scripts: ['tasks/*.ts'], logger: undefined, spinner: true },
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
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([]);

    await listHandler({ flags: { all: true } });

    expect(p.log.warn).toHaveBeenCalledWith('No scripts found.');
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('uses scoped path when --all is not set', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([]);

    await listHandler({ flags: {} });

    expect(safeLoadLaufConfigWithMeta).toHaveBeenCalledWith(process.cwd());
    expect(loadAllLaufConfigs).not.toHaveBeenCalled();
    // discoverScripts should be called without scopeDir option
    expect(discoverScripts).toHaveBeenCalledWith(['scripts/*.ts']);
  });
});

describe('root package scripts', () => {
  it('includes scripts from the workspace root package in monorepo mode', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: 'my-monorepo/root-script',
        path: '/workspace/scripts/root-script.ts',
        packageDir: '/workspace',
        packageName: 'my-monorepo',
      },
      {
        name: 'pkg/build',
        path: '/workspace/packages/pkg/scripts/build.ts',
        packageDir: '/workspace/packages/pkg',
        packageName: 'pkg',
      },
    ]);

    await listHandler({ flags: {} });

    // Both root and sub-package scripts should appear
    expect(p.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('2 script(s)'));
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('displays root-only scripts in monorepo mode', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: 'my-monorepo/root-script',
        path: '/workspace/scripts/root-script.ts',
        packageDir: '/workspace',
        packageName: 'my-monorepo',
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
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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

    await listHandler({ flags: {} });

    const noteCall = vi.mocked(p.note).mock.calls[0];
    const output = noteCall[0] as string;
    // Tree connectors should be present
    expect(output).toContain('├── ');
    expect(output).toContain('└── ');
    expect(output).toContain('│   ');
  });

  it('uses └── for the last package in the tree', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
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

    await listHandler({ flags: {} });

    const noteCall = vi.mocked(p.note).mock.calls[0];
    const output = noteCall[0] as string;
    const lines = output.split('\n');
    // Single package should use └── (last item connector)
    expect(lines[0]).toContain('└── ');
  });

  it('renders <root> as top-level heading with scripts and packages nested beneath', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: '<root>/setup',
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

    await listHandler({ flags: {} });

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
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([
      null,
      {
        config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
        configFile: 'lauf.config.ts',
        configDir: '/workspace',
      },
    ]);
    vi.mocked(discoverScripts).mockReturnValue([
      {
        name: '<root>/setup',
        path: '/workspace/scripts/setup.ts',
        packageDir: '/workspace',
        packageName: '<root>',
      },
      {
        name: '<root>/teardown',
        path: '/workspace/scripts/teardown.ts',
        packageDir: '/workspace',
        packageName: '<root>',
      },
    ]);

    await listHandler({ flags: {} });

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
