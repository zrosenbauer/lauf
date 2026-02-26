import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ---

const { mockLogError, mockLogMessage, mockCancel } = vi.hoisted(() => ({
  mockLogError: vi.fn(),
  mockLogMessage: vi.fn(),
  mockCancel: vi.fn(),
}));

const { mockSafeParseJSON } = vi.hoisted(() => ({
  mockSafeParseJSON: vi.fn(),
}));

const { mockFormatArgErrors, mockSafeParseError } = vi.hoisted(() => ({
  mockFormatArgErrors: vi.fn((issues: unknown[]) => `formatted: ${JSON.stringify(issues)}`),
  mockSafeParseError: vi.fn(String),
}));

const { mockExtractArgMeta, mockFormatHelp } = vi.hoisted(() => ({
  mockExtractArgMeta: vi.fn(() => []),
  mockFormatHelp: vi.fn(() => 'help text'),
}));

const { mockPromptForMissingArgs } = vi.hoisted(() => ({
  mockPromptForMissingArgs: vi.fn(),
}));

const { mockCreateContext } = vi.hoisted(() => ({
  mockCreateContext: vi.fn(() => ({
    args: {},
    root: '',
    packageDir: '',
    name: '',
    logger: {},
    spinner: {},
    prompts: {},
  })),
}));

const { mockCreatePrompts } = vi.hoisted(() => ({
  mockCreatePrompts: vi.fn(() => ({})),
}));

// Track attemptAsync calls to control dynamic import and config.run behavior
const { attemptAsyncCallIndex, mockScriptConfig } = vi.hoisted(() => ({
  attemptAsyncCallIndex: { value: 0 },
  mockScriptConfig: {
    value: undefined as
      | undefined
      | {
          description: string;
          args: Record<string, unknown>;
          run: ReturnType<typeof vi.fn>;
        },
  },
}));

// --- Module mocks ---

vi.mock('@clack/prompts', () => ({
  log: {
    error: mockLogError,
    message: mockLogMessage,
  },
  cancel: mockCancel,
}));

const safeAttemptAsync = async <T>(fn: () => Promise<T>): Promise<[Error, null] | [null, T]> => {
  try {
    const result = await fn();
    return [null, result];
  } catch (e) {
    if (e instanceof Error) {
      return [e, null];
    }
    return [new Error(String(e)), null];
  }
};

vi.mock('es-toolkit', () => ({
  attemptAsync: vi.fn(async <T>(fn: () => Promise<T>): Promise<[Error, null] | [null, T]> => {
    // oxlint-disable-next-line immutable-data
    attemptAsyncCallIndex.value += 1;
    const callNum = attemptAsyncCallIndex.value;

    // Call 1 = top-level execute() wrapper — always run the function
    if (callNum === 1) {
      return safeAttemptAsync(fn);
    }

    // Call 2 = dynamic import — return mock script module if set
    if (callNum === 2) {
      if (mockScriptConfig.value !== undefined) {
        return [null, { default: mockScriptConfig.value } as unknown as T];
      }
      return [new Error('Import failed'), null];
    }

    // Call 3 = config.run — actually run the function
    if (callNum === 3) {
      return safeAttemptAsync(fn);
    }

    return [new Error('unexpected attemptAsync call'), null];
  }),
}));

vi.mock('./utils/json.ts', () => ({
  safeParseJSON: mockSafeParseJSON,
}));

vi.mock('./utils/cli.ts', () => ({
  formatArgErrors: mockFormatArgErrors,
  safeParseError: mockSafeParseError,
}));

vi.mock('./utils/help.ts', () => ({
  extractArgMeta: mockExtractArgMeta,
  formatHelp: mockFormatHelp,
}));

vi.mock('./utils/prompt-args.ts', () => ({
  promptForMissingArgs: mockPromptForMissingArgs,
}));

vi.mock('./context/index.ts', () => ({
  createContext: mockCreateContext,
}));

vi.mock('./context/prompts.ts', () => ({
  createPrompts: mockCreatePrompts,
}));

// --- Environment management ---

const originalEnv = { ...process.env };

const validEnv = {
  LAUF_SCRIPT_PATH: '/tmp/laufen-abc/script.mjs',
  LAUF_ORIGINAL_PATH: '/workspace/scripts/test.ts',
  LAUF_ARGS: '{}',
  LAUF_WORKSPACE_ROOT: '/workspace',
  LAUF_PACKAGE_DIR: '/workspace',
  LAUF_SCRIPT_NAME: 'test-script',
  LAUF_SPINNER: '1',
};

const runExecutor = async (
  envOverrides: Record<string, string | undefined> = {},
): Promise<void> => {
  // Reset the attemptAsync call counter before each run
  // oxlint-disable-next-line immutable-data
  attemptAsyncCallIndex.value = 0;
  Object.assign(process.env, validEnv, envOverrides);
  vi.resetModules();
  await import('./executor.ts');
};

beforeEach(() => {
  vi.clearAllMocks();
  // Re-create the process.exit spy before each test
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  // Restore process.env to a clean state
  process.env = { ...originalEnv };
  // Reset shared mutable state
  // oxlint-disable-next-line immutable-data
  mockScriptConfig.value = undefined;
  // oxlint-disable-next-line immutable-data
  attemptAsyncCallIndex.value = 0;
  // Default: safeParseJSON succeeds with empty object
  mockSafeParseJSON.mockReturnValue([null, {}]);
  // Default: promptForMissingArgs succeeds
  mockPromptForMissingArgs.mockResolvedValue([null, {}]);
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = originalEnv;
});

describe('executor', () => {
  describe('env validation', () => {
    it('exits with 1 when LAUF_SCRIPT_PATH is missing', async () => {
      await runExecutor({ LAUF_SCRIPT_PATH: undefined });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid executor environment'),
      );
    });

    it('exits with 1 when LAUF_WORKSPACE_ROOT is a relative path', async () => {
      await runExecutor({ LAUF_WORKSPACE_ROOT: 'relative/path' });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid executor environment'),
      );
    });

    it('exits with 1 when LAUF_SPINNER is missing', async () => {
      await runExecutor({ LAUF_SPINNER: undefined });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid executor environment'),
      );
    });

    it('exits with 1 when LAUF_HELP has an invalid value', async () => {
      await runExecutor({ LAUF_HELP: 'true' });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid executor environment'),
      );
    });
  });

  describe('LAUF_ARGS parsing', () => {
    it('exits with 1 when LAUF_ARGS contains invalid JSON', async () => {
      mockSafeParseJSON.mockReturnValue([new Error('bad json'), null]);

      await runExecutor();

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON in LAUF_ARGS'),
      );
    });
  });

  describe('path traversal', () => {
    it('exits with 1 when original path is outside workspace root', async () => {
      await runExecutor({
        LAUF_ORIGINAL_PATH: '/outside/workspace/script.ts',
        LAUF_WORKSPACE_ROOT: '/workspace',
      });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('outside the workspace root'),
      );
    });
  });

  describe('dynamic import', () => {
    it('exits with 1 when import fails', async () => {
      // mockScriptConfig.value is undefined, so attemptAsync call #2 returns error
      await runExecutor();

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('Failed to import script'));
    });

    it('exits with 1 when module has no default export', async () => {
      // Override attemptAsync to return a module without default for call #2
      const { attemptAsync } = await import('es-toolkit');
      vi.mocked(attemptAsync).mockImplementation(
        async <T>(fn: () => Promise<T>): Promise<[Error, null] | [null, T]> => {
          // oxlint-disable-next-line immutable-data
          attemptAsyncCallIndex.value += 1;
          const callNum = attemptAsyncCallIndex.value;
          if (callNum === 2) {
            return [null, { notDefault: true } as unknown as T];
          }
          return safeAttemptAsync(fn);
        },
      );

      await runExecutor();

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('does not export a valid lauf() config'),
      );
    });

    it('exits with 1 when default export has no run function', async () => {
      // oxlint-disable-next-line immutable-data
      mockScriptConfig.value = {
        description: 'test',
        args: {},
        run: 'not a function' as unknown as ReturnType<typeof vi.fn>,
      };

      await runExecutor();

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('does not export a valid lauf() config'),
      );
    });

    it('exits with 1 when args is an array instead of an object', async () => {
      const { attemptAsync } = await import('es-toolkit');
      vi.mocked(attemptAsync).mockImplementation(
        async <T>(fn: () => Promise<T>): Promise<[Error, null] | [null, T]> => {
          // oxlint-disable-next-line immutable-data
          attemptAsyncCallIndex.value += 1;
          const callNum = attemptAsyncCallIndex.value;
          if (callNum === 2) {
            return [
              null,
              {
                default: { description: 'test', args: ['not', 'valid'], run: vi.fn() },
              } as unknown as T,
            ];
          }
          return safeAttemptAsync(fn);
        },
      );

      await runExecutor();

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLogError).toHaveBeenCalledWith(
        expect.stringContaining('does not export a valid lauf() config'),
      );
    });
  });

  describe('help mode', () => {
    it('displays help and exits with 0 when LAUF_HELP is 1', async () => {
      // oxlint-disable-next-line immutable-data
      mockScriptConfig.value = {
        description: 'A test script',
        args: {},
        run: vi.fn(),
      };

      await runExecutor({ LAUF_HELP: '1' });

      expect(mockExtractArgMeta).toHaveBeenCalledWith({});
      expect(mockFormatHelp).toHaveBeenCalledWith('test-script', 'A test script', []);
      expect(mockLogMessage).toHaveBeenCalledWith('help text');
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('prompt cancellation', () => {
    it('exits with 0 when user cancels prompt', async () => {
      // oxlint-disable-next-line immutable-data
      mockScriptConfig.value = {
        description: 'test',
        args: {},
        run: vi.fn(),
      };
      mockPromptForMissingArgs.mockResolvedValue([{ cancelled: true }, null]);

      await runExecutor();

      expect(mockCancel).toHaveBeenCalledWith('Cancelled');
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('arg validation', () => {
    it('exits with 1 when arg schema parse fails', async () => {
      const { z } = await import('zod');
      // oxlint-disable-next-line immutable-data
      mockScriptConfig.value = {
        description: 'test',
        args: { name: z.string() } as unknown as Record<string, unknown>,
        run: vi.fn(),
      } as unknown as typeof mockScriptConfig.value;
      // Return an invalid value for 'name' to trigger Zod validation failure
      mockPromptForMissingArgs.mockResolvedValue([null, { name: 42 }]);

      await runExecutor();

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('arg validation failed'));
    });
  });

  describe('successful run', () => {
    it('calls config.run with created context', async () => {
      const mockRunFn = vi.fn();
      // oxlint-disable-next-line immutable-data
      mockScriptConfig.value = {
        description: 'test',
        args: {},
        run: mockRunFn,
      };
      mockPromptForMissingArgs.mockResolvedValue([null, {}]);

      await runExecutor();

      expect(mockCreateContext).toHaveBeenCalledWith(
        expect.objectContaining({
          args: {},
          root: '/workspace',
          packageDir: '/workspace',
          name: 'test-script',
          spinner: true,
        }),
      );
      expect(mockRunFn).toHaveBeenCalled();
    });
  });

  describe('run failure', () => {
    it('exits with 1 when config.run throws', async () => {
      const mockRunFn = vi.fn(() => {
        // oxlint-disable-next-line no-throw-literal
        throw new Error('run exploded');
      });
      // oxlint-disable-next-line immutable-data
      mockScriptConfig.value = {
        description: 'test',
        args: {},
        run: mockRunFn,
      };
      mockPromptForMissingArgs.mockResolvedValue([null, {}]);

      await runExecutor();

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('failed'));
    });
  });
});
