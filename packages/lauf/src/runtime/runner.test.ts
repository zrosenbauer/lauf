import { EventEmitter } from 'node:events';
import * as path from 'node:path';

import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
}));

const { mockResolveTsx } = vi.hoisted(() => ({
  mockResolveTsx: vi.fn(),
}));

const { mockExistsSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>(() => true),
}));

vi.mock('node:child_process', () => ({
  spawn: mockSpawn,
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync,
  };
});

vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock('../lib/paths.ts', () => ({
  LAUF_ROOT: '/lauf-root',
  getWorkspaceRoot: vi.fn(() => '/workspace-root'),
  resolveTsx: mockResolveTsx,
}));

import type { DiscoveredScript } from '../lib/types.ts';
import { runScript } from './runner.ts';

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockImplementation(() => true);
  mockResolveTsx.mockReturnValue([null, '/lauf-root/node_modules/.bin/tsx']);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mockScript: DiscoveredScript = {
  name: 'my-pkg/build',
  path: '/workspace/packages/my-pkg/scripts/build.ts',
  packageDir: '/workspace/packages/my-pkg',
  packageName: 'my-pkg',
};

describe('runScript', () => {
  it('resolves with exit code 0 on successful close', async () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    const promise = runScript(mockScript, { verbose: true });
    child.emit('close', 0);

    const result = await promise;
    expect(result.exitCode).toBe(0);
    expect(result.script).toBe(mockScript);
  });

  it('resolves with non-zero exit code on failure', async () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    const promise = runScript(mockScript, {});
    child.emit('close', 1);

    const result = await promise;
    expect(result.exitCode).toBe(1);
  });

  it('resolves with exit code 1 when close code is null', async () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    const promise = runScript(mockScript, {});
    child.emit('close', null);

    const result = await promise;
    expect(result.exitCode).toBe(1);
  });

  it('resolves with exit code 1 on spawn error', async () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    const promise = runScript(mockScript, {});
    child.emit('error', new Error('spawn failed'));

    const result = await promise;
    expect(result.exitCode).toBe(1);
    expect(result.script).toBe(mockScript);
  });

  it('spawns tsx with the executor path', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {});

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringContaining('tsx'),
      expect.arrayContaining([expect.stringContaining('executor.mjs')]),
      expect.objectContaining({
        cwd: mockScript.packageDir,
        stdio: 'inherit',
      }),
    );

    child.emit('close', 0);
  });

  it('sets LAUF_SCRIPT_PATH environment variable', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {});

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.LAUF_SCRIPT_PATH).toBe(mockScript.path);

    child.emit('close', 0);
  });

  it('sets LAUF_ARGS as JSON string', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    const args = { verbose: true, name: 'test' };
    runScript(mockScript, args);

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.LAUF_ARGS).toBe(JSON.stringify(args));

    child.emit('close', 0);
  });

  it('sets LAUF_SCRIPT_NAME environment variable', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {});

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.LAUF_SCRIPT_NAME).toBe('my-pkg/build');

    child.emit('close', 0);
  });

  it('sets LAUF_PACKAGE_DIR environment variable', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {});

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.LAUF_PACKAGE_DIR).toBe(mockScript.packageDir);

    child.emit('close', 0);
  });

  it('sets LAUF_HELP when help option is true', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {}, { help: true });

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.LAUF_HELP).toBe('1');

    child.emit('close', 0);
  });

  it('does not set LAUF_HELP when help option is false', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {}, { help: false });

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.LAUF_HELP).toBeUndefined();

    child.emit('close', 0);
  });

  it('does not set LAUF_HELP when no options provided', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {});

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.LAUF_HELP).toBeUndefined();

    child.emit('close', 0);
  });

  it('sets NODE_PATH including lauf node_modules', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {});

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.NODE_PATH).toContain('/lauf-root/node_modules');

    child.emit('close', 0);
  });

  it('sets NODE_PATH including workspace node_modules', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {});

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.NODE_PATH).toContain('/workspace-root/node_modules');

    child.emit('close', 0);
  });

  it('appends existing NODE_PATH when set in environment', () => {
    const originalNodePath = process.env.NODE_PATH;
    process.env.NODE_PATH = '/existing/node_modules';

    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {});

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.NODE_PATH).toContain('/lauf-root/node_modules');
    expect(env.NODE_PATH).toContain('/workspace-root/node_modules');
    expect(env.NODE_PATH).toContain('/existing/node_modules');

    child.emit('close', 0);

    if (originalNodePath === undefined) {
      delete process.env.NODE_PATH;
    } else {
      process.env.NODE_PATH = originalNodePath;
    }
  });

  it('builds NODE_PATH without existing path when NODE_PATH is unset', () => {
    const originalNodePath = process.env.NODE_PATH;
    delete process.env.NODE_PATH;

    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {});

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.NODE_PATH).toContain('/lauf-root/node_modules');
    expect(env.NODE_PATH).toContain('/workspace-root/node_modules');
    // Should only have the two lauf paths, no trailing delimiter from existing
    const parts = env.NODE_PATH.split(path.delimiter);
    expect(parts).toHaveLength(2);

    child.emit('close', 0);

    if (originalNodePath === undefined) {
      delete process.env.NODE_PATH;
    } else {
      process.env.NODE_PATH = originalNodePath;
    }
  });

  it('sets LAUF_WORKSPACE_ROOT instead of LAUF_ROOT', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {});

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.LAUF_WORKSPACE_ROOT).toBe('/workspace-root');

    child.emit('close', 0);
  });

  it('ignores second event when close fires after error', async () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    const promise = runScript(mockScript, {});
    child.emit('error', new Error('spawn failed'));
    child.emit('close', 0);

    const result = await promise;
    // First event (error) wins — exit code 1
    expect(result.exitCode).toBe(1);
  });

  it('ignores second event when error fires after close', async () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    const promise = runScript(mockScript, {});
    child.emit('close', 0);
    child.emit('error', new Error('late error'));

    const result = await promise;
    // First event (close) wins — exit code 0
    expect(result.exitCode).toBe(0);
  });

  it('falls back to source executor path when dist does not exist', () => {
    mockExistsSync.mockImplementation((filePath: string) => !filePath.includes('dist'));

    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {});

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringContaining('tsx'),
      expect.arrayContaining([expect.stringContaining('executor.ts')]),
      expect.any(Object),
    );

    child.emit('close', 0);
  });

  it('returns exit code 1 when executor path is not found', async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await runScript(mockScript, {});

    expect(result.exitCode).toBe(1);
    expect(result.script).toBe(mockScript);
    expect(mockSpawn).not.toHaveBeenCalled();
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Executor entry point not found'),
    );
  });

  it('returns exit code 1 and logs error when tsx binary is not found', async () => {
    mockResolveTsx.mockReturnValue([
      new Error(
        'tsx binary not found at /lauf-root/node_modules/.bin/tsx. Run your package manager\'s install command (e.g. "pnpm install") to install dependencies.',
      ),
      null,
    ]);

    const result = await runScript(mockScript, {});

    expect(result.exitCode).toBe(1);
    expect(result.script).toBe(mockScript);
    expect(mockSpawn).not.toHaveBeenCalled();
    expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('tsx binary not found'));
  });

  it('registers signal forwarding handlers on the process', () => {
    const child = new EventEmitter();
    Object.assign(child, { kill: vi.fn() });
    mockSpawn.mockReturnValue(child);

    const listenerCountBefore = process.listenerCount('SIGINT');
    runScript(mockScript, {});

    expect(process.listenerCount('SIGINT')).toBe(listenerCountBefore + 1);
    expect(process.listenerCount('SIGTERM')).toBeGreaterThanOrEqual(1);

    child.emit('close', 0);
  });

  it('cleans up signal forwarding handlers after child exits', async () => {
    const child = new EventEmitter();
    Object.assign(child, { kill: vi.fn() });
    mockSpawn.mockReturnValue(child);

    const sigintBefore = process.listenerCount('SIGINT');
    const sigtermBefore = process.listenerCount('SIGTERM');

    const promise = runScript(mockScript, {});
    child.emit('close', 0);
    await promise;

    expect(process.listenerCount('SIGINT')).toBe(sigintBefore);
    expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore);
  });

  it('forwards SIGINT to child process', () => {
    const child = new EventEmitter();
    const killFn = vi.fn();
    Object.assign(child, { kill: killFn });
    mockSpawn.mockReturnValue(child);

    // Capture signal handlers registered by runScript instead of using
    // process.emit(), which would trigger vitest's own SIGINT handler
    // and crash the forked worker process.
    const onSpy = vi.spyOn(process, 'on');
    runScript(mockScript, {});

    const sigintCall = onSpy.mock.calls.find(([event]) => event === 'SIGINT');
    expect(sigintCall).toBeDefined();
    // Guard narrows after the assertion above (which throws on failure)
    if (sigintCall) {
      const handler = sigintCall[1] as () => void;
      handler();
    }

    expect(killFn).toHaveBeenCalledWith('SIGINT');

    child.emit('close', 0);
  });

  it('forwards SIGTERM to child process', () => {
    const child = new EventEmitter();
    const killFn = vi.fn();
    Object.assign(child, { kill: killFn });
    mockSpawn.mockReturnValue(child);

    const onSpy = vi.spyOn(process, 'on');
    runScript(mockScript, {});

    const sigtermCall = onSpy.mock.calls.find(([event]) => event === 'SIGTERM');
    expect(sigtermCall).toBeDefined();
    if (sigtermCall) {
      const handler = sigtermCall[1] as () => void;
      handler();
    }

    expect(killFn).toHaveBeenCalledWith('SIGTERM');

    child.emit('close', 0);
  });

  it('sets LAUF_CONFIG_DIR to provided configDir option', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {}, { configDir: '/my/config/dir' });

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.LAUF_CONFIG_DIR).toBe('/my/config/dir');

    child.emit('close', 0);
  });

  it('defaults LAUF_CONFIG_DIR to workspace root when no configDir provided', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {});

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.LAUF_CONFIG_DIR).toBe('/workspace-root');

    child.emit('close', 0);
  });

  it('sets LAUF_CONFIG_DIR when help and configDir options are provided', () => {
    const child = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    runScript(mockScript, {}, { help: true, configDir: '/my/config' });

    const env = mockSpawn.mock.calls[0][2].env;
    expect(env.LAUF_HELP).toBe('1');
    expect(env.LAUF_CONFIG_DIR).toBe('/my/config');

    child.emit('close', 0);
  });
});
