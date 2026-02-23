/**
 * Tests for metadata.ts — the batch metadata extractor.
 *
 * This file has a top-level await that runs extractMetadata() on import.
 * We test it by manipulating process.env and mocking process.stdout.write
 * before each dynamic import. vi.resetModules() forces re-execution
 * of the top-level await on every test.
 *
 * We mock attemptAsync from es-toolkit to control what dynamic imports return,
 * which lets us test all branches including workspace validation, successful
 * imports, import failures, and the top-level error handler.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mock factories ──────────────────────────────────────────────────

const { mockSafeParseJSON } = vi.hoisted(() => ({
  mockSafeParseJSON: vi.fn(),
}));

const { mockAttemptAsync } = vi.hoisted(() => ({
  mockAttemptAsync: vi.fn(),
}));

// ── Static mocks ────────────────────────────────────────────────────────────

vi.mock('../utils/json.ts', () => ({
  safeParseJSON: mockSafeParseJSON,
}));

vi.mock('es-toolkit', () => ({
  attemptAsync: mockAttemptAsync,
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

function clearMetadataEnv(): void {
  delete process.env.LAUF_SCRIPT_PATHS;
  delete process.env.LAUF_WORKSPACE_ROOT;
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  clearMetadataEnv();
  // Default: delegate to real attemptAsync
  mockAttemptAsync.mockImplementation(realAttemptAsync);
});

afterEach(() => {
  vi.restoreAllMocks();
  clearMetadataEnv();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('metadata extractMetadata', () => {
  it('writes empty object when LAUF_SCRIPT_PATHS is not set', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({}));
  });

  it('writes empty object when LAUF_SCRIPT_PATHS is invalid JSON', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'not valid json';
    mockSafeParseJSON.mockReturnValue([new Error('parse error'), null]);

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({}));
  });

  it('writes empty object when safeParseJSON returns null paths', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'something';
    mockSafeParseJSON.mockReturnValue([null, null]);

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({}));
  });
});

describe('metadata isWithinWorkspace (tested via extractMetadata)', () => {
  it('skips scripts outside the workspace root', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'ignored';
    process.env.LAUF_WORKSPACE_ROOT = '/workspace';
    mockSafeParseJSON.mockReturnValue([null, ['/other-dir/scripts/evil.ts']]);

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({ '/other-dir/scripts/evil.ts': '' }));
  });

  it('skips scripts that use path traversal to escape workspace', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'ignored';
    process.env.LAUF_WORKSPACE_ROOT = '/workspace';
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/../etc/passwd']]);

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({ '/workspace/../etc/passwd': '' }));
  });

  it('allows scripts within the workspace root', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'ignored';
    process.env.LAUF_WORKSPACE_ROOT = '/workspace';
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/scripts/build.ts']]);

    // The script import will fail (file doesn't exist), resulting in empty description
    // We control this via attemptAsync mock
    mockAttemptAsync
      // outer: attemptAsync(extractMetadata)
      .mockImplementationOnce(realAttemptAsync)
      // script import fails
      .mockResolvedValueOnce([new Error('not found'), null]);

    await import('./metadata.ts');

    // Script was allowed (within workspace) but import failed -> empty description
    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({ '/workspace/scripts/build.ts': '' }));
  });

  it('allows scripts when no workspace root is set', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'ignored';
    // No LAUF_WORKSPACE_ROOT set — all scripts are allowed
    mockSafeParseJSON.mockReturnValue([null, ['/anywhere/scripts/test.ts']]);

    mockAttemptAsync
      // outer
      .mockImplementationOnce(realAttemptAsync)
      // script import fails
      .mockResolvedValueOnce([new Error('not found'), null]);

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({ '/anywhere/scripts/test.ts': '' }));
  });

  it('allows a script path that equals the workspace root exactly', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'ignored';
    process.env.LAUF_WORKSPACE_ROOT = '/workspace';
    mockSafeParseJSON.mockReturnValue([null, ['/workspace']]);

    mockAttemptAsync
      // outer
      .mockImplementationOnce(realAttemptAsync)
      // script import fails
      .mockResolvedValueOnce([new Error('not found'), null]);

    await import('./metadata.ts');

    // Script path equals root exactly -> allowed, import fails -> empty description
    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({ '/workspace': '' }));
  });

  it('rejects a path that is a prefix-match but not a child of root', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'ignored';
    process.env.LAUF_WORKSPACE_ROOT = '/work';
    // /workspace starts with /work but is NOT inside /work
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/scripts/test.ts']]);

    await import('./metadata.ts');

    // Should be skipped (not within /work/) -> empty description
    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({ '/workspace/scripts/test.ts': '' }));
  });
});

describe('metadata dynamic import results', () => {
  it('extracts description from successfully imported script', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'ignored';
    process.env.LAUF_WORKSPACE_ROOT = '/workspace';
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/scripts/build.ts']]);

    const mockModule = {
      default: {
        description: 'Build the project',
        args: {},
        run: vi.fn(),
      },
    };

    mockAttemptAsync
      // outer
      .mockImplementationOnce(realAttemptAsync)
      // script import succeeds
      .mockResolvedValueOnce([null, mockModule]);

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(
      JSON.stringify({ '/workspace/scripts/build.ts': 'Build the project' }),
    );
  });

  it('returns empty description when import fails', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'ignored';
    process.env.LAUF_WORKSPACE_ROOT = '/workspace';
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/scripts/broken.ts']]);

    mockAttemptAsync
      // outer
      .mockImplementationOnce(realAttemptAsync)
      // script import fails
      .mockResolvedValueOnce([new Error('import failed'), null]);

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({ '/workspace/scripts/broken.ts': '' }));
  });

  it('returns empty description when import returns null module', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'ignored';
    process.env.LAUF_WORKSPACE_ROOT = '/workspace';
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/scripts/null.ts']]);

    mockAttemptAsync
      // outer
      .mockImplementationOnce(realAttemptAsync)
      // script import returns null
      .mockResolvedValueOnce([null, null]);

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({ '/workspace/scripts/null.ts': '' }));
  });

  it('returns empty description when module has no default export', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'ignored';
    process.env.LAUF_WORKSPACE_ROOT = '/workspace';
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/scripts/nodefault.ts']]);

    mockAttemptAsync
      // outer
      .mockImplementationOnce(realAttemptAsync)
      // no default export
      .mockResolvedValueOnce([null, { default: undefined }]);

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(
      JSON.stringify({ '/workspace/scripts/nodefault.ts': '' }),
    );
  });

  it('returns empty description when default export has non-string description', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'ignored';
    process.env.LAUF_WORKSPACE_ROOT = '/workspace';
    mockSafeParseJSON.mockReturnValue([null, ['/workspace/scripts/badtype.ts']]);

    const mockModule = {
      default: {
        description: 42,
        args: {},
        run: vi.fn(),
      },
    };

    mockAttemptAsync
      // outer
      .mockImplementationOnce(realAttemptAsync)
      // module with non-string description
      .mockResolvedValueOnce([null, mockModule]);

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({ '/workspace/scripts/badtype.ts': '' }));
  });

  it('handles multiple scripts with mixed results', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'ignored';
    process.env.LAUF_WORKSPACE_ROOT = '/workspace';
    mockSafeParseJSON.mockReturnValue([
      null,
      ['/workspace/scripts/good.ts', '/workspace/scripts/broken.ts', '/other/scripts/outside.ts'],
    ]);

    const goodModule = {
      default: {
        description: 'Good script',
        args: {},
        run: vi.fn(),
      },
    };

    mockAttemptAsync
      // outer
      .mockImplementationOnce(realAttemptAsync)
      // first script succeeds
      .mockResolvedValueOnce([null, goodModule])
      // second script fails
      .mockResolvedValueOnce([new Error('broken'), null]);
    // third script is outside workspace, skipped (no attemptAsync call)

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(
      JSON.stringify({
        '/workspace/scripts/good.ts': 'Good script',
        '/workspace/scripts/broken.ts': '',
        '/other/scripts/outside.ts': '',
      }),
    );
  });
});

describe('metadata top-level error handler', () => {
  it('writes empty object when extractMetadata throws', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    process.env.LAUF_SCRIPT_PATHS = 'something';

    // Outer attemptAsync returns an error as if extractMetadata threw
    mockAttemptAsync.mockResolvedValueOnce([new Error('unexpected boom'), null]);

    await import('./metadata.ts');

    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({}));
  });
});
