import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DiscoveredConfig } from './config-discovery.ts';

const { mockLoadConfig } = vi.hoisted(() => ({
  mockLoadConfig: vi.fn(),
}));

const { mockFindConfigFile, mockDiscoverAllConfigs } = vi.hoisted(() => ({
  mockFindConfigFile: vi.fn(),
  mockDiscoverAllConfigs: vi.fn(),
}));

const { mockLogWarn } = vi.hoisted(() => ({
  mockLogWarn: vi.fn(),
}));

vi.mock('c12', () => ({
  loadConfig: mockLoadConfig,
}));

vi.mock('./config-discovery.ts', () => ({
  findConfigFile: mockFindConfigFile,
  discoverAllConfigs: mockDiscoverAllConfigs,
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

import {
  loadAllLaufConfigs,
  loadLaufConfig,
  loadLaufConfigWithMeta,
  safeLoadLaufConfig,
  safeLoadLaufConfigWithMeta,
} from './config.ts';

const DEFAULTS = {
  scripts: ['scripts/*.ts'],
  logger: undefined,
  spinner: true,
  sandbox: true,
  env: {},
  packages: {},
  watch: undefined,
} as const;

const DISCOVERED_LAUF: DiscoveredConfig = {
  configFile: '/project/lauf.config.ts',
  configDir: '/project',
  configName: 'lauf',
};

const DISCOVERED_LAUFEN: DiscoveredConfig = {
  configFile: '/project/laufen.config.ts',
  configDir: '/project',
  configName: 'laufen',
};

const VALID_CONFIG = {
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
  it('returns config when findConfigFile returns a discovered config and loadConfig succeeds', async () => {
    mockFindConfigFile.mockReturnValue(DISCOVERED_LAUF);
    mockLoadConfig.mockResolvedValueOnce({
      configFile: '/project/lauf.config.ts',
      config: VALID_CONFIG,
    });

    const result = await loadLaufConfig('/project');
    expect(result).toEqual(VALID_CONFIG);
  });

  it('returns defaults when findConfigFile returns undefined', async () => {
    mockFindConfigFile.mockReturnValue(undefined);

    const result = await loadLaufConfig('/project');
    expect(result).toEqual(DEFAULTS);
    expect(mockLoadConfig).not.toHaveBeenCalled();
  });

  it('returns defaults and warns when config fails Zod validation', async () => {
    mockFindConfigFile.mockReturnValue(DISCOVERED_LAUF);
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
    mockFindConfigFile.mockReturnValue(DISCOVERED_LAUF);
    mockLoadConfig.mockResolvedValueOnce({
      configFile: undefined,
      config: {},
    });

    const result = await loadLaufConfig('/project');
    expect(result).toEqual(DEFAULTS);
  });

  it('passes correct name and cwd to c12 loadConfig based on discovered config', async () => {
    mockFindConfigFile.mockReturnValue(DISCOVERED_LAUFEN);
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
  it('returns config with metadata when config is found', async () => {
    mockFindConfigFile.mockReturnValue(DISCOVERED_LAUF);
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

  it('returns defaults with configFile=undefined when no config found', async () => {
    mockFindConfigFile.mockReturnValue(undefined);

    const result = await loadLaufConfigWithMeta('/project');
    expect(result).toEqual({
      config: DEFAULTS,
      configFile: undefined,
      configDir: '/project',
    });
    expect(mockLoadConfig).not.toHaveBeenCalled();
  });

  it('returns discovered configDir and configFile in result', async () => {
    const discovered: DiscoveredConfig = {
      configFile: '/workspace/packages/app/lauf.config.ts',
      configDir: '/workspace/packages/app',
      configName: 'lauf',
    };
    mockFindConfigFile.mockReturnValue(discovered);
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
  it('returns configs from all discovered configs', async () => {
    const discoveredA: DiscoveredConfig = {
      configFile: '/workspace/packages/a/lauf.config.ts',
      configDir: '/workspace/packages/a',
      configName: 'lauf',
    };
    const discoveredB: DiscoveredConfig = {
      configFile: '/workspace/packages/b/laufen.config.ts',
      configDir: '/workspace/packages/b',
      configName: 'laufen',
    };
    mockDiscoverAllConfigs.mockReturnValue([discoveredA, discoveredB]);
    mockLoadConfig
      .mockResolvedValueOnce({
        configFile: '/workspace/packages/a/lauf.config.ts',
        config: {
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
    expect(results[0]).toEqual({
      config: {
        scripts: ['src/*.ts'],
        logger: undefined,
        spinner: true,
        sandbox: true,
        env: {},
        packages: {},
        watch: undefined,
      },
      configFile: '/workspace/packages/a/lauf.config.ts',
      configDir: '/workspace/packages/a',
    });
    expect(results[1]).toEqual({
      config: {
        scripts: ['tools/*.ts'],
        logger: undefined,
        spinner: false,
        sandbox: true,
        env: {},
        packages: {},
        watch: undefined,
      },
      configFile: '/workspace/packages/b/laufen.config.ts',
      configDir: '/workspace/packages/b',
    });
  });

  it('returns defaults when discoverAllConfigs returns empty array', async () => {
    mockDiscoverAllConfigs.mockReturnValue([]);

    const results = await loadAllLaufConfigs('/workspace');
    expect(results).toEqual([{ config: DEFAULTS, configFile: undefined, configDir: '/workspace' }]);
    expect(mockLoadConfig).not.toHaveBeenCalled();
  });

  it('loads each discovered config via c12', async () => {
    const discoveredA: DiscoveredConfig = {
      configFile: '/workspace/a/lauf.config.ts',
      configDir: '/workspace/a',
      configName: 'lauf',
    };
    const discoveredB: DiscoveredConfig = {
      configFile: '/workspace/b/laufen.config.ts',
      configDir: '/workspace/b',
      configName: 'laufen',
    };
    mockDiscoverAllConfigs.mockReturnValue([discoveredA, discoveredB]);
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
  it('returns [null, config] on success', async () => {
    mockFindConfigFile.mockReturnValue(DISCOVERED_LAUF);
    mockLoadConfig.mockResolvedValueOnce({
      configFile: '/project/lauf.config.ts',
      config: VALID_CONFIG,
    });

    const [error, config] = await safeLoadLaufConfig('/project');
    expect(error).toBeNull();
    expect(config).toEqual(VALID_CONFIG);
  });

  it('returns [error, null] when loadConfig throws Error', async () => {
    mockFindConfigFile.mockReturnValue(DISCOVERED_LAUF);
    mockLoadConfig.mockRejectedValueOnce(new Error('config load failed'));

    const [error, config] = await safeLoadLaufConfig('/project');
    expect(error).toBeInstanceOf(Error);
    expect(config).toBeNull();
  });

  it('returns [error, null] when loadConfig throws non-Error value', async () => {
    mockFindConfigFile.mockReturnValue(DISCOVERED_LAUF);
    mockLoadConfig.mockRejectedValueOnce('string rejection');

    const [error, config] = await safeLoadLaufConfig('/project');
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('string rejection');
    expect(config).toBeNull();
  });
});

describe('safeLoadLaufConfigWithMeta', () => {
  it('returns [null, loaded] on success', async () => {
    mockFindConfigFile.mockReturnValue(DISCOVERED_LAUF);
    mockLoadConfig.mockResolvedValueOnce({
      configFile: '/project/lauf.config.ts',
      config: VALID_CONFIG,
    });

    const [error, loaded] = await safeLoadLaufConfigWithMeta('/project');
    expect(error).toBeNull();
    expect(loaded).toEqual({
      config: VALID_CONFIG,
      configFile: '/project/lauf.config.ts',
      configDir: '/project',
    });
  });

  it('returns [error, null] when loading throws Error', async () => {
    mockFindConfigFile.mockReturnValue(DISCOVERED_LAUF);
    mockLoadConfig.mockRejectedValueOnce(new Error('meta load failed'));

    const [error, loaded] = await safeLoadLaufConfigWithMeta('/project');
    expect(error).toBeInstanceOf(Error);
    expect(loaded).toBeNull();
  });

  it('returns [error, null] when loading throws non-Error value', async () => {
    mockFindConfigFile.mockReturnValue(DISCOVERED_LAUF);
    mockLoadConfig.mockRejectedValueOnce(42);

    const [error, loaded] = await safeLoadLaufConfigWithMeta('/project');
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('42');
    expect(loaded).toBeNull();
  });
});
