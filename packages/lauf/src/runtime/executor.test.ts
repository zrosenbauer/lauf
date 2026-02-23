/**
 * Tests for executor.ts — the child process entry point for script execution.
 *
 * This file has a top-level await that runs execute() on import.
 * We test it by manipulating process.env and mocking all dependencies
 * before each dynamic import. vi.resetModules() forces re-execution
 * of the top-level await on every test.
 *
 * process.exit is mocked as a no-op. After a mocked exit, code continues
 * running inside execute(), which may cause subsequent errors caught by the
 * top-level handler. Tests assert on the first process.exit call and the
 * matching p.log.error call to verify the correct branch was reached.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mock factories ──────────────────────────────────────────────────

const { mockLogError, mockLogMessage, mockCancel } = vi.hoisted(() => ({
  mockLogError: vi.fn(),
  mockLogMessage: vi.fn(),
  mockCancel: vi.fn(),
}));

const { mockSafeParseJSON } = vi.hoisted(() => ({
  mockSafeParseJSON: vi.fn(),
}));

const { mockSafeLoadLaufConfig } = vi.hoisted(() => ({
  mockSafeLoadLaufConfig: vi.fn(),
}));

const { mockFormatArgErrors, mockSafeParseError } = vi.hoisted(() => ({
  mockFormatArgErrors: vi.fn(
    (issues: ReadonlyArray<{ path: string[]; message: string }>) =>
      `Invalid arguments:\n${issues.map((i) => `  --${i.path.join('.')}: ${i.message}`).join('\n')}`,
  ),
  mockSafeParseError: vi.fn((err: unknown) => {
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }),
}));

const { mockPromptForMissingArgs } = vi.hoisted(() => ({
  mockPromptForMissingArgs: vi.fn(),
}));

const { mockCreateContext } = vi.hoisted(() => ({
  mockCreateContext: vi.fn(() => ({
    args: {},
    root: '/workspace',
    packageDir: '/workspace/pkg',
    name: 'test-script',
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      message: vi.fn(),
      newlines: vi.fn(),
    },
    spinner: { start: vi.fn(), stop: vi.fn(), message: vi.fn() },
    prompts: {},
  })),
}));

const { mockCreatePrompts } = vi.hoisted(() => ({
  mockCreatePrompts: vi.fn(() => ({})),
}));

const { mockAttemptAsync } = vi.hoisted(() => ({
  mockAttemptAsync: vi.fn(),
}));

const { mockExtractArgMeta, mockFormatHelp } = vi.hoisted(() => ({
  mockExtractArgMeta: vi.fn(() => []),
  mockFormatHelp: vi.fn(() => 'formatted help'),
}));

// ── Static mocks ────────────────────────────────────────────────────────────

vi.mock('@clack/prompts', () => ({
  log: {
    error: mockLogError,
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    message: mockLogMessage,
  },
  cancel: mockCancel,
}));

vi.mock('es-toolkit', () => ({
  attemptAsync: mockAttemptAsync,
}));

vi.mock('../utils/json.ts', () => ({
  safeParseJSON: mockSafeParseJSON,
}));

vi.mock('../lib/config.ts', () => ({
  safeLoadLaufConfig: mockSafeLoadLaufConfig,
}));

vi.mock('../utils/cli.ts', () => ({
  formatArgErrors: mockFormatArgErrors,
  safeParseError: mockSafeParseError,
}));

vi.mock('../utils/prompt-args.ts', () => ({
  promptForMissingArgs: mockPromptForMissingArgs,
}));

vi.mock('./context/index.ts', () => ({
  createContext: mockCreateContext,
}));

vi.mock('./context/prompts.ts', () => ({
  createPrompts: mockCreatePrompts,
}));

vi.mock('../utils/help.ts', () => ({
  extractArgMeta: mockExtractArgMeta,
  formatHelp: mockFormatHelp,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Real attemptAsync behavior: call the function and return the result
 * wrapped in a tuple, catching any errors.
 */
async function realAttemptAsync(fn: () => Promise<unknown>): Promise<[Error | null, unknown]> {
  try {
    const result = await fn();
    return [null, result];
  } catch (err) {
    if (err instanceof Error) {
      return [err, null];
    }
    return [new Error(String(err)), null];
  }
}

const VALID_ENV = {
  LAUF_SCRIPT_PATH: '/workspace/scripts/test.ts',
  LAUF_ARGS: '{}',
  LAUF_WORKSPACE_ROOT: '/workspace',
  LAUF_CONFIG_DIR: '/workspace',
  LAUF_PACKAGE_DIR: '/workspace/pkg',
  LAUF_SCRIPT_NAME: 'test-script',
};

function setValidEnv(): void {
  Object.assign(process.env, VALID_ENV);
}

function clearLaufEnv(): void {
  delete process.env.LAUF_SCRIPT_PATH;
  delete process.env.LAUF_ARGS;
  delete process.env.LAUF_WORKSPACE_ROOT;
  delete process.env.LAUF_CONFIG_DIR;
  delete process.env.LAUF_PACKAGE_DIR;
  delete process.env.LAUF_SCRIPT_NAME;
  delete process.env.LAUF_HELP;
}

const mockValidConfig = {
  default: {
    description: 'A test script',
    args: {},
    run: vi.fn(),
  },
};

// ── Setup ───────────────────────────────────────────────────────────────────

const mockProcessExit = vi.spyOn(process, 'exit');

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  clearLaufEnv();
  // process.exit is a no-op — code continues after the call
  mockProcessExit.mockImplementation((() => {}) as never);
  // Default: delegate to real attemptAsync
  mockAttemptAsync.mockImplementation(realAttemptAsync);
});

afterEach(() => {
  clearLaufEnv();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('executor', () => {
  describe('env validation', () => {
    it('exits with code 1 when LAUF_SCRIPT_PATH is missing', async () => {
      process.env.LAUF_ARGS = '{}';
      process.env.LAUF_WORKSPACE_ROOT = '/workspace';
      process.env.LAUF_CONFIG_DIR = '/workspace';
      process.env.LAUF_PACKAGE_DIR = '/workspace/pkg';
      process.env.LAUF_SCRIPT_NAME = 'test-script';

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid executor environment'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('exits with code 1 when LAUF_WORKSPACE_ROOT is a relative path', async () => {
      process.env.LAUF_SCRIPT_PATH = '/workspace/scripts/test.ts';
      process.env.LAUF_ARGS = '{}';
      process.env.LAUF_WORKSPACE_ROOT = 'relative/path';
      process.env.LAUF_CONFIG_DIR = '/workspace';
      process.env.LAUF_PACKAGE_DIR = '/workspace/pkg';
      process.env.LAUF_SCRIPT_NAME = 'test-script';

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid executor environment'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('exits with code 1 when LAUF_PACKAGE_DIR is a relative path', async () => {
      process.env.LAUF_SCRIPT_PATH = '/workspace/scripts/test.ts';
      process.env.LAUF_ARGS = '{}';
      process.env.LAUF_WORKSPACE_ROOT = '/workspace';
      process.env.LAUF_CONFIG_DIR = '/workspace';
      process.env.LAUF_PACKAGE_DIR = 'relative/pkg';
      process.env.LAUF_SCRIPT_NAME = 'test-script';

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid executor environment'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('LAUF_ARGS parsing', () => {
    it('exits with code 1 when LAUF_ARGS is invalid JSON', async () => {
      setValidEnv();
      mockSafeParseJSON.mockReturnValue([new Error('parse error'), null]);

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        'Invalid JSON in LAUF_ARGS: failed to parse arguments',
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('path traversal validation', () => {
    it('exits with code 1 when script path is outside workspace root', async () => {
      process.env.LAUF_SCRIPT_PATH = '/other-dir/scripts/evil.ts';
      process.env.LAUF_ARGS = '{}';
      process.env.LAUF_WORKSPACE_ROOT = '/workspace';
      process.env.LAUF_CONFIG_DIR = '/workspace';
      process.env.LAUF_PACKAGE_DIR = '/workspace/pkg';
      process.env.LAUF_SCRIPT_NAME = 'evil-script';
      mockSafeParseJSON.mockReturnValue([null, {}]);

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        'Script path "evil-script" is outside the workspace root',
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('exits with code 1 when script path uses traversal to escape workspace', async () => {
      process.env.LAUF_SCRIPT_PATH = '/workspace/../etc/passwd';
      process.env.LAUF_ARGS = '{}';
      process.env.LAUF_WORKSPACE_ROOT = '/workspace';
      process.env.LAUF_CONFIG_DIR = '/workspace';
      process.env.LAUF_PACKAGE_DIR = '/workspace/pkg';
      process.env.LAUF_SCRIPT_NAME = 'traversal-script';
      mockSafeParseJSON.mockReturnValue([null, {}]);

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        'Script path "traversal-script" is outside the workspace root',
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('dynamic import', () => {
    it('exits with code 1 when script import fails', async () => {
      setValidEnv();
      mockSafeParseJSON.mockReturnValue([null, {}]);

      mockAttemptAsync
        // outer: attemptAsync(execute)
        .mockImplementationOnce(realAttemptAsync)
        // script import
        .mockResolvedValueOnce([new Error('Module not found'), null]);

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to import script "test-script"'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('exits with code 1 when script import returns null', async () => {
      setValidEnv();
      mockSafeParseJSON.mockReturnValue([null, {}]);

      mockAttemptAsync
        // outer
        .mockImplementationOnce(realAttemptAsync)
        // script import returns null mod
        .mockResolvedValueOnce([null, null]);

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to import script "test-script"'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('export validation', () => {
    it('exits with code 1 when script has no default export', async () => {
      setValidEnv();
      mockSafeParseJSON.mockReturnValue([null, {}]);

      mockAttemptAsync
        // outer
        .mockImplementationOnce(realAttemptAsync)
        // no default
        .mockResolvedValueOnce([null, { default: undefined }]);

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('does not export a valid lauf() config'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('exits with code 1 when default export has no run function', async () => {
      setValidEnv();
      mockSafeParseJSON.mockReturnValue([null, {}]);

      mockAttemptAsync
        // outer
        .mockImplementationOnce(realAttemptAsync)
        .mockResolvedValueOnce([null, { default: { description: 'no run', args: {} } }]);

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('does not export a valid lauf() config'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('help mode', () => {
    it('shows help and exits with code 0 when LAUF_HELP=1', async () => {
      setValidEnv();
      process.env.LAUF_HELP = '1';
      mockSafeParseJSON.mockReturnValue([null, {}]);
      mockExtractArgMeta.mockReturnValue([]);
      mockFormatHelp.mockReturnValue('formatted help output');

      const helpModule = {
        extractArgMeta: mockExtractArgMeta,
        formatHelp: mockFormatHelp,
      };

      mockAttemptAsync
        // outer
        .mockImplementationOnce(realAttemptAsync)
        // script import
        .mockResolvedValueOnce([null, mockValidConfig])
        // help import
        .mockResolvedValueOnce([null, helpModule]);

      await import('./executor.ts');

      expect(mockLogMessage).toHaveBeenCalledWith('formatted help output');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('exits with code 1 when help module import fails', async () => {
      setValidEnv();
      process.env.LAUF_HELP = '1';
      mockSafeParseJSON.mockReturnValue([null, {}]);

      mockAttemptAsync
        // outer
        .mockImplementationOnce(realAttemptAsync)
        // script import
        .mockResolvedValueOnce([null, mockValidConfig])
        // help import fails
        .mockResolvedValueOnce([new Error('help module not found'), null]);

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load help module'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('exits with code 1 when help module import returns null', async () => {
      setValidEnv();
      process.env.LAUF_HELP = '1';
      mockSafeParseJSON.mockReturnValue([null, {}]);

      mockAttemptAsync
        // outer
        .mockImplementationOnce(realAttemptAsync)
        // script import
        .mockResolvedValueOnce([null, mockValidConfig])
        // help import returns null
        .mockResolvedValueOnce([null, null]);

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load help module'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('prompt cancellation', () => {
    it('exits with code 0 when user cancels prompt', async () => {
      setValidEnv();
      mockSafeParseJSON.mockReturnValue([null, {}]);
      mockPromptForMissingArgs.mockResolvedValue([{ cancelled: true }, null]);

      mockAttemptAsync
        // outer
        .mockImplementationOnce(realAttemptAsync)
        // script import
        .mockResolvedValueOnce([null, mockValidConfig]);

      await import('./executor.ts');

      expect(mockCancel).toHaveBeenCalledWith('Cancelled');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  describe('arg validation', () => {
    it('exits with code 1 when args fail schema validation', async () => {
      setValidEnv();
      mockSafeParseJSON.mockReturnValue([null, { name: 123 }]);
      mockPromptForMissingArgs.mockResolvedValue([null, { name: 123 }]);

      // Config with a z.string() arg: number 123 will fail validation
      const { z } = await import('zod');
      const configWithStringArg = {
        default: {
          description: 'needs a string',
          args: { name: z.string() },
          run: vi.fn(),
        },
      };

      mockAttemptAsync
        // outer
        .mockImplementationOnce(realAttemptAsync)
        // script import
        .mockResolvedValueOnce([null, configWithStringArg]);

      await import('./executor.ts');

      expect(mockFormatArgErrors).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('config loading', () => {
    it('exits with code 1 when lauf config load fails', async () => {
      setValidEnv();
      mockSafeParseJSON.mockReturnValue([null, {}]);
      mockPromptForMissingArgs.mockResolvedValue([null, {}]);
      mockSafeLoadLaufConfig.mockResolvedValue([new Error('config load failed'), null]);

      mockAttemptAsync
        // outer
        .mockImplementationOnce(realAttemptAsync)
        // script import
        .mockResolvedValueOnce([null, mockValidConfig]);

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load lauf config'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('successful execution', () => {
    it('runs the script without exiting on success', async () => {
      setValidEnv();
      mockSafeParseJSON.mockReturnValue([null, {}]);
      mockPromptForMissingArgs.mockResolvedValue([null, {}]);

      const runFn = vi.fn();
      const successConfig = {
        default: {
          description: 'success script',
          args: {},
          run: runFn,
        },
      };

      const resolvedConfig = {
        scripts: ['scripts/*.ts'],
        logger: undefined,
        spinner: true,
      };
      mockSafeLoadLaufConfig.mockResolvedValue([null, resolvedConfig]);

      mockAttemptAsync
        // outer
        .mockImplementationOnce(realAttemptAsync)
        // script import
        .mockResolvedValueOnce([null, successConfig])
        // run succeeds
        .mockResolvedValueOnce([null, undefined]);

      await import('./executor.ts');

      expect(mockCreateContext).toHaveBeenCalledWith(
        expect.objectContaining({
          root: '/workspace',
          packageDir: '/workspace/pkg',
          name: 'test-script',
          config: resolvedConfig,
        }),
      );
      // No exit call on success
      expect(mockProcessExit).not.toHaveBeenCalled();
    });
  });

  describe('script run failure', () => {
    it('exits with code 1 when script run throws', async () => {
      setValidEnv();
      mockSafeParseJSON.mockReturnValue([null, {}]);
      mockPromptForMissingArgs.mockResolvedValue([null, {}]);

      const resolvedConfig = {
        scripts: ['scripts/*.ts'],
        logger: undefined,
        spinner: true,
      };
      mockSafeLoadLaufConfig.mockResolvedValue([null, resolvedConfig]);

      mockAttemptAsync
        // outer
        .mockImplementationOnce(realAttemptAsync)
        // script import
        .mockResolvedValueOnce([null, mockValidConfig])
        // run fails
        .mockResolvedValueOnce([new Error('run exploded'), null]);

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Script "test-script" failed'),
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('top-level error handler', () => {
    it('exits with code 1 when execute() throws an unexpected error', async () => {
      setValidEnv();
      mockSafeParseJSON.mockReturnValue([null, {}]);

      // Outer attemptAsync returns an error as if execute() threw
      mockAttemptAsync.mockResolvedValueOnce([new Error('unexpected boom'), null]);

      await import('./executor.ts');

      expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('Script failed'));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
