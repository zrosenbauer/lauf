import * as fs from 'node:fs';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExistsSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn<typeof fs.existsSync>(),
}));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
}));

vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(() => []),
  },
}));

import {
  collectSearchDirs,
  detectSearchBoundary,
  discoverAllConfigs,
  findConfigFile,
} from './config-discovery.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectSearchBoundary', () => {
  it('returns git boundary when .git exists in startDir', () => {
    mockExistsSync.mockImplementation((p) => String(p) === '/projects/my-app/.git');

    const result = detectSearchBoundary('/projects/my-app');
    expect(result).toEqual({ root: '/projects/my-app', source: 'git' });
  });

  it('returns git boundary when .git exists in parent directory', () => {
    mockExistsSync.mockImplementation((p) => String(p) === '/projects/.git');

    const result = detectSearchBoundary('/projects/my-app');
    expect(result).toEqual({ root: '/projects', source: 'git' });
  });

  it('returns cap boundary when max depth reached', () => {
    mockExistsSync.mockReturnValue(false);

    const deepPath = '/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u';
    const result = detectSearchBoundary(deepPath);
    expect(result.source).toBe('cap');
  });

  it('returns cap boundary at filesystem root', () => {
    mockExistsSync.mockReturnValue(false);

    const result = detectSearchBoundary('/');
    expect(result).toEqual({ root: '/', source: 'cap' });
  });
});

describe('collectSearchDirs', () => {
  it('collects single directory when start equals boundary', () => {
    const result = collectSearchDirs('/projects', '/projects');
    expect(result).toEqual(['/projects']);
  });

  it('collects chain of directories from start to boundary', () => {
    const result = collectSearchDirs('/projects/my-app/src', '/projects');
    expect(result).toEqual(['/projects/my-app/src', '/projects/my-app', '/projects']);
  });

  it('stops at filesystem root', () => {
    const result = collectSearchDirs('/', '/some/boundary');
    expect(result).toEqual(['/']);
  });
});

describe('findConfigFile', () => {
  it('returns lauf.config.ts when found in startDir', () => {
    mockExistsSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/projects/my-app/.git') {
        return true;
      }
      if (pathStr === path.join('/projects/my-app', 'lauf.config.ts')) {
        return true;
      }
      return false;
    });

    const result = findConfigFile('/projects/my-app');
    expect(result).toEqual({
      configFile: path.join('/projects/my-app', 'lauf.config.ts'),
      configDir: '/projects/my-app',
      configName: 'lauf',
    });
  });

  it('returns laufen.config.ts when found in startDir and no lauf.config.ts', () => {
    mockExistsSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/projects/my-app/.git') {
        return true;
      }
      if (pathStr === path.join('/projects/my-app', 'laufen.config.ts')) {
        return true;
      }
      return false;
    });

    const result = findConfigFile('/projects/my-app');
    expect(result).toEqual({
      configFile: path.join('/projects/my-app', 'laufen.config.ts'),
      configDir: '/projects/my-app',
      configName: 'laufen',
    });
  });

  it('prefers lauf.config.ts over laufen.config.ts in same directory', () => {
    mockExistsSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/projects/my-app/.git') {
        return true;
      }
      if (pathStr === path.join('/projects/my-app', 'lauf.config.ts')) {
        return true;
      }
      if (pathStr === path.join('/projects/my-app', 'laufen.config.ts')) {
        return true;
      }
      return false;
    });

    const result = findConfigFile('/projects/my-app');
    expect(result).toEqual({
      configFile: path.join('/projects/my-app', 'lauf.config.ts'),
      configDir: '/projects/my-app',
      configName: 'lauf',
    });
  });

  it('finds config in parent directory when not in startDir', () => {
    mockExistsSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/projects/.git') {
        return true;
      }
      if (pathStr === path.join('/projects', 'lauf.config.ts')) {
        return true;
      }
      return false;
    });

    const result = findConfigFile('/projects/my-app');
    expect(result).toEqual({
      configFile: path.join('/projects', 'lauf.config.ts'),
      configDir: '/projects',
      configName: 'lauf',
    });
  });

  it('returns undefined when no config file exists anywhere', () => {
    mockExistsSync.mockReturnValue(false);

    const result = findConfigFile('/projects/my-app');
    expect(result).toBeUndefined();
  });

  it('returns closest config when startDir wins over parent', () => {
    mockExistsSync.mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/projects/.git') {
        return true;
      }
      if (pathStr === path.join('/projects/my-app', 'lauf.config.ts')) {
        return true;
      }
      if (pathStr === path.join('/projects', 'lauf.config.ts')) {
        return true;
      }
      return false;
    });

    const result = findConfigFile('/projects/my-app');
    expect(result).toEqual({
      configFile: path.join('/projects/my-app', 'lauf.config.ts'),
      configDir: '/projects/my-app',
      configName: 'lauf',
    });
  });
});

describe('discoverAllConfigs', () => {
  it('returns all config files within boundary', async () => {
    mockExistsSync.mockImplementation((p) => String(p) === '/projects/.git');

    const { default: fgMod } = await import('fast-glob');
    vi.mocked(fgMod.sync).mockReturnValue([
      '/projects/lauf.config.ts',
      '/projects/apps/web/lauf.config.ts',
    ]);

    const result = discoverAllConfigs('/projects/apps/web');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      configFile: '/projects/lauf.config.ts',
      configDir: '/projects',
      configName: 'lauf',
    });
    expect(result[1]).toEqual({
      configFile: '/projects/apps/web/lauf.config.ts',
      configDir: '/projects/apps/web',
      configName: 'lauf',
    });
  });

  it('deduplicates by directory and prefers lauf over laufen', async () => {
    mockExistsSync.mockImplementation((p) => String(p) === '/projects/.git');

    const { default: fgMod } = await import('fast-glob');
    vi.mocked(fgMod.sync).mockReturnValue([
      '/projects/laufen.config.ts',
      '/projects/lauf.config.ts',
    ]);

    const result = discoverAllConfigs('/projects');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      configFile: '/projects/lauf.config.ts',
      configDir: '/projects',
      configName: 'lauf',
    });
  });

  it('skips laufen when lauf is already found for the same directory', async () => {
    mockExistsSync.mockImplementation((p) => String(p) === '/projects/.git');

    const { default: fgMod } = await import('fast-glob');
    vi.mocked(fgMod.sync).mockReturnValue([
      '/projects/lauf.config.ts',
      '/projects/laufen.config.ts',
    ]);

    const result = discoverAllConfigs('/projects');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      configFile: '/projects/lauf.config.ts',
      configDir: '/projects',
      configName: 'lauf',
    });
  });

  it('returns empty array when no configs found', async () => {
    mockExistsSync.mockImplementation((p) => String(p) === '/projects/.git');

    const { default: fgMod } = await import('fast-glob');
    vi.mocked(fgMod.sync).mockReturnValue([]);

    const result = discoverAllConfigs('/projects');
    expect(result).toEqual([]);
  });

  it('sorts by path depth with shallowest first', async () => {
    mockExistsSync.mockImplementation((p) => String(p) === '/projects/.git');

    const { default: fgMod } = await import('fast-glob');
    vi.mocked(fgMod.sync).mockReturnValue([
      '/projects/apps/web/deep/lauf.config.ts',
      '/projects/lauf.config.ts',
      '/projects/apps/lauf.config.ts',
    ]);

    const result = discoverAllConfigs('/projects');
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ configDir: '/projects' });
    expect(result[1]).toMatchObject({ configDir: '/projects/apps' });
    expect(result[2]).toMatchObject({ configDir: '/projects/apps/web/deep' });
  });
});
