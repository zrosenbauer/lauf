import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Workspace, WorkspaceRoot } from '../workspace/types.ts';

const { mockLoadConfig } = vi.hoisted(() => ({
  mockLoadConfig: vi.fn(),
}));

const { mockFindNearestWorkspace, mockDiscoverWorkspaces } = vi.hoisted(() => ({
  mockFindNearestWorkspace: vi.fn(),
  mockDiscoverWorkspaces: vi.fn((): Workspace[] => []),
}));

const { mockResolveRoot } = vi.hoisted(() => ({
  mockResolveRoot: vi.fn((): WorkspaceRoot => ({ dir: '/project', source: 'git' })),
}));

const { mockLogWarn } = vi.hoisted(() => ({
  mockLogWarn: vi.fn(),
}));

vi.mock('c12', () => ({
  loadConfig: mockLoadConfig,
}));

vi.mock('../workspace/discover.ts', () => ({
  findNearestWorkspace: mockFindNearestWorkspace,
  discoverWorkspaces: mockDiscoverWorkspaces,
}));

vi.mock('../workspace/root.ts', () => ({
  resolveRoot: mockResolveRoot,
}));

vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
    warn: mockLogWarn,
    info: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  },
}));

import { createConfigLoader } from './index.ts';

const loadLaufConfig = (cwd: string) => createConfigLoader({ cwd }).load();
const loadLaufConfigWithMeta = (cwd: string) => createConfigLoader({ cwd }).loadWithMeta();
const loadAllLaufConfigs = (cwd: string) => createConfigLoader({ cwd }).loadAll();
const safeLoadLaufConfig = (cwd: string) => createConfigLoader({ cwd }).safeLoad();
const safeLoadLaufConfigWithMeta = (cwd: string) => createConfigLoader({ cwd }).safeLoadWithMeta();

const DEFAULTS = {
  root: false,
  scripts: ['scripts/*.ts'],
  logger: undefined,
  spinner: true,
  sandbox: true,
  env: {},
  packages: {},
  watch: undefined,
} as const;

const WS_LAUF: Workspace = {
  name: 'my-project',
  dir: '/project',
  configFile: '/project/lauf.config.ts',
  configName: 'lauf',
  isRoot: false,
};

const WS_LAUFEN: Workspace = {
  name: 'my-project',
  dir: '/project',
  configFile: '/project/laufen.config.ts',
  configName: 'laufen',
  isRoot: false,
};

const VALID_CONFIG = {
  root: false,
  scripts: ['src/**/*.ts'],
  logger: undefined,
  spinner: true,
  sandbox: true,
  env: {},
  packages: {},
  watch: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadLaufConfig', () => {
  it('returns config when workspace found and loadConfig succeeds', async () => {
    mockFindNearestWorkspace.mockReturnValue(WS_LAUF);
    mockLoadConfig.mockResolvedValueOnce({
      configFile: '/project/lauf.config.ts',
      config: VALID_CONFIG,
    });

    const result = await loadLaufConfig('/project');
    expect(result).toEqual(VALID_CONFIG);
  });

  it('returns defaults when no workspace found', async () => {
    mockFindNearestWorkspace.mockReturnValue(undefined);

    const result = await loadLaufConfig('/project');
    expect(result).toEqual(DEFAULTS);
    expect(mockLoadConfig).not.toHaveBeenCalled();
  });

  it('returns defaults and warns when config fails Zod validation', async () => {
    mockFindNearestWorkspace.mockReturnValue(WS_LAUF);
    mockLoadConfig.mockResolvedValueOnce({
      configFile: '/project/lauf.config.ts',
      config: { scripts: 'not-an-array', spinner: 'not-a-boolean' },
    });

    const result = await loadLaufConfig('/project');
    expect(result).toEqual(DEFAULTS);
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('Config validation failed for /project/lauf.config.ts'),
    );
  });

  it('returns defaults when c12 loadConfig resolves with no configFile', async () => {
    mockFindNearestWorkspace.mockReturnValue(WS_LAUF);
    mockLoadConfig.mockResolvedValueOnce({
      configFile: undefined,
      config: {},
    });

    const result = await loadLaufConfig('/project');
    expect(result).toEqual(DEFAULTS);
  });

  it('passes correct name and cwd to c12 loadConfig based on workspace', async () => {
    mockFindNearestWorkspace.mockReturnValue(WS_LAUFEN);
    mockLoadConfig.mockResolvedValueOnce({
      configFile: '/project/laufen.config.ts',
      config: { scripts: ['tools/*.ts'], logger: undefined, spinner: true },
    });

    await loadLaufConfig('/project');
    expect(mockLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'laufen', cwd: '/project' }),
    );
  });
});

describe('loadLaufConfigWithMeta', () => {
  it('returns config with metadata when workspace is found', async () => {
    mockFindNearestWorkspace.mockReturnValue(WS_LAUF);
    mockLoadConfig.mockResolvedValueOnce({
      configFile: '/project/lauf.config.ts',
      config: VALID_CONFIG,
    });

    const result = await loadLaufConfigWithMeta('/project');
    expect(result).toEqual({
      config: VALID_CONFIG,
      configFile: '/project/lauf.config.ts',
      configDir: '/project',
    });
  });

  it('returns defaults with configFile=undefined when no workspace found', async () => {
    mockFindNearestWorkspace.mockReturnValue(undefined);

    const result = await loadLaufConfigWithMeta('/project');
    expect(result).toEqual({
      config: DEFAULTS,
      configFile: undefined,
      configDir: '/project',
    });
    expect(mockLoadConfig).not.toHaveBeenCalled();
  });

  it('returns workspace dir and configFile in result', async () => {
    const ws: Workspace = {
      name: '@apps/web',
      dir: '/workspace/packages/app',
      configFile: '/workspace/packages/app/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    };
    mockFindNearestWorkspace.mockReturnValue(ws);
    mockLoadConfig.mockResolvedValueOnce({
      configFile: '/workspace/packages/app/lauf.config.ts',
      config: VALID_CONFIG,
    });

    const result = await loadLaufConfigWithMeta('/workspace/packages/app/src');
    expect(result.configFile).toBe('/workspace/packages/app/lauf.config.ts');
    expect(result.configDir).toBe('/workspace/packages/app');
  });
});

describe('loadAllLaufConfigs', () => {
  it('returns configs from all discovered workspaces', async () => {
    const wsA: Workspace = {
      name: 'pkg-a',
      dir: '/workspace/packages/a',
      configFile: '/workspace/packages/a/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    };
    const wsB: Workspace = {
      name: 'pkg-b',
      dir: '/workspace/packages/b',
      configFile: '/workspace/packages/b/laufen.config.ts',
      configName: 'laufen',
      isRoot: false,
    };
    mockDiscoverWorkspaces.mockReturnValue([wsA, wsB]);
    mockLoadConfig
      .mockResolvedValueOnce({
        configFile: '/workspace/packages/a/lauf.config.ts',
        config: {
          root: false,
          scripts: ['src/*.ts'],
          logger: undefined,
          spinner: true,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
      })
      .mockResolvedValueOnce({
        configFile: '/workspace/packages/b/laufen.config.ts',
        config: {
          root: false,
          scripts: ['tools/*.ts'],
          logger: undefined,
          spinner: false,
          sandbox: true,
          env: {},
          packages: {},
          watch: undefined,
        },
      });

    const results = await loadAllLaufConfigs('/workspace');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      configFile: '/workspace/packages/a/lauf.config.ts',
      configDir: '/workspace/packages/a',
    });
    expect(results[1]).toMatchObject({
      configFile: '/workspace/packages/b/laufen.config.ts',
      configDir: '/workspace/packages/b',
    });
  });

  it('returns defaults when no workspaces discovered', async () => {
    mockDiscoverWorkspaces.mockReturnValue([]);

    const results = await loadAllLaufConfigs('/workspace');
    expect(results).toEqual([{ config: DEFAULTS, configFile: undefined, configDir: '/workspace' }]);
    expect(mockLoadConfig).not.toHaveBeenCalled();
  });

  it('loads each workspace config via c12', async () => {
    const wsA: Workspace = {
      name: 'pkg-a',
      dir: '/workspace/a',
      configFile: '/workspace/a/lauf.config.ts',
      configName: 'lauf',
      isRoot: false,
    };
    const wsB: Workspace = {
      name: 'pkg-b',
      dir: '/workspace/b',
      configFile: '/workspace/b/laufen.config.ts',
      configName: 'laufen',
      isRoot: false,
    };
    mockDiscoverWorkspaces.mockReturnValue([wsA, wsB]);
    mockLoadConfig.mockResolvedValue({
      configFile: '/workspace/a/lauf.config.ts',
      config: VALID_CONFIG,
    });

    await loadAllLaufConfigs('/workspace');
    expect(mockLoadConfig).toHaveBeenCalledTimes(2);
    expect(mockLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'lauf', cwd: '/workspace/a' }),
    );
    expect(mockLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'laufen', cwd: '/workspace/b' }),
    );
  });
});

describe('safeLoadLaufConfig', () => {
  it('returns ok result with config on success', async () => {
    mockFindNearestWorkspace.mockReturnValue(WS_LAUF);
    mockLoadConfig.mockResolvedValueOnce({
      configFile: '/project/lauf.config.ts',
      config: VALID_CONFIG,
    });

    const result = await safeLoadLaufConfig('/project');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(VALID_CONFIG);
    }
  });

  it('returns err result when loadConfig throws Error', async () => {
    mockFindNearestWorkspace.mockReturnValue(WS_LAUF);
    mockLoadConfig.mockRejectedValueOnce(new Error('config load failed'));

    const result = await safeLoadLaufConfig('/project');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('returns err result when loadConfig throws non-Error value', async () => {
    mockFindNearestWorkspace.mockReturnValue(WS_LAUF);
    mockLoadConfig.mockRejectedValueOnce('string rejection');

    const result = await safeLoadLaufConfig('/project');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('string rejection');
    }
  });
});

describe('safeLoadLaufConfigWithMeta', () => {
  it('returns ok result with loaded config on success', async () => {
    mockFindNearestWorkspace.mockReturnValue(WS_LAUF);
    mockLoadConfig.mockResolvedValueOnce({
      configFile: '/project/lauf.config.ts',
      config: VALID_CONFIG,
    });

    const result = await safeLoadLaufConfigWithMeta('/project');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        config: VALID_CONFIG,
        configFile: '/project/lauf.config.ts',
        configDir: '/project',
      });
    }
  });

  it('returns err result when loading throws Error', async () => {
    mockFindNearestWorkspace.mockReturnValue(WS_LAUF);
    mockLoadConfig.mockRejectedValueOnce(new Error('meta load failed'));

    const result = await safeLoadLaufConfigWithMeta('/project');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('returns err result when loading throws non-Error value', async () => {
    mockFindNearestWorkspace.mockReturnValue(WS_LAUF);
    mockLoadConfig.mockRejectedValueOnce(42);

    const result = await safeLoadLaufConfigWithMeta('/project');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('42');
    }
  });
});
