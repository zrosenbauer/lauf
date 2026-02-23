import * as fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('workspace detection', () => {
  it('detects pnpm workspace', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('pnpm-workspace.yaml'));
    vi.mocked(fs.readFileSync).mockReturnValue('packages:\n  - "packages/*"\n');
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('pnpm');
    expect(info.globs).toContain('packages/*');
  });

  it('detects npm workspace from package.json with array', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.endsWith('package.json')) {
        return true;
      }
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ workspaces: ['packages/*', 'apps/*'] }),
    );
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('npm');
    expect(info.globs).toContain('packages/*');
    expect(info.globs).toContain('apps/*');
  });

  it('detects yarn workspace via lockfile', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.endsWith('package.json')) {
        return true;
      }
      if (pathStr.endsWith('yarn.lock')) {
        return true;
      }
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ workspaces: ['packages/*'] }));
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('yarn');
  });

  it('detects bun workspace via bun.lockb', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.endsWith('package.json')) {
        return true;
      }
      if (pathStr.endsWith('bun.lockb')) {
        return true;
      }
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ workspaces: ['packages/*'] }));
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('bun');
  });

  it('detects bun workspace via bun.lock', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.endsWith('package.json')) {
        return true;
      }
      if (pathStr.endsWith('bun.lock')) {
        return true;
      }
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ workspaces: ['packages/*'] }));
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('bun');
  });

  it('detects package.json workspaces with object form', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('package.json'));
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ workspaces: { packages: ['packages/*'] } }),
    );
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.globs).toContain('packages/*');
  });

  it('detects lerna workspace', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('lerna.json'));
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ packages: ['packages/*'] }));
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('lerna');
    expect(info.globs).toContain('packages/*');
  });

  it('falls back to single when no workspace found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('single');
    expect(info.globs).toEqual([]);
  });

  it('getWorkspaceRoot returns root path', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('pnpm-workspace.yaml'));
    vi.mocked(fs.readFileSync).mockReturnValue('packages:\n  - "packages/*"\n');
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const root = mod.getWorkspaceRoot();

    expect(typeof root).toBe('string');
    expect(root.length).toBeGreaterThan(0);
  });

  it('skips package.json without workspaces field', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      // Only package.json exists, no pnpm or lerna
      if (pathStr.endsWith('package.json')) {
        return true;
      }
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ name: 'my-pkg', version: '1.0.0' }),
    );
    vi.spyOn(process, 'cwd').mockReturnValue('/');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    // Should eventually hit root or max iterations, falling back to single
    expect(info.manager).toBe('single');
  });

  it('skips lerna.json with invalid JSON', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('lerna.json'));
    vi.mocked(fs.readFileSync).mockReturnValue('not valid json {{{');
    vi.spyOn(process, 'cwd').mockReturnValue('/');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('single');
  });

  it('skips lerna.json without packages field', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('lerna.json'));
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version: '3.0.0' }));
    vi.spyOn(process, 'cwd').mockReturnValue('/');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('single');
  });

  it('rejects pnpm-workspace.yaml with non-string packages', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('pnpm-workspace.yaml'));
    vi.mocked(fs.readFileSync).mockReturnValue('packages:\n  - 123\n  - true\n');
    vi.spyOn(process, 'cwd').mockReturnValue('/');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('single');
  });

  it('rejects package.json workspaces with non-string elements', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('package.json'));
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ workspaces: [123, true, 'packages/*'] }),
    );
    vi.spyOn(process, 'cwd').mockReturnValue('/');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('single');
  });

  it('caches workspace info on subsequent calls', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('pnpm-workspace.yaml'));
    vi.mocked(fs.readFileSync).mockReturnValue('packages:\n  - "packages/*"\n');
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const first = mod.getWorkspaceInfo();
    const second = mod.getWorkspaceInfo();

    expect(first).toBe(second);
  });

  it('resetWorkspaceCache clears the cached value', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('pnpm-workspace.yaml'));
    vi.mocked(fs.readFileSync).mockReturnValue('packages:\n  - "packages/*"\n');
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    mod.getWorkspaceInfo();

    // Reset and change the environment
    mod.resetWorkspaceCache();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.spyOn(process, 'cwd').mockReturnValue('/other/project');

    const info = mod.getWorkspaceInfo();
    expect(info.manager).toBe('single');
  });

  it('falls back to single when pnpm-workspace.yaml contains invalid YAML', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('pnpm-workspace.yaml'));
    vi.mocked(fs.readFileSync).mockReturnValue(': : : invalid yaml {{{[');
    vi.spyOn(process, 'cwd').mockReturnValue('/');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('single');
  });

  it('falls back to single when package.json contains invalid JSON', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('package.json'));
    vi.mocked(fs.readFileSync).mockReturnValue('not valid json {{{');
    vi.spyOn(process, 'cwd').mockReturnValue('/');

    const mod = await import('./workspace.ts');
    mod.resetWorkspaceCache();
    const info = mod.getWorkspaceInfo();

    expect(info.manager).toBe('single');
  });
});
