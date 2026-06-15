import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./root.ts', () => ({
  resolveRoot: vi.fn(() => ({ dir: '/workspace', source: 'git' })),
}));

vi.mock('./discover.ts', () => ({
  discoverWorkspaces: vi.fn(() => [
    {
      name: '<root>',
      dir: '/workspace',
      configFile: '/workspace/lauf.config.ts',
      configName: 'lauf',
      isRoot: true,
    },
    {
      name: '@apps/web',
      dir: '/workspace/packages/web',
      configFile: '/workspace/packages/web/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    },
  ]),
}));

import { getWorkspaceState, resetWorkspaceCache } from './cache.ts';

beforeEach(() => {
  vi.clearAllMocks();
  resetWorkspaceCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getWorkspaceState', () => {
  it('returns root and workspaces', () => {
    const state = getWorkspaceState('/workspace/packages/web/src');
    expect(state.root).toEqual({ dir: '/workspace', source: 'git' });
    expect(state.tree.workspaces).toHaveLength(2);
  });

  it('resolves current workspace from cwd', () => {
    const state = getWorkspaceState('/workspace/packages/web/src');
    expect(state.current).toMatchObject({ name: '@apps/web' });
  });

  it('resolves root as current when cwd is at root', () => {
    const state = getWorkspaceState('/workspace');
    expect(state.current).toMatchObject({ name: '<root>', isRoot: true });
  });

  it('caches result on subsequent calls with same cwd', () => {
    const first = getWorkspaceState('/workspace');
    const second = getWorkspaceState('/workspace');
    expect(first).toBe(second);
  });

  it('returns undefined current when cwd is outside workspaces', () => {
    const state = getWorkspaceState('/outside');
    expect(state.current).toBeUndefined();
  });
});

describe('resetWorkspaceCache', () => {
  it('clears cached state', () => {
    const first = getWorkspaceState('/workspace');
    resetWorkspaceCache();
    const second = getWorkspaceState('/workspace');
    expect(first).not.toBe(second);
  });
});
