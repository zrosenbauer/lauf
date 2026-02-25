import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ---

const { mockSafeParseJSON } = vi.hoisted(() => ({
  mockSafeParseJSON: vi.fn(),
}));

// Track attemptAsync calls for controlling top-level vs inner behavior
const { attemptAsyncCallIndex, mockModuleResults } = vi.hoisted(() => ({
  attemptAsyncCallIndex: { value: 0 },
  // Map from call index (2+) to the result for that import call
  mockModuleResults: {
    value: new Map<
      number,
      | { error: Error }
      | { module: { default: { description: string } } }
      | { module: null }
      | { module: { default: null } }
      | { module: { default: { description: number } } }
    >(),
  },
}));

// --- Module mocks ---

vi.mock('./utils/json.ts', () => ({
  safeParseJSON: mockSafeParseJSON,
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

    // Call 1 = top-level extractMetadata() wrapper — always run the function
    if (callNum === 1) {
      return safeAttemptAsync(fn);
    }

    // Call 2+ = dynamic imports of individual scripts
    const mockResult = mockModuleResults.value.get(callNum);
    if (mockResult) {
      if ('error' in mockResult) {
        return [mockResult.error, null];
      }
      return [null, mockResult.module as unknown as T];
    }

    // Default: import failure for unmapped calls
    return [new Error('Import failed'), null];
  }),
}));

// --- Environment and stdout management ---

const originalEnv = { ...process.env };

const runExtractor = async (
  envOverrides: Record<string, string | undefined> = {},
): Promise<void> => {
  // Reset the attemptAsync call counter before each run
  // oxlint-disable-next-line immutable-data
  attemptAsyncCallIndex.value = 0;
  process.env = { ...originalEnv, ...envOverrides };
  vi.resetModules();
  await import('./metadata-extractor.ts');
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  // Reset shared mutable state
  // oxlint-disable-next-line immutable-data
  attemptAsyncCallIndex.value = 0;
  mockModuleResults.value.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = originalEnv;
});

describe('metadata-extractor', () => {
  it('writes empty object when LAUF_SCRIPT_PATHS is missing', async () => {
    await runExtractor({ LAUF_SCRIPT_PATHS: undefined });

    expect(process.stdout.write).toHaveBeenCalledWith(JSON.stringify({}));
  });

  it('writes empty object when LAUF_SCRIPT_PATHS is invalid JSON', async () => {
    mockSafeParseJSON.mockReturnValue([new Error('parse error'), null]);

    await runExtractor({ LAUF_SCRIPT_PATHS: 'not json' });

    expect(process.stdout.write).toHaveBeenCalledWith(JSON.stringify({}));
  });

  it('writes empty object when parsed value is null', async () => {
    mockSafeParseJSON.mockReturnValue([null, null]);

    await runExtractor({ LAUF_SCRIPT_PATHS: 'null' });

    expect(process.stdout.write).toHaveBeenCalledWith(JSON.stringify({}));
  });

  it('writes empty object when parsed value is not an array', async () => {
    mockSafeParseJSON.mockReturnValue([null, { not: 'an array' }]);

    await runExtractor({ LAUF_SCRIPT_PATHS: '{"not":"an array"}' });

    expect(process.stdout.write).toHaveBeenCalledWith(JSON.stringify({}));
  });

  it('returns empty description for script outside workspace root (non-temp path)', async () => {
    mockSafeParseJSON.mockReturnValue([null, ['/outside/workspace/script.mjs']]);

    await runExtractor({
      LAUF_SCRIPT_PATHS: JSON.stringify(['/outside/workspace/script.mjs']),
      LAUF_WORKSPACE_ROOT: '/workspace',
    });

    expect(process.stdout.write).toHaveBeenCalledWith(
      JSON.stringify({ '/outside/workspace/script.mjs': '' }),
    );
  });

  it('allows temp paths (containing laufen-) outside workspace root', async () => {
    mockSafeParseJSON.mockReturnValue([null, ['/tmp/laufen-abc/script.mjs']]);
    // Call 2 = the import for this script — return valid module
    mockModuleResults.value.set(2, {
      module: { default: { description: 'Temp script desc' } },
    });

    await runExtractor({
      LAUF_SCRIPT_PATHS: JSON.stringify(['/tmp/laufen-abc/script.mjs']),
      LAUF_WORKSPACE_ROOT: '/workspace',
    });

    expect(process.stdout.write).toHaveBeenCalledWith(
      JSON.stringify({ '/tmp/laufen-abc/script.mjs': 'Temp script desc' }),
    );
  });

  it('extracts description from valid script module', async () => {
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/scripts/test.mjs']]);
    mockModuleResults.value.set(2, {
      module: { default: { description: 'A test script' } },
    });

    await runExtractor({
      LAUF_SCRIPT_PATHS: JSON.stringify(['/workspace/scripts/test.mjs']),
      LAUF_WORKSPACE_ROOT: '/workspace',
    });

    expect(process.stdout.write).toHaveBeenCalledWith(
      JSON.stringify({ '/workspace/scripts/test.mjs': 'A test script' }),
    );
  });

  it('returns empty description when import fails', async () => {
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/scripts/bad.mjs']]);
    mockModuleResults.value.set(2, { error: new Error('import failed') });

    await runExtractor({
      LAUF_SCRIPT_PATHS: JSON.stringify(['/workspace/scripts/bad.mjs']),
      LAUF_WORKSPACE_ROOT: '/workspace',
    });

    expect(process.stdout.write).toHaveBeenCalledWith(
      JSON.stringify({ '/workspace/scripts/bad.mjs': '' }),
    );
  });

  it('returns empty description when module is null', async () => {
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/scripts/null.mjs']]);
    mockModuleResults.value.set(2, { module: null } as unknown as { module: null });

    await runExtractor({
      LAUF_SCRIPT_PATHS: JSON.stringify(['/workspace/scripts/null.mjs']),
      LAUF_WORKSPACE_ROOT: '/workspace',
    });

    expect(process.stdout.write).toHaveBeenCalledWith(
      JSON.stringify({ '/workspace/scripts/null.mjs': '' }),
    );
  });

  it('returns empty description when default export is null', async () => {
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/scripts/nodef.mjs']]);
    mockModuleResults.value.set(2, {
      module: { default: null } as unknown as { default: null },
    });

    await runExtractor({
      LAUF_SCRIPT_PATHS: JSON.stringify(['/workspace/scripts/nodef.mjs']),
      LAUF_WORKSPACE_ROOT: '/workspace',
    });

    expect(process.stdout.write).toHaveBeenCalledWith(
      JSON.stringify({ '/workspace/scripts/nodef.mjs': '' }),
    );
  });

  it('returns empty description when description is not a string', async () => {
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/scripts/numdef.mjs']]);
    mockModuleResults.value.set(2, {
      module: { default: { description: 42 } } as unknown as {
        default: { description: number };
      },
    });

    await runExtractor({
      LAUF_SCRIPT_PATHS: JSON.stringify(['/workspace/scripts/numdef.mjs']),
      LAUF_WORKSPACE_ROOT: '/workspace',
    });

    expect(process.stdout.write).toHaveBeenCalledWith(
      JSON.stringify({ '/workspace/scripts/numdef.mjs': '' }),
    );
  });

  it('handles multiple scripts with mixed results', async () => {
    const paths = [
      '/workspace/scripts/good.mjs',
      '/workspace/scripts/bad.mjs',
      '/workspace/scripts/nodef.mjs',
    ];
    mockSafeParseJSON.mockReturnValue([null, paths]);
    // good.mjs -> success
    mockModuleResults.value.set(2, {
      module: { default: { description: 'Good script' } },
    });
    // bad.mjs -> import error
    mockModuleResults.value.set(3, { error: new Error('import failed') });
    // nodef.mjs -> no default
    mockModuleResults.value.set(4, {
      module: { default: null } as unknown as { default: null },
    });

    await runExtractor({
      LAUF_SCRIPT_PATHS: JSON.stringify(paths),
      LAUF_WORKSPACE_ROOT: '/workspace',
    });

    expect(process.stdout.write).toHaveBeenCalledWith(
      JSON.stringify({
        '/workspace/scripts/good.mjs': 'Good script',
        '/workspace/scripts/bad.mjs': '',
        '/workspace/scripts/nodef.mjs': '',
      }),
    );
  });

  it('writes empty object when top-level error occurs', async () => {
    // Force top-level error by making attemptAsync call #1 throw
    const { attemptAsync } = await import('es-toolkit');
    vi.mocked(attemptAsync).mockImplementation(
      async <T>(_fn: () => Promise<T>): Promise<[Error, null] | [null, T]> => {
        // oxlint-disable-next-line immutable-data
        attemptAsyncCallIndex.value += 1;
        const callNum = attemptAsyncCallIndex.value;

        // For call #1 (top-level), simulate error
        if (callNum === 1) {
          return [new Error('top-level error'), null];
        }
        return safeAttemptAsync(_fn);
      },
    );

    await runExtractor({
      LAUF_SCRIPT_PATHS: JSON.stringify(['/workspace/scripts/test.mjs']),
      LAUF_WORKSPACE_ROOT: '/workspace',
    });

    expect(process.stdout.write).toHaveBeenCalledWith(JSON.stringify({}));
  });

  it('works without LAUF_WORKSPACE_ROOT set', async () => {
    mockSafeParseJSON.mockReturnValue([null, ['/some/path/script.mjs']]);
    mockModuleResults.value.set(2, {
      module: { default: { description: 'No workspace root' } },
    });

    await runExtractor({
      LAUF_SCRIPT_PATHS: JSON.stringify(['/some/path/script.mjs']),
      LAUF_WORKSPACE_ROOT: undefined,
    });

    expect(process.stdout.write).toHaveBeenCalledWith(
      JSON.stringify({ '/some/path/script.mjs': 'No workspace root' }),
    );
  });
});
