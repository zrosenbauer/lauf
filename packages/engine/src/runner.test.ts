import { EventEmitter } from 'node:events';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RunScriptOptions } from './runner.ts';
import type { ScriptTarget } from './types.ts';

const { mockSpawn, mockExistsSync, mockBundleScript, mockLogError, mockLogWarn } = vi.hoisted(
  () => ({
    mockSpawn: vi.fn(),
    mockExistsSync: vi.fn(),
    mockBundleScript: vi.fn(),
    mockLogError: vi.fn(),
    mockLogWarn: vi.fn(),
  }),
);

vi.mock('node:child_process', () => ({
  spawn: mockSpawn,
}));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
}));

vi.mock('./bundler.ts', () => ({
  bundleScript: mockBundleScript,
}));

vi.mock('@clack/prompts', () => ({
  log: {
    error: mockLogError,
    warn: mockLogWarn,
  },
}));

import { runScript } from './runner.ts';

const createMockChild = (): EventEmitter & { kill: ReturnType<typeof vi.fn> } => {
  const child = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn> };
  child.kill = vi.fn();
  return child;
};

/**
 * Flush all pending microtasks so that `await bundleScript(...)` inside
 * `runScript` resolves and `spawn` is actually called before we emit
 * events on the mock child.
 */
const flushMicrotasks = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const testScript: ScriptTarget = {
  name: 'test-script',
  path: '/workspace/scripts/test.ts',
  packageDir: '/workspace',
};

const testOptions: RunScriptOptions = {
  workspaceRoot: '/workspace',
  cliPackageRoot: '/workspace/node_modules/.pnpm/laufen',
};

const mockCleanup = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(true);
  mockBundleScript.mockResolvedValue([
    null,
    { outputPath: '/tmp/laufen-abc/script.mjs', cleanup: mockCleanup, warnings: [] },
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runScript', () => {
  describe('exit codes', () => {
    it('returns exitCode 0 when child process closes with code 0', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      const result = await resultPromise;

      expect(result.exitCode).toBe(0);
      expect(result.script).toBe(testScript);
    });

    it('returns non-zero exitCode when child process closes with non-zero code', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 2);
      const result = await resultPromise;

      expect(result.exitCode).toBe(2);
    });

    it('returns exitCode 1 when child process closes with null code', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', null);
      const result = await resultPromise;

      expect(result.exitCode).toBe(1);
    });
  });

  describe('error handling', () => {
    it('returns exitCode 1 and logs error when child process emits error', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('error', new Error('spawn ENOENT'));
      const result = await resultPromise;

      expect(result.exitCode).toBe(1);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to spawn script executor'),
      );
    });

    it('returns exitCode 1 and logs error when executor path is not found', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await runScript(testScript, {}, testOptions);

      expect(result.exitCode).toBe(1);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Executor entry point not found'),
      );
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('returns exitCode 1 and logs error when bundleScript fails', async () => {
      mockBundleScript.mockResolvedValue([new Error('bundle failed'), null]);

      const result = await runScript(testScript, {}, testOptions);

      expect(result.exitCode).toBe(1);
      expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('Failed to bundle script'));
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('environment variables', () => {
    it('passes correct environment variables to spawn', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, { verbose: true, count: 5 }, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnCall = mockSpawn.mock.calls[0];
      const spawnEnv = spawnCall[2].env;

      expect(spawnEnv.LAUF_SCRIPT_PATH).toBe('/tmp/laufen-abc/script.mjs');
      expect(spawnEnv.LAUF_ORIGINAL_PATH).toBe('/workspace/scripts/test.ts');
      expect(spawnEnv.LAUF_ARGS).toBe(JSON.stringify({ verbose: true, count: 5 }));
      expect(spawnEnv.LAUF_WORKSPACE_ROOT).toBe('/workspace');
      expect(spawnEnv.LAUF_PACKAGE_DIR).toBe('/workspace');
      expect(spawnEnv.LAUF_SCRIPT_NAME).toBe('test-script');
      expect(spawnEnv.LAUF_ENV).toBe('{}');
    });

    it('includes NODE_PATH with engine, cli, and workspace node_modules', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnCall = mockSpawn.mock.calls[0];
      const nodePath = spawnCall[2].env.NODE_PATH as string;

      expect(nodePath).toContain('node_modules');
      expect(nodePath).toContain(testOptions.cliPackageRoot);
      expect(nodePath).toContain(testOptions.workspaceRoot);
    });

    it('appends existing NODE_PATH when set', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const savedNodePath = process.env.NODE_PATH;
      // oxlint-disable-next-line immutable-data
      process.env.NODE_PATH = '/custom/node_modules';

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      expect(spawnEnv.NODE_PATH).toContain('/custom/node_modules');

      if (savedNodePath === undefined) {
        // oxlint-disable-next-line immutable-data
        delete process.env.NODE_PATH;
      } else {
        // oxlint-disable-next-line immutable-data
        process.env.NODE_PATH = savedNodePath;
      }
    });

    it('builds NODE_PATH without appending when NODE_PATH is unset', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const savedNodePath = process.env.NODE_PATH;
      // oxlint-disable-next-line immutable-data
      process.env.NODE_PATH = '';

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      const parts = (spawnEnv.NODE_PATH as string).split(path.delimiter);
      // Should only have the 3 base paths (engine, cli, workspace node_modules)
      expect(parts).toHaveLength(3);

      if (savedNodePath === undefined) {
        // oxlint-disable-next-line immutable-data
        delete process.env.NODE_PATH;
      } else {
        // oxlint-disable-next-line immutable-data
        process.env.NODE_PATH = savedNodePath;
      }
    });
  });

  describe('env and sandbox', () => {
    it('uses sandbox mode by default (does not spread full process.env)', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const savedSecret = process.env.MY_SECRET_VAR;
      // oxlint-disable-next-line immutable-data
      process.env.MY_SECRET_VAR = 'should-not-leak';

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      expect(spawnEnv.MY_SECRET_VAR).toBeUndefined();
      expect(spawnEnv.PATH).toBeDefined();

      if (savedSecret === undefined) {
        // oxlint-disable-next-line immutable-data
        delete process.env.MY_SECRET_VAR;
      } else {
        // oxlint-disable-next-line immutable-data
        process.env.MY_SECRET_VAR = savedSecret;
      }
    });

    it('spreads full process.env when sandbox is false', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const savedSecret = process.env.MY_INHERIT_VAR;
      // oxlint-disable-next-line immutable-data
      process.env.MY_INHERIT_VAR = 'should-be-inherited';

      const resultPromise = runScript(testScript, {}, { ...testOptions, sandbox: false });
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      expect(spawnEnv.MY_INHERIT_VAR).toBe('should-be-inherited');

      if (savedSecret === undefined) {
        // oxlint-disable-next-line immutable-data
        delete process.env.MY_INHERIT_VAR;
      } else {
        // oxlint-disable-next-line immutable-data
        process.env.MY_INHERIT_VAR = savedSecret;
      }
    });

    it('passes user env to spawn and serializes as LAUF_ENV', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const userEnv = { DATABASE_URL: 'postgres://localhost/db', NODE_ENV: 'production' };
      const resultPromise = runScript(testScript, {}, { ...testOptions, env: userEnv });
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      expect(spawnEnv.DATABASE_URL).toBe('postgres://localhost/db');
      expect(spawnEnv.NODE_ENV).toBe('production');
      expect(spawnEnv.LAUF_ENV).toBe(JSON.stringify(userEnv));
    });

    it('does not allow user env to override LAUF_ control vars', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const userEnv = { LAUF_SCRIPT_NAME: 'hacked' };
      const resultPromise = runScript(testScript, {}, { ...testOptions, env: userEnv });
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      expect(spawnEnv.LAUF_SCRIPT_NAME).toBe('test-script');
    });
  });

  describe('spinner', () => {
    it('sets LAUF_SPINNER to 1 when spinner is true', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, { ...testOptions, spinner: true });
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      expect(spawnEnv.LAUF_SPINNER).toBe('1');
    });

    it('sets LAUF_SPINNER to 0 when spinner is false', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, { ...testOptions, spinner: false });
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      expect(spawnEnv.LAUF_SPINNER).toBe('0');
    });

    it('defaults LAUF_SPINNER to 1 when spinner is undefined', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      expect(spawnEnv.LAUF_SPINNER).toBe('1');
    });
  });

  describe('help', () => {
    it('sets LAUF_HELP to 1 when help is true', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, { ...testOptions, help: true });
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      expect(spawnEnv.LAUF_HELP).toBe('1');
    });

    it('sets LAUF_HELP to 0 when help is falsy', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      expect(spawnEnv.LAUF_HELP).toBe('0');
    });

    it('does not allow user env to override LAUF_HELP', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const userEnv = { LAUF_HELP: '1' };
      const resultPromise = runScript(testScript, {}, { ...testOptions, env: userEnv });
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const spawnEnv = mockSpawn.mock.calls[0][2].env;
      expect(spawnEnv.LAUF_HELP).toBe('0');
    });
  });

  describe('AbortController — only first event resolves', () => {
    it('ignores error event after close has already resolved', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      const result = await resultPromise;

      // Emit a late error — the error handler's AbortController guard
      // should detect the signal is already aborted and return early.
      mockChild.emit('error', new Error('late error'));

      expect(result.exitCode).toBe(0);
      expect(mockLogError).not.toHaveBeenCalled();
    });

    it('ignores close event after error has already resolved', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('error', new Error('early error'));
      mockChild.emit('close', 0);
      const result = await resultPromise;

      expect(result.exitCode).toBe(1);
    });
  });

  describe('signal forwarding', () => {
    it('forwards SIGINT and SIGTERM to child process', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();

      // Simulate signals from the parent process
      process.emit('SIGINT', 'SIGINT');
      process.emit('SIGTERM', 'SIGTERM');

      expect(mockChild.kill).toHaveBeenCalledWith('SIGINT');
      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');

      mockChild.emit('close', 0);
      await resultPromise;
    });

    it('removes signal handlers after close', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const listenerCountBefore = process.listenerCount('SIGINT');

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      const listenerCountAfter = process.listenerCount('SIGINT');
      expect(listenerCountAfter).toBe(listenerCountBefore);
    });
  });

  describe('bundle cleanup', () => {
    it('calls bundle cleanup on successful close', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      expect(mockCleanup).toHaveBeenCalledOnce();
    });

    it('calls bundle cleanup on error', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('error', new Error('spawn failed'));
      await resultPromise;

      expect(mockCleanup).toHaveBeenCalledOnce();
    });
  });

  describe('bundle warnings', () => {
    it('logs bundle warnings via log.warn', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);
      mockBundleScript.mockResolvedValue([
        null,
        {
          outputPath: '/tmp/laufen-abc/script.mjs',
          cleanup: mockCleanup,
          warnings: ['unsupported feature X', 'deprecated API Y'],
        },
      ]);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      expect(mockLogWarn).toHaveBeenCalledWith('Bundle warning: unsupported feature X');
      expect(mockLogWarn).toHaveBeenCalledWith('Bundle warning: deprecated API Y');
    });

    it('does not log when there are no warnings', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      expect(mockLogWarn).not.toHaveBeenCalled();
    });
  });

  describe('spawn configuration', () => {
    it('spawns node with the executor path', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const resultPromise = runScript(testScript, {}, testOptions);
      await flushMicrotasks();
      mockChild.emit('close', 0);
      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.arrayContaining([expect.stringContaining('executor')]),
        expect.objectContaining({
          cwd: '/workspace',
          stdio: 'inherit',
        }),
      );
    });
  });
});
