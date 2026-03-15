import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
    step: vi.fn(),
  },
}));

vi.mock('../lib/config.ts', () => ({
  safeLoadLaufConfigWithMeta: vi.fn(),
}));

vi.mock('../lib/discovery.ts', () => ({
  discoverScripts: vi.fn(() => []),
  findScript: vi.fn(),
}));

vi.mock('../lib/paths.ts', () => ({
  getWorkspaceRoot: vi.fn(() => '/workspace'),
  LAUF_ROOT: '/lauf-root',
}));

vi.mock('@laufen/engine', () => ({
  runScript: vi.fn(),
  resolveEnvValue: vi.fn(() => Promise.resolve([null, {}])),
}));

vi.mock('../utils/prompt.ts', () => ({
  promptForScript: vi.fn(),
}));

import { resolveEnvValue, runScript } from '@laufen/engine';

import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { findScript } from '../lib/discovery.ts';
import type { DiscoveredScript } from '../lib/types.ts';
import { promptForScript } from '../utils/prompt.ts';
import runHandler from './run.ts';

const mockScript: DiscoveredScript = {
  name: 'my-pkg/build',
  path: '/workspace/packages/my-pkg/scripts/build.ts',
  packageDir: '/workspace/packages/my-pkg',
  packageName: 'my-pkg',
};

const mockLoadedConfig = {
  config: {
    scripts: ['scripts/*.lauf.ts'],
    logger: undefined,
    spinner: true,
    sandbox: true,
    env: {},
    packages: {},
  },
  configFile: '/workspace/lauf.config.ts',
  configDir: '/workspace',
};

const expectedRunOptions = {
  workspaceRoot: '/workspace',
  cliPackageRoot: '/lauf-root',
  spinner: true,
  env: {},
  cliEnv: {},
  sandbox: true,
  workspacePackages: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  // Default: no trailing argv
  Object.defineProperty(process, 'argv', {
    value: ['node', 'lauf', 'run'],
    writable: true,
    configurable: true,
  });
  // Default: resolveEnvValue succeeds with empty object
  vi.mocked(resolveEnvValue).mockResolvedValue([null, {}]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('run handler', () => {
  it('fails when config cannot be loaded', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([new Error('err'), null]);

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('fails when script not found by name', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(undefined);

    await runHandler({ parameters: { script: 'pkg/nonexistent' } });

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('runs script successfully when found by name', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(mockScript, expect.any(Object), expectedRunOptions);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('fails when script exits with non-zero code', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 1, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('prompts for script when name not provided', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(promptForScript).mockResolvedValue([null, mockScript]);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    await runHandler({ parameters: {} });

    expect(promptForScript).toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('runs in help mode when --help flag is present', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '--help'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      {},
      {
        help: true,
        workspaceRoot: '/workspace',
        cliPackageRoot: '/lauf-root',
        spinner: true,
        env: {},
        workspacePackages: {},
        cliEnv: {},
        sandbox: true,
      },
    );
  });

  it('runs in help mode when -h flag is present', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '-h'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      {},
      {
        help: true,
        workspaceRoot: '/workspace',
        cliPackageRoot: '/lauf-root',
        spinner: true,
        env: {},
        workspacePackages: {},
        cliEnv: {},
        sandbox: true,
      },
    );
  });

  it('parses --key=value args', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '--name=test'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      expect.objectContaining({ name: 'test' }),
      expectedRunOptions,
    );
  });

  it('parses --key value args', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '--name', 'hello'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      expect.objectContaining({ name: 'hello' }),
      expectedRunOptions,
    );
  });

  it('parses --flag as boolean true', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '--verbose'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      expect.objectContaining({ verbose: true }),
      expectedRunOptions,
    );
  });

  it('coerces true/false string values to booleans', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '--verbose=true', '--debug=false'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      expect.objectContaining({ verbose: true, debug: false }),
      expectedRunOptions,
    );
  });

  it('coerces numeric string values to numbers', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '--count=42'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      expect.objectContaining({ count: 42 }),
      expectedRunOptions,
    );
  });

  it('logs step and success during script execution', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(p.log.step).toHaveBeenCalled();
    expect(p.log.success).toHaveBeenCalled();
  });

  it('warns when positional arguments are found in argv', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', 'positional', '--name', 'test'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      expect.objectContaining({ name: 'test' }),
      expectedRunOptions,
    );
    expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('positional'));
  });

  it('coerces empty string value as-is', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '--label='],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      expect.objectContaining({ label: '' }),
      expectedRunOptions,
    );
  });

  it('does not coerce hex strings to numbers', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '--val=0xff'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      expect.objectContaining({ val: '0xff' }),
      expectedRunOptions,
    );
  });

  it('does not coerce scientific notation to numbers', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '--val=1e10'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      expect.objectContaining({ val: '1e10' }),
      expectedRunOptions,
    );
  });

  it('filters out __proto__ key to prevent prototype pollution', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '--__proto__=polluted', '--name=safe'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    const passedArgs = vi.mocked(runScript).mock.calls[0][1] as Record<string, unknown>;
    expect(passedArgs.name).toBe('safe');
    expect(Object.hasOwn(passedArgs, '__proto__')).toBe(false);
  });

  it('filters out constructor and prototype keys', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: [
        'node',
        'lauf',
        'run',
        'my-pkg/build',
        '--constructor=bad',
        '--prototype=bad',
        '--ok=fine',
      ],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    const passedArgs = vi.mocked(runScript).mock.calls[0][1] as Record<string, unknown>;
    expect(passedArgs.ok).toBe('fine');
    expect(Object.hasOwn(passedArgs, 'constructor')).toBe(false);
    expect(Object.hasOwn(passedArgs, 'prototype')).toBe(false);
  });

  it('sliceArgvAfter only searches after index 2', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    // Script name matches node binary path — should not match at index 0
    Object.defineProperty(process, 'argv', {
      value: ['my-pkg/build', 'lauf', 'run', 'my-pkg/build', '--count=5'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      expect.objectContaining({ count: 5 }),
      expectedRunOptions,
    );
  });

  it('filters out --__proto__ in key-value form', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '--__proto__', 'polluted', '--safe', 'val'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    const passedArgs = vi.mocked(runScript).mock.calls[0][1] as Record<string, unknown>;
    expect(passedArgs.safe).toBe('val');
    expect(Object.hasOwn(passedArgs, '__proto__')).toBe(false);
  });

  it('filters out --constructor as boolean flag', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build', '--constructor', '--ok'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    const passedArgs = vi.mocked(runScript).mock.calls[0][1] as Record<string, unknown>;
    expect(passedArgs.ok).toBe(true);
    expect(Object.hasOwn(passedArgs, 'constructor')).toBe(false);
  });

  it('returns empty args when script name is not found in argv', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(runScript).mockResolvedValue({ exitCode: 0, script: mockScript });

    // argv has script name that does NOT match the provided script param
    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'other-pkg/deploy', '--count=5'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    // sliceArgvAfter returns [] because 'my-pkg/build' is not in argv after index 2
    expect(runScript).toHaveBeenCalledWith(
      mockScript,
      expect.objectContaining({}),
      expectedRunOptions,
    );
    const passedArgs = vi.mocked(runScript).mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(passedArgs).length).toBe(0);
  });

  it('fails when resolveEnvValue returns error', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(findScript).mockReturnValue(mockScript);
    vi.mocked(resolveEnvValue).mockResolvedValue([new Error('env fn failed'), null]);

    Object.defineProperty(process, 'argv', {
      value: ['node', 'lauf', 'run', 'my-pkg/build'],
      writable: true,
      configurable: true,
    });

    await runHandler({ parameters: { script: 'my-pkg/build' } });

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
