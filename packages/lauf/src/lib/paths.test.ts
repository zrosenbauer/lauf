import * as fs from 'node:fs';

import fg from 'fast-glob';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
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

import { LAUF_ROOT, resolveWorkspacePackages, resolveTsx } from './paths.ts';

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
    const found = packages.find((p) => p.name === 'root-pkg');
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

describe('resolveTsx', () => {
  it('returns tsx path when binary exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = resolveTsx();
    expect(result[0]).toBeNull();
    expect(result[1]).toContain('tsx');
    expect(result[1]).toContain('node_modules/.bin/tsx');
  });

  it('returns error message when tsx binary does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = resolveTsx();
    expect(result[0]).toContain('tsx binary not found');
    expect(result[0]).toContain('pnpm install');
    expect(result[1]).toBeNull();
  });
});
