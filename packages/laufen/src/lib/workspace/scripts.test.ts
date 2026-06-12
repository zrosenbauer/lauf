import fg from 'fast-glob';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(() => []),
  },
}));

import {
  ROOT_WORKSPACE_NAME,
  discoverAllScripts,
  discoverWorkspaceScripts,
  findScript,
  qualifyScriptName,
} from './scripts.ts';
import type { Workspace, WorkspaceRoot } from './types.ts';

const ROOT: WorkspaceRoot = { dir: '/workspace', source: 'git' };

const makeWorkspace = (name: string, dir: string, isRoot = false): Workspace => ({
  name,
  dir,
  configFile: `${dir}/lauf.config.ts`,
  configName: 'lauf',
  isRoot,
});

const ROOT_WS = makeWorkspace('<root>', '/workspace', true);
const APP_WS = makeWorkspace('@apps/web', '/workspace/packages/web');

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ROOT_WORKSPACE_NAME', () => {
  it('equals <root>', () => {
    expect(ROOT_WORKSPACE_NAME).toBe('<root>');
  });
});

describe('qualifyScriptName', () => {
  it('returns bare stem for root workspace', () => {
    expect(qualifyScriptName(ROOT_WS, 'setup')).toBe('setup');
  });

  it('returns prefixed name for non-root workspace', () => {
    expect(qualifyScriptName(APP_WS, 'build')).toBe('@apps/web/build');
  });
});

describe('discoverWorkspaceScripts', () => {
  it('returns empty array when no files found', () => {
    vi.mocked(fg.sync).mockReturnValue([]);

    const result = discoverWorkspaceScripts(APP_WS, ['scripts/*.ts'], ROOT);
    expect(result).toEqual([]);
  });

  it('discovers scripts in workspace', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/web/scripts/build.ts']);

    const result = discoverWorkspaceScripts(APP_WS, ['scripts/*.ts'], ROOT);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: '@apps/web/build',
      path: '/workspace/packages/web/scripts/build.ts',
      packageDir: '/workspace/packages/web',
      workspaceName: '@apps/web',
    });
  });

  it('produces bare names for root workspace scripts', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/scripts/setup.ts']);

    const result = discoverWorkspaceScripts(ROOT_WS, ['scripts/*.ts'], ROOT);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'setup', workspaceName: '<root>' });
  });

  it('strips .lauf suffix from script names', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/web/scripts/deploy.lauf.ts']);

    const result = discoverWorkspaceScripts(APP_WS, ['scripts/*.ts'], ROOT);
    expect(result[0]).toMatchObject({ name: '@apps/web/deploy' });
  });

  it('strips .laufen suffix from script names', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/web/scripts/deploy.laufen.ts']);

    const result = discoverWorkspaceScripts(APP_WS, ['scripts/*.ts'], ROOT);
    expect(result[0]).toMatchObject({ name: '@apps/web/deploy' });
  });

  it('sorts scripts by name', () => {
    vi.mocked(fg.sync).mockReturnValue([
      '/workspace/packages/web/scripts/zebra.ts',
      '/workspace/packages/web/scripts/alpha.ts',
    ]);

    const result = discoverWorkspaceScripts(APP_WS, ['scripts/*.ts'], ROOT);
    expect(result[0]).toMatchObject({ name: '@apps/web/alpha' });
    expect(result[1]).toMatchObject({ name: '@apps/web/zebra' });
  });

  it('rejects patterns starting with ..', () => {
    const result = discoverWorkspaceScripts(APP_WS, ['../../../etc/passwd'], ROOT);
    expect(result).toEqual([]);
    expect(fg.sync).not.toHaveBeenCalled();
  });

  it('rejects absolute path patterns', () => {
    const result = discoverWorkspaceScripts(APP_WS, ['/etc/passwd'], ROOT);
    expect(result).toEqual([]);
    expect(fg.sync).not.toHaveBeenCalled();
  });

  it('filters out scripts outside workspace root', () => {
    vi.mocked(fg.sync).mockReturnValue([
      '/workspace/packages/web/scripts/build.ts',
      '/outside/workspace/scripts/evil.ts',
    ]);

    const result = discoverWorkspaceScripts(APP_WS, ['scripts/*.ts'], ROOT);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: '@apps/web/build' });
  });
});

describe('discoverAllScripts', () => {
  it('discovers scripts across multiple workspaces', () => {
    vi.mocked(fg.sync)
      .mockReturnValueOnce(['/workspace/scripts/setup.ts'])
      .mockReturnValueOnce(['/workspace/packages/web/scripts/build.ts']);

    const result = discoverAllScripts(
      [
        [ROOT_WS, ['scripts/*.ts']],
        [APP_WS, ['scripts/*.ts']],
      ],
      ROOT,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: '@apps/web/build' });
    expect(result[1]).toMatchObject({ name: 'setup' });
  });

  it('filters to specific workspace when workspaceDir provided', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/web/scripts/build.ts']);

    const result = discoverAllScripts(
      [
        [ROOT_WS, ['scripts/*.ts']],
        [APP_WS, ['scripts/*.ts']],
      ],
      ROOT,
      { workspaceDir: '/workspace/packages/web' },
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: '@apps/web/build' });
    expect(fg.sync).toHaveBeenCalledTimes(1);
  });
});

describe('findScript', () => {
  it('finds script by qualified name', () => {
    vi.mocked(fg.sync)
      .mockReturnValueOnce(['/workspace/scripts/setup.ts'])
      .mockReturnValueOnce(['/workspace/packages/web/scripts/build.ts']);

    const pairs: (readonly [Workspace, readonly string[]])[] = [
      [ROOT_WS, ['scripts/*.ts']],
      [APP_WS, ['scripts/*.ts']],
    ];

    const result = findScript('@apps/web/build', APP_WS, pairs, ROOT);
    expect(result).toMatchObject({ name: '@apps/web/build' });
  });

  it('finds bare name in current workspace first', () => {
    vi.mocked(fg.sync)
      .mockReturnValueOnce(['/workspace/scripts/preview.ts'])
      .mockReturnValueOnce(['/workspace/packages/web/scripts/preview.ts']);

    const pairs: (readonly [Workspace, readonly string[]])[] = [
      [ROOT_WS, ['scripts/*.ts']],
      [APP_WS, ['scripts/*.ts']],
    ];

    const result = findScript('preview', APP_WS, pairs, ROOT);
    expect(result).toMatchObject({
      name: '@apps/web/preview',
      packageDir: '/workspace/packages/web',
    });
  });

  it('falls back to root script when bare name not in current workspace', () => {
    vi.mocked(fg.sync)
      .mockReturnValueOnce(['/workspace/scripts/setup.ts'])
      .mockReturnValueOnce(['/workspace/packages/web/scripts/build.ts']);

    const pairs: (readonly [Workspace, readonly string[]])[] = [
      [ROOT_WS, ['scripts/*.ts']],
      [APP_WS, ['scripts/*.ts']],
    ];

    const result = findScript('setup', APP_WS, pairs, ROOT);
    expect(result).toMatchObject({ name: 'setup', packageDir: '/workspace' });
  });

  it('returns undefined when script not found', () => {
    vi.mocked(fg.sync).mockReturnValue([]);

    const pairs: (readonly [Workspace, readonly string[]])[] = [[ROOT_WS, ['scripts/*.ts']]];

    const result = findScript('nonexistent', ROOT_WS, pairs, ROOT);
    expect(result).toBeUndefined();
  });

  it('searches all workspaces when currentWorkspace is undefined', () => {
    vi.mocked(fg.sync).mockReturnValueOnce(['/workspace/scripts/setup.ts']);

    const pairs: (readonly [Workspace, readonly string[]])[] = [[ROOT_WS, ['scripts/*.ts']]];

    const result = findScript('setup', undefined, pairs, ROOT);
    expect(result).toMatchObject({ name: 'setup' });
  });
});
