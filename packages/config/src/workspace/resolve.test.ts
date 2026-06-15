import { describe, expect, it } from 'vitest';

import { resolveCurrentWorkspace } from './resolve.ts';
import type { Workspace } from './types.ts';

const makeWorkspace = (name: string, dir: string, isRoot = false): Workspace => ({
  name,
  dir,
  configFile: `${dir}/lauf.config.ts`,
  configName: 'lauf',
  isRoot,
});

describe('resolveCurrentWorkspace', () => {
  it('returns matching workspace when cwd is exactly the workspace dir', () => {
    const workspaces = [makeWorkspace('app', '/workspace/packages/app')];

    const result = resolveCurrentWorkspace('/workspace/packages/app', workspaces);
    expect(result).toMatchObject({ name: 'app', dir: '/workspace/packages/app' });
  });

  it('returns matching workspace when cwd is inside workspace dir', () => {
    const workspaces = [makeWorkspace('app', '/workspace/packages/app')];

    const result = resolveCurrentWorkspace('/workspace/packages/app/src/lib', workspaces);
    expect(result).toMatchObject({ name: 'app' });
  });

  it('returns deepest matching workspace for nested workspaces', () => {
    const workspaces = [
      makeWorkspace('root', '/workspace', true),
      makeWorkspace('app', '/workspace/packages/app'),
    ];

    const result = resolveCurrentWorkspace('/workspace/packages/app/src', workspaces);
    expect(result).toMatchObject({ name: 'app' });
  });

  it('returns root workspace when cwd is at workspace root', () => {
    const workspaces = [
      makeWorkspace('root', '/workspace', true),
      makeWorkspace('app', '/workspace/packages/app'),
    ];

    const result = resolveCurrentWorkspace('/workspace', workspaces);
    expect(result).toMatchObject({ name: 'root', isRoot: true });
  });

  it('returns undefined when cwd is outside all workspaces', () => {
    const workspaces = [makeWorkspace('app', '/workspace/packages/app')];

    const result = resolveCurrentWorkspace('/other/path', workspaces);
    expect(result).toBeUndefined();
  });

  it('returns undefined when workspaces array is empty', () => {
    const result = resolveCurrentWorkspace('/workspace', []);
    expect(result).toBeUndefined();
  });

  it('does not match prefix-similar paths', () => {
    const workspaces = [makeWorkspace('app', '/workspace/packages/app')];

    const result = resolveCurrentWorkspace('/workspace/packages/app-extra', workspaces);
    expect(result).toBeUndefined();
  });
});
