import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBuild, mockMkdtempSync, mockRmSync, mockTmpdir } = vi.hoisted(() => ({
  mockBuild: vi.fn(),
  mockMkdtempSync: vi.fn(),
  mockRmSync: vi.fn(),
  mockTmpdir: vi.fn(),
}));

vi.mock('esbuild', () => ({
  build: mockBuild,
}));

vi.mock('node:fs', () => ({
  mkdtempSync: mockMkdtempSync,
  rmSync: mockRmSync,
}));

vi.mock('node:os', () => ({
  tmpdir: mockTmpdir,
}));

import { bundleScript, bundleScripts } from './bundler.ts';

beforeEach(() => {
  vi.clearAllMocks();
  mockTmpdir.mockReturnValue('/tmp');
  mockMkdtempSync.mockReturnValue('/tmp/laufen-abc123');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('bundleScript', () => {
  it('returns success result with outputPath and cleanup on successful build', async () => {
    mockBuild.mockResolvedValue({});

    const result = await bundleScript('/workspace/scripts/test.ts');

    expect(result[0]).toBeNull();
    expect(result[1]).not.toBeNull();
    if (result[1] === null) {
      return;
    }
    expect(result[1].outputPath).toBe('/tmp/laufen-abc123/script.mjs');
    expect(typeof result[1].cleanup).toBe('function');
  });

  it('passes entryPoints and default options to esbuild.build', async () => {
    mockBuild.mockResolvedValue({});

    await bundleScript('/workspace/scripts/test.ts');

    expect(mockBuild).toHaveBeenCalledWith({
      entryPoints: ['/workspace/scripts/test.ts'],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node22',
      external: [],
      outfile: '/tmp/laufen-abc123/script.mjs',
      sourcemap: 'inline',
      logLevel: 'silent',
    });
  });

  it('passes externals to esbuild.build when provided', async () => {
    mockBuild.mockResolvedValue({});

    await bundleScript('/workspace/scripts/test.ts', { externals: ['react', 'zod'] });

    expect(mockBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        external: ['react', 'zod'],
      }),
    );
  });

  it('returns error when mkdtempSync fails', async () => {
    mockMkdtempSync.mockImplementation(() => {
      // oxlint-disable-next-line no-throw-literal
      throw new Error('ENOSPC: no space left on device');
    });

    const result = await bundleScript('/workspace/scripts/test.ts');

    expect(result[0]).toBeInstanceOf(Error);
    if (result[0] === null) {
      return;
    }
    expect(result[0].message).toContain('Failed to create temp directory');
    expect(result[1]).toBeNull();
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it('returns error and cleans up temp dir when esbuild.build fails with Error', async () => {
    mockBuild.mockRejectedValue(new Error('build failed'));

    const result = await bundleScript('/workspace/scripts/test.ts');

    expect(result[0]).toBeInstanceOf(Error);
    if (result[0] === null) {
      return;
    }
    expect(result[0].message).toBe('Failed to bundle script: build failed');
    expect(result[1]).toBeNull();
    expect(mockRmSync).toHaveBeenCalledWith('/tmp/laufen-abc123', {
      recursive: true,
      force: true,
    });
  });

  it('returns error with String(error) when esbuild.build fails with non-Error', async () => {
    mockBuild.mockRejectedValue('string error value');

    const result = await bundleScript('/workspace/scripts/test.ts');

    expect(result[0]).toBeInstanceOf(Error);
    if (result[0] === null) {
      return;
    }
    expect(result[0].message).toBe('Failed to bundle script: string error value');
    expect(result[1]).toBeNull();
    expect(mockRmSync).toHaveBeenCalledWith('/tmp/laufen-abc123', {
      recursive: true,
      force: true,
    });
  });

  it('cleanup function calls rmSync on the temp directory', async () => {
    mockBuild.mockResolvedValue({});

    const result = await bundleScript('/workspace/scripts/test.ts');

    expect(result[1]).not.toBeNull();
    // rmSync should not have been called yet (no failure)
    expect(mockRmSync).not.toHaveBeenCalled();

    if (result[1] === null) {
      return;
    }
    result[1].cleanup();

    expect(mockRmSync).toHaveBeenCalledWith('/tmp/laufen-abc123', {
      recursive: true,
      force: true,
    });
  });
});

describe('bundleScripts', () => {
  it('returns map of original paths to bundled paths on success', async () => {
    // Each call to bundleScript creates a unique temp dir
    mockMkdtempSync.mockReturnValueOnce('/tmp/laufen-aaa').mockReturnValueOnce('/tmp/laufen-bbb');
    mockBuild.mockResolvedValue({});

    const result = await bundleScripts(['/workspace/a.ts', '/workspace/b.ts']);

    expect(result[0]).toBeNull();
    expect(result[1]).not.toBeNull();
    if (result[1] === null) {
      return;
    }
    expect(result[1].outputs.get('/workspace/a.ts')).toBe('/tmp/laufen-aaa/script.mjs');
    expect(result[1].outputs.get('/workspace/b.ts')).toBe('/tmp/laufen-bbb/script.mjs');
    expect(result[1].outputs.size).toBe(2);
  });

  it('returns error and cleans up successful bundles when one fails', async () => {
    mockMkdtempSync.mockReturnValueOnce('/tmp/laufen-aaa').mockReturnValueOnce('/tmp/laufen-bbb');
    mockBuild.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('build failed'));

    const result = await bundleScripts(['/workspace/a.ts', '/workspace/b.ts']);

    expect(result[0]).toBeInstanceOf(Error);
    expect(result[1]).toBeNull();
    // The successful bundle (aaa) should have its cleanup called,
    // and the failed bundle (bbb) should have been cleaned via rmSync in bundleScript itself
    expect(mockRmSync).toHaveBeenCalled();
  });

  it('returns empty map for empty input array', async () => {
    const result = await bundleScripts([]);

    expect(result[0]).toBeNull();
    expect(result[1]).not.toBeNull();
    if (result[1] === null) {
      return;
    }
    expect(result[1].outputs.size).toBe(0);
  });

  it('cleanup function calls all individual cleanups', async () => {
    mockMkdtempSync.mockReturnValueOnce('/tmp/laufen-aaa').mockReturnValueOnce('/tmp/laufen-bbb');
    mockBuild.mockResolvedValue({});

    const result = await bundleScripts(['/workspace/a.ts', '/workspace/b.ts']);

    expect(result[1]).not.toBeNull();
    expect(mockRmSync).not.toHaveBeenCalled();

    if (result[1] === null) {
      return;
    }
    result[1].cleanup();

    expect(mockRmSync).toHaveBeenCalledTimes(2);
    expect(mockRmSync).toHaveBeenCalledWith('/tmp/laufen-aaa', {
      recursive: true,
      force: true,
    });
    expect(mockRmSync).toHaveBeenCalledWith('/tmp/laufen-bbb', {
      recursive: true,
      force: true,
    });
  });
});
