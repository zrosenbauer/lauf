import * as fs from 'node:fs';

import { globSync } from 'tinyglobby';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

vi.mock('tinyglobby', () => ({
  globSync: vi.fn(() => []),
}));

vi.mock('../../utils/json.ts', () => ({
  safeParseJSON: vi.fn((content: string) => {
    try {
      return [null, JSON.parse(content)];
    } catch {
      return [new Error('parse error'), null];
    }
  }),
}));

import { discoverWorkspaces, findNearestWorkspace } from './discovery.ts';
import type { WorkspaceRoot } from './types.ts';

const ROOT: WorkspaceRoot = { dir: '/workspace', source: 'git' };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('discoverWorkspaces', () => {
  it('returns empty array when no configs found', () => {
    vi.mocked(globSync).mockReturnValue([]);

    const result = discoverWorkspaces(ROOT);
    expect(result).toEqual([]);
  });

  it('discovers workspaces from lauf.config.ts files', () => {
    vi.mocked(globSync).mockReturnValue([
      '/workspace/lauf.config.ts',
      '/workspace/packages/app/lauf.config.ts',
    ]);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/workspace/lauf.config.ts') {
        return 'export default { root: true }';
      }
      if (pathStr.includes('package.json') && pathStr.includes('packages/app')) {
        return '{"name": "@apps/web"}';
      }
      if (pathStr.includes('package.json') && pathStr === '/workspace/package.json') {
        return '{"name": "root-pkg"}';
      }
      return 'export default {}';
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = discoverWorkspaces(ROOT);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ dir: '/workspace', isRoot: true });
    expect(result[1]).toMatchObject({ dir: '/workspace/packages/app' });
  });

  it('deduplicates preferring lauf over laufen in same directory', () => {
    vi.mocked(globSync).mockReturnValue([
      '/workspace/laufen.config.ts',
      '/workspace/lauf.config.ts',
    ]);
    vi.mocked(fs.readFileSync).mockReturnValue('export default {}');

    const result = discoverWorkspaces(ROOT);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ configName: 'lauf' });
  });

  it('sorts by depth with shallowest first', () => {
    vi.mocked(globSync).mockReturnValue([
      '/workspace/packages/app/deep/lauf.config.ts',
      '/workspace/lauf.config.ts',
      '/workspace/packages/lauf.config.ts',
    ]);
    vi.mocked(fs.readFileSync).mockReturnValue('export default {}');

    const result = discoverWorkspaces(ROOT);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ dir: '/workspace' });
    expect(result[1]).toMatchObject({ dir: '/workspace/packages' });
    expect(result[2]).toMatchObject({ dir: '/workspace/packages/app/deep' });
  });

  it('uses directory basename when no package.json found', () => {
    vi.mocked(globSync).mockReturnValue(['/workspace/packages/my-app/lauf.config.ts']);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.includes('package.json')) {
        throw new Error('ENOENT');
      }
      return 'export default {}';
    });

    const result = discoverWorkspaces(ROOT);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'my-app' });
  });
});

describe('findNearestWorkspace', () => {
  it('finds config in current directory', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p) === '/workspace/packages/app/lauf.config.ts';
    });
    vi.mocked(fs.readFileSync).mockReturnValue('export default {}');

    const result = findNearestWorkspace('/workspace/packages/app', ROOT);
    expect(result).toMatchObject({ dir: '/workspace/packages/app', configName: 'lauf' });
  });

  it('walks up to find config in parent directory', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p) === '/workspace/lauf.config.ts';
    });
    vi.mocked(fs.readFileSync).mockReturnValue('export default {}');

    const result = findNearestWorkspace('/workspace/packages/app/src', ROOT);
    expect(result).toMatchObject({ dir: '/workspace' });
  });

  it('returns undefined when no config found within boundary', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = findNearestWorkspace('/workspace/packages/app', ROOT);
    expect(result).toBeUndefined();
  });

  it('prefers lauf.config.ts over laufen.config.ts', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      return pathStr === '/workspace/lauf.config.ts' || pathStr === '/workspace/laufen.config.ts';
    });
    vi.mocked(fs.readFileSync).mockReturnValue('export default {}');

    const result = findNearestWorkspace('/workspace', ROOT);
    expect(result).toMatchObject({ configName: 'lauf' });
  });

  it('stops at root boundary', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      // Config exists above the root boundary
      return String(p) === '/lauf.config.ts';
    });
    vi.mocked(fs.readFileSync).mockReturnValue('export default {}');

    const result = findNearestWorkspace('/workspace/packages/app', ROOT);
    expect(result).toBeUndefined();
  });
});
