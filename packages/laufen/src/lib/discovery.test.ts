import fg from 'fast-glob';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(() => []),
  },
}));

vi.mock('./paths.ts', () => ({
  resolveWorkspacePackages: vi.fn(() => []),
  getWorkspaceRoot: vi.fn(() => '/workspace'),
  LAUF_ROOT: '/lauf',
}));

vi.mock('./workspace.ts', () => ({
  getWorkspaceRoot: vi.fn(() => '/workspace'),
}));

import { ROOT_PACKAGE_NAME, discoverScripts, findScript, qualifyScriptName } from './discovery.ts';
import { resolveWorkspacePackages } from './paths.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('discoverScripts', () => {
  it('returns empty array when no packages found', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([]);
    const result = discoverScripts(['scripts/*.lauf.ts']);
    expect(result).toEqual([]);
  });

  it('discovers scripts in workspace packages', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/my-pkg/scripts/build.ts']);

    const result = discoverScripts(['scripts/*.lauf.ts']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'my-pkg/build',
      path: '/workspace/packages/my-pkg/scripts/build.ts',
      packageDir: '/workspace/packages/my-pkg',
      packageName: 'my-pkg',
    });
  });

  it('sorts scripts by name', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'pkg-b', dir: '/workspace/packages/pkg-b' },
      { name: 'pkg-a', dir: '/workspace/packages/pkg-a' },
    ]);
    vi.mocked(fg.sync)
      .mockReturnValueOnce(['/workspace/packages/pkg-b/scripts/zebra.ts'])
      .mockReturnValueOnce(['/workspace/packages/pkg-a/scripts/alpha.ts']);

    const result = discoverScripts(['scripts/*.lauf.ts']);
    expect(result[0]).toMatchObject({ name: 'pkg-a/alpha' });
    expect(result[1]).toMatchObject({ name: 'pkg-b/zebra' });
  });

  it('strips .lauf suffix from script names', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/my-pkg/scripts/deploy.lauf.ts']);

    const result = discoverScripts(['scripts/*.lauf.ts']);
    expect(result[0]).toMatchObject({ name: 'my-pkg/deploy' });
  });

  it('strips .laufen suffix from script names', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/my-pkg/scripts/deploy.laufen.ts']);

    const result = discoverScripts(['scripts/*.lauf.ts']);
    expect(result[0]).toMatchObject({ name: 'my-pkg/deploy' });
  });

  it('leaves names without .lauf/.laufen suffix unchanged', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/my-pkg/scripts/build.ts']);

    const result = discoverScripts(['scripts/*.lauf.ts']);
    expect(result[0]).toMatchObject({ name: 'my-pkg/build' });
  });

  it('discovers scripts from multiple packages', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'pkg-a', dir: '/workspace/packages/pkg-a' },
      { name: 'pkg-b', dir: '/workspace/packages/pkg-b' },
    ]);
    vi.mocked(fg.sync)
      .mockReturnValueOnce(['/workspace/packages/pkg-a/scripts/build.ts'])
      .mockReturnValueOnce([
        '/workspace/packages/pkg-b/scripts/test.ts',
        '/workspace/packages/pkg-b/scripts/lint.ts',
      ]);

    const result = discoverScripts(['scripts/*.lauf.ts']);
    expect(result).toHaveLength(3);
  });

  it('calls fast-glob with correct options', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);
    vi.mocked(fg.sync).mockReturnValue([]);

    discoverScripts(['scripts/*.lauf.ts']);
    expect(fg.sync).toHaveBeenCalledWith(['scripts/*.lauf.ts'], {
      cwd: '/workspace/packages/my-pkg',
      absolute: true,
      onlyFiles: true,
    });
  });

  it('rejects patterns starting with .. (parent traversal)', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);

    const result = discoverScripts(['../../../etc/passwd']);
    expect(result).toEqual([]);
    expect(fg.sync).not.toHaveBeenCalled();
  });

  it('rejects patterns starting with / (absolute path)', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);

    const result = discoverScripts(['/etc/passwd']);
    expect(result).toEqual([]);
    expect(fg.sync).not.toHaveBeenCalled();
  });

  it('filters valid patterns from invalid ones', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/my-pkg/scripts/build.ts']);

    const result = discoverScripts(['../bad', 'scripts/*.lauf.ts', '/absolute/bad']);
    expect(result).toHaveLength(1);
    expect(fg.sync).toHaveBeenCalledWith(['scripts/*.lauf.ts'], expect.any(Object));
  });

  it('filters out scripts outside workspace root', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);
    vi.mocked(fg.sync).mockReturnValue([
      '/workspace/packages/my-pkg/scripts/build.ts',
      '/outside/workspace/scripts/evil.ts',
    ]);

    const result = discoverScripts(['scripts/*.lauf.ts']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'my-pkg/build' });
  });

  it('returns empty array when all patterns are invalid', () => {
    const result = discoverScripts(['../bad', '/absolute']);
    expect(result).toEqual([]);
  });

  it('rejects patterns with embedded .. that normalize to parent traversal', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);

    const result = discoverScripts(['scripts/../../etc/passwd']);
    expect(result).toEqual([]);
    expect(fg.sync).not.toHaveBeenCalled();
  });

  it('filters out scripts with prefix-matching but different workspace root', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);
    vi.mocked(fg.sync).mockReturnValue([
      '/workspace/packages/my-pkg/scripts/build.ts',
      '/workspace-evil/scripts/evil.ts',
    ]);

    const result = discoverScripts(['scripts/*.lauf.ts']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'my-pkg/build' });
  });

  it('filters packages by scopeDir when provided', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'pkg-a', dir: '/workspace/packages/pkg-a' },
      { name: 'pkg-b', dir: '/workspace/apps/pkg-b' },
    ]);
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/pkg-a/scripts/build.ts']);

    const result = discoverScripts(['scripts/*.lauf.ts'], { scopeDir: '/workspace/packages' });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'pkg-a/build',
      packageDir: '/workspace/packages/pkg-a',
    });
    // fast-glob should only be called once (for pkg-a), not for pkg-b
    expect(fg.sync).toHaveBeenCalledTimes(1);
  });

  it('returns all packages when no scopeDir provided', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'pkg-a', dir: '/workspace/packages/pkg-a' },
      { name: 'pkg-b', dir: '/workspace/apps/pkg-b' },
    ]);
    vi.mocked(fg.sync)
      .mockReturnValueOnce(['/workspace/packages/pkg-a/scripts/build.ts'])
      .mockReturnValueOnce(['/workspace/apps/pkg-b/scripts/deploy.ts']);

    const result = discoverScripts(['scripts/*.lauf.ts']);

    expect(result).toHaveLength(2);
    expect(fg.sync).toHaveBeenCalledTimes(2);
  });

  it('returns empty when scopeDir matches no packages', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'pkg-a', dir: '/workspace/packages/pkg-a' },
      { name: 'pkg-b', dir: '/workspace/apps/pkg-b' },
    ]);

    const result = discoverScripts(['scripts/*.lauf.ts'], { scopeDir: '/workspace/libs' });

    expect(result).toEqual([]);
    expect(fg.sync).not.toHaveBeenCalled();
  });

  it('produces bare stem names for root package scripts', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([{ name: '<root>', dir: '/workspace' }]);
    vi.mocked(fg.sync).mockReturnValue(['/workspace/scripts/setup.ts']);

    const result = discoverScripts(['scripts/*.lauf.ts']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'setup',
      packageName: '<root>',
    });
  });

  it('scopeDir matches package at exact scope path', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'root-pkg', dir: '/workspace/packages' },
      { name: 'nested-pkg', dir: '/workspace/packages/nested' },
    ]);
    vi.mocked(fg.sync)
      .mockReturnValueOnce(['/workspace/packages/scripts/build.ts'])
      .mockReturnValueOnce(['/workspace/packages/nested/scripts/test.ts']);

    const result = discoverScripts(['scripts/*.lauf.ts'], { scopeDir: '/workspace/packages' });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: 'nested-pkg/test' });
    expect(result[1]).toMatchObject({ name: 'root-pkg/build' });
  });
});

describe('findScript', () => {
  it('returns script when found by qualified name', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/my-pkg/scripts/build.ts']);

    const result = findScript('my-pkg/build', ['scripts/*.lauf.ts']);
    expect(result).toMatchObject({
      name: 'my-pkg/build',
      path: '/workspace/packages/my-pkg/scripts/build.ts',
    });
  });

  it('returns undefined when script not found', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([
      { name: 'my-pkg', dir: '/workspace/packages/my-pkg' },
    ]);
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/my-pkg/scripts/build.ts']);

    const result = findScript('my-pkg/nonexistent', ['scripts/*.lauf.ts']);
    expect(result).toBeUndefined();
  });

  it('returns undefined when no scripts exist', () => {
    vi.mocked(resolveWorkspacePackages).mockReturnValue([]);
    const result = findScript('any/script', ['scripts/*.lauf.ts']);
    expect(result).toBeUndefined();
  });

  it('uses pre-discovered scripts when provided', () => {
    const cachedScripts = [
      {
        name: 'my-pkg/build',
        path: '/workspace/packages/my-pkg/scripts/build.ts',
        packageDir: '/workspace/packages/my-pkg',
        packageName: 'my-pkg',
      },
    ] as const;

    const result = findScript('my-pkg/build', ['scripts/*.lauf.ts'], cachedScripts);
    expect(result).toMatchObject({ name: 'my-pkg/build' });
    // Should not call discoverScripts (no fg.sync calls)
    expect(fg.sync).not.toHaveBeenCalled();
  });

  it('returns undefined from pre-discovered scripts when not found', () => {
    const cachedScripts = [
      {
        name: 'my-pkg/build',
        path: '/workspace/packages/my-pkg/scripts/build.ts',
        packageDir: '/workspace/packages/my-pkg',
        packageName: 'my-pkg',
      },
    ] as const;

    const result = findScript('my-pkg/nonexistent', ['scripts/*.lauf.ts'], cachedScripts);
    expect(result).toBeUndefined();
    expect(fg.sync).not.toHaveBeenCalled();
  });
});

describe('ROOT_PACKAGE_NAME', () => {
  it('equals <root>', () => {
    expect(ROOT_PACKAGE_NAME).toBe('<root>');
  });
});

describe('qualifyScriptName', () => {
  it('returns bare stem for root package', () => {
    expect(qualifyScriptName('<root>', 'setup')).toBe('setup');
  });

  it('returns prefixed name for non-root package', () => {
    expect(qualifyScriptName('my-pkg', 'build')).toBe('my-pkg/build');
  });

  it('returns prefixed name for scoped package', () => {
    expect(qualifyScriptName('@apps/api', 'deploy')).toBe('@apps/api/deploy');
  });
});
