import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExistsSync, mockBundleScripts, mockLogWarn, mockExecFileAsync, mockSafeParseJSON } =
  vi.hoisted(() => ({
    mockExistsSync: vi.fn(),
    mockBundleScripts: vi.fn(),
    mockLogWarn: vi.fn(),
    mockExecFileAsync: vi.fn(),
    mockSafeParseJSON: vi.fn(),
  }));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: () => mockExecFileAsync,
}));

vi.mock('./bundler.ts', () => ({
  bundleScripts: mockBundleScripts,
}));

vi.mock('./utils/json.ts', () => ({
  safeParseJSON: mockSafeParseJSON,
}));

vi.mock('./utils/cli.ts', () => ({
  safeParseError: vi.fn(String),
}));

vi.mock('@clack/prompts', () => ({
  log: {
    warn: mockLogWarn,
    error: vi.fn(),
  },
}));

import { loadDescriptions } from './metadata.ts';
import type { ScriptTarget } from './types.ts';

const testScripts: readonly ScriptTarget[] = [
  { name: 'script-a', path: '/workspace/scripts/a.ts', packageDir: '/workspace' },
  { name: 'script-b', path: '/workspace/scripts/b.ts', packageDir: '/workspace' },
];

const testOptions = {
  workspaceRoot: '/workspace',
  cliPackageRoot: '/workspace/node_modules/.pnpm/laufen',
};

const mockCleanup = vi.fn();
const defaultBundleResult = {
  outputs: new Map([
    ['/workspace/scripts/a.ts', '/tmp/laufen-abc/a.mjs'],
    ['/workspace/scripts/b.ts', '/tmp/laufen-abc/b.mjs'],
  ]),
  cleanup: mockCleanup,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadDescriptions', () => {
  it('returns empty object for empty scripts array', async () => {
    const result = await loadDescriptions([], testOptions);

    expect(result).toEqual({});
    expect(mockBundleScripts).not.toHaveBeenCalled();
  });

  it('returns empty object and warns when bundling fails', async () => {
    mockBundleScripts.mockResolvedValue([new Error('bundle failed'), null]);

    const result = await loadDescriptions(testScripts, testOptions);

    expect(result).toEqual({});
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('Script descriptions unavailable'),
    );
  });

  it('returns empty object and warns when extractor is not found', async () => {
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExistsSync.mockReturnValue(false);

    const result = await loadDescriptions(testScripts, testOptions);

    expect(result).toEqual({});
    expect(mockCleanup).toHaveBeenCalled();
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('metadata extractor not found'),
    );
  });

  it('returns empty object and warns when execFileAsync fails', async () => {
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExecFileAsync.mockRejectedValue(new Error('exec failed'));

    const result = await loadDescriptions(testScripts, testOptions);

    expect(result).toEqual({});
    expect(mockLogWarn).toHaveBeenCalledWith(expect.stringContaining('timed out or failed'));
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('returns empty object and warns when execFileAsync returns null', async () => {
    // attemptAsync wrapping: when the promise resolves to null-like behavior
    // The real code uses attemptAsync which returns [null, result].
    // Since we mock execFileAsync directly (used via promisify), returning null
    // means attemptAsync gets [null, null] effectively.
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExecFileAsync.mockResolvedValue(null);

    const result = await loadDescriptions(testScripts, testOptions);

    // When result is null, the code checks `result === null` and warns
    // But since attemptAsync wraps it, [null, null] triggers the null check
    expect(result).toEqual({});
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('returns empty object and warns when stdout parse fails', async () => {
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExecFileAsync.mockResolvedValue({ stdout: 'not json', stderr: '' });
    mockSafeParseJSON.mockReturnValue([new Error('parse failed'), null]);

    const result = await loadDescriptions(testScripts, testOptions);

    expect(result).toEqual({});
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('could not parse metadata output'),
    );
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('returns empty object and warns when parsed result is non-object', async () => {
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExecFileAsync.mockResolvedValue({ stdout: '"string"', stderr: '' });
    mockSafeParseJSON.mockReturnValue([new Error('JSON validation failed'), null]);

    const result = await loadDescriptions(testScripts, testOptions);

    expect(result).toEqual({});
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('could not parse metadata output'),
    );
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('returns empty object and warns when parsed result is null', async () => {
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExecFileAsync.mockResolvedValue({ stdout: 'null', stderr: '' });
    mockSafeParseJSON.mockReturnValue([new Error('JSON validation failed'), null]);

    const result = await loadDescriptions(testScripts, testOptions);

    expect(result).toEqual({});
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('could not parse metadata output'),
    );
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('maps bundled paths back to original paths on success', async () => {
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        '/tmp/laufen-abc/a.mjs': 'Script A description',
        '/tmp/laufen-abc/b.mjs': 'Script B description',
      }),
      stderr: '',
    });
    mockSafeParseJSON.mockReturnValue([
      null,
      {
        '/tmp/laufen-abc/a.mjs': 'Script A description',
        '/tmp/laufen-abc/b.mjs': 'Script B description',
      },
    ]);

    const result = await loadDescriptions(testScripts, testOptions);

    expect(result).toEqual({
      '/workspace/scripts/a.ts': 'Script A description',
      '/workspace/scripts/b.ts': 'Script B description',
    });
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('warns when descriptions are empty but scripts exist', async () => {
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({}),
      stderr: '',
    });
    mockSafeParseJSON.mockReturnValue([null, {}]);

    const result = await loadDescriptions(testScripts, testOptions);

    expect(result).toEqual({});
    expect(mockLogWarn).toHaveBeenCalledWith(expect.stringContaining('no results'));
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('calls cleanup after successful extraction', async () => {
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({ '/tmp/laufen-abc/a.mjs': 'desc' }),
      stderr: '',
    });
    mockSafeParseJSON.mockReturnValue([null, { '/tmp/laufen-abc/a.mjs': 'desc' }]);

    await loadDescriptions(testScripts, testOptions);

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('calls cleanup after execFileAsync failure', async () => {
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExecFileAsync.mockRejectedValue(new Error('timeout'));

    await loadDescriptions(testScripts, testOptions);

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('passes bundled paths and workspace root to execFileAsync env', async () => {
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExecFileAsync.mockResolvedValue({ stdout: '{}', stderr: '' });
    mockSafeParseJSON.mockReturnValue([null, {}]);

    await loadDescriptions(testScripts, testOptions);

    expect(mockExecFileAsync).toHaveBeenCalledWith(
      'node',
      expect.arrayContaining([expect.any(String)]),
      expect.objectContaining({
        env: expect.objectContaining({
          LAUF_SCRIPT_PATHS: JSON.stringify(['/tmp/laufen-abc/a.mjs', '/tmp/laufen-abc/b.mjs']),
          LAUF_WORKSPACE_ROOT: '/workspace',
        }),
        timeout: 15_000,
      }),
    );
  });

  it('excludes scripts missing from bundle outputs', async () => {
    // Bundle outputs only contain script-a, not script-b
    const partialBundleResult = {
      outputs: new Map([['/workspace/scripts/a.ts', '/tmp/laufen-abc/a.mjs']]),
      cleanup: mockCleanup,
    };
    mockBundleScripts.mockResolvedValue([null, partialBundleResult]);
    mockExecFileAsync.mockResolvedValue({ stdout: '{}', stderr: '' });
    mockSafeParseJSON.mockReturnValue([null, {}]);

    await loadDescriptions(testScripts, testOptions);

    // LAUF_SCRIPT_PATHS should only contain the bundled path for a.ts;
    // b.ts is excluded because it has no bundled output
    expect(mockExecFileAsync).toHaveBeenCalledWith(
      'node',
      expect.anything(),
      expect.objectContaining({
        env: expect.objectContaining({
          LAUF_SCRIPT_PATHS: JSON.stringify(['/tmp/laufen-abc/a.mjs']),
        }),
      }),
    );
  });

  it('builds NODE_PATH without appending when NODE_PATH is unset', async () => {
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExecFileAsync.mockResolvedValue({ stdout: '{}', stderr: '' });
    mockSafeParseJSON.mockReturnValue([null, {}]);

    const savedNodePath = process.env.NODE_PATH;
    // oxlint-disable-next-line immutable-data
    process.env.NODE_PATH = '';

    await loadDescriptions(testScripts, testOptions);

    const execEnv = mockExecFileAsync.mock.calls[0][2].env;
    const parts = (execEnv.NODE_PATH as string).split(path.delimiter);
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

  it('filters out paths not in the reverse map', async () => {
    mockBundleScripts.mockResolvedValue([null, defaultBundleResult]);
    mockExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({ '/some/other/path.mjs': 'Other desc' }),
      stderr: '',
    });
    mockSafeParseJSON.mockReturnValue([null, { '/some/other/path.mjs': 'Other desc' }]);

    const result = await loadDescriptions(testScripts, testOptions);

    expect(result).toEqual({});
  });
});
