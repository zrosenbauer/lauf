import * as fs from 'node:fs';

import fg from 'fast-glob';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(() => []),
  },
}));

vi.mock('./workspace.ts', () => ({
  getWorkspaceInfo: vi.fn(() => ({
    manager: 'pnpm',
    root: '/workspace',
    globs: ['packages/*'],
  })),
  getWorkspaceRoot: vi.fn(() => '/workspace'),
}));

import { LAUF_ROOT, resolveCurrentPackage, resolveWorkspacePackages } from './paths.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LAUF_ROOT', () => {
  it('is a non-empty string', () => {
    expect(typeof LAUF_ROOT).toBe('string');
    expect(LAUF_ROOT.length).toBeGreaterThan(0);
  });

  it('is an absolute path', () => {
    expect(LAUF_ROOT.startsWith('/')).toBe(true);
  });
});

describe('resolveWorkspacePackages', () => {
  it('returns packages from workspace globs', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/my-pkg']);
    vi.mocked(fs.readFileSync).mockReturnValue('{"name": "my-pkg"}');

    const packages = resolveWorkspacePackages();
    const found = packages.find((p) => p.name === 'my-pkg');
    expect(found).toBeDefined();
  });

  it('includes root package if it has a valid package.json', () => {
    vi.mocked(fg.sync).mockReturnValue([]);
    vi.mocked(fs.readFileSync).mockReturnValue('{"name": "root-pkg"}');

    const packages = resolveWorkspacePackages();
    const found = packages.find((p) => p.name === '<root>');
    expect(found).toBeDefined();
  });

  it('skips directories without package.json', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/no-pkg']);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const packages = resolveWorkspacePackages();
    expect(packages).toHaveLength(0);
  });

  it('skips packages with invalid JSON', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/bad-pkg']);
    vi.mocked(fs.readFileSync).mockReturnValue('not json');

    const packages = resolveWorkspacePackages();
    expect(packages).toHaveLength(0);
  });

  it('skips packages without name field', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/unnamed']);
    vi.mocked(fs.readFileSync).mockReturnValue('{"version": "1.0.0"}');

    const packages = resolveWorkspacePackages();
    expect(packages).toHaveLength(0);
  });

  it('returns multiple packages', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/pkg-a', '/workspace/packages/pkg-b']);
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      const pathStr = String(filePath);
      if (pathStr.includes('pkg-a')) {
        return '{"name": "pkg-a"}';
      }
      if (pathStr.includes('pkg-b')) {
        return '{"name": "pkg-b"}';
      }
      return '{}';
    });

    const packages = resolveWorkspacePackages();
    const names = packages.map((p) => p.name);
    expect(names).toContain('pkg-a');
    expect(names).toContain('pkg-b');
  });

  it('calls fast-glob with workspace globs', () => {
    vi.mocked(fg.sync).mockReturnValue([]);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    resolveWorkspacePackages();
    expect(fg.sync).toHaveBeenCalledWith(
      expect.arrayContaining(['packages/*']),
      expect.objectContaining({
        cwd: '/workspace',
        onlyDirectories: true,
        absolute: true,
      }),
    );
  });
});

describe('resolveCurrentPackage', () => {
  it('returns matching package when cwd is inside a workspace package', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/my-pkg']);
    vi.mocked(fs.readFileSync).mockReturnValue('{"name": "my-pkg"}');

    const result = resolveCurrentPackage('/workspace/packages/my-pkg/src');
    expect(result).toEqual({ name: 'my-pkg', dir: '/workspace/packages/my-pkg' });
  });

  it('returns <root> when cwd is at workspace root', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/my-pkg']);
    vi.mocked(fs.readFileSync).mockReturnValue('{"name": "root-pkg"}');

    const result = resolveCurrentPackage('/workspace');
    expect(result).toEqual({ name: '<root>', dir: '/workspace' });
  });

  it('returns deepest package for nested matches', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages', '/workspace/packages/nested']);
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      const pathStr = String(filePath);
      if (pathStr.includes('nested')) {
        return '{"name": "nested-pkg"}';
      }
      if (pathStr.includes('packages')) {
        return '{"name": "parent-pkg"}';
      }
      return '{"name": "root"}';
    });

    const result = resolveCurrentPackage('/workspace/packages/nested/src');
    expect(result).toEqual({ name: 'nested-pkg', dir: '/workspace/packages/nested' });
  });

  it('returns undefined when outside workspace', () => {
    vi.mocked(fg.sync).mockReturnValue(['/workspace/packages/my-pkg']);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const result = resolveCurrentPackage('/outside/workspace');
    expect(result).toBeUndefined();
  });
});
