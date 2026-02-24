import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { attempt, attemptAsync } from 'es-toolkit';
import * as esbuild from 'esbuild';

import type { Result } from './result.ts';

export interface BundleResult {
  readonly outputPath: string;
  readonly cleanup: () => void;
}

/**
 * Bundle a single TypeScript script into a self-contained `.mjs` file.
 *
 * Uses esbuild with `bundle: true`, `format: 'esm'`, and `platform: 'node'`.
 * All dependencies (including `laufen` and `zod`) are bundled into the output
 * so the script is fully self-contained and works from any directory without
 * relying on NODE_PATH for ESM resolution.
 *
 * @param scriptPath - Absolute path to the TypeScript script
 * @param options - Optional externals to mark as external
 * @returns A Result containing the output path and a cleanup function, or an Error
 */
export async function bundleScript(
  scriptPath: string,
  options?: { readonly externals?: readonly string[] },
): Promise<Result<BundleResult>> {
  const [mkdirError, tmpDir] = attempt(() => fs.mkdtempSync(path.join(os.tmpdir(), 'laufen-')));
  if (mkdirError) {
    return [new Error(`Failed to create temp directory: ${String(mkdirError)}`), null];
  }

  const resolvedTmpDir = tmpDir as string;
  const outputPath = path.join(resolvedTmpDir, 'script.mjs');
  const externals = [...((options && options.externals) || [])];

  const [buildError] = await attemptAsync(() =>
    esbuild.build({
      entryPoints: [scriptPath],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node22',
      external: externals,
      outfile: outputPath,
      sourcemap: 'inline',
      logLevel: 'silent',
    }),
  );

  if (buildError) {
    // Clean up temp dir on failure
    attempt(() => fs.rmSync(resolvedTmpDir, { recursive: true, force: true }));
    if (buildError instanceof Error) {
      return [new Error(`Failed to bundle script: ${buildError.message}`), null];
    }
    return [new Error(`Failed to bundle script: ${String(buildError)}`), null];
  }

  const cleanup = (): void => {
    attempt(() => fs.rmSync(resolvedTmpDir, { recursive: true, force: true }));
  };

  return [null, { outputPath, cleanup }];
}

/**
 * Bundle multiple TypeScript scripts in parallel for batch metadata extraction.
 *
 * Each script is bundled into its own temp directory. Returns a mapping
 * from original script path to bundled output path, plus a single cleanup
 * function that removes all temp directories.
 *
 * @param scriptPaths - Array of absolute paths to TypeScript scripts
 * @returns A Result containing a map of original → bundled paths and a cleanup function
 */
export async function bundleScripts(
  scriptPaths: readonly string[],
): Promise<
  Result<{ readonly outputs: ReadonlyMap<string, string>; readonly cleanup: () => void }>
> {
  const results = await Promise.all(
    scriptPaths.map(async (scriptPath) => {
      const result = await bundleScript(scriptPath);
      return { scriptPath, result };
    }),
  );

  const cleanups: Array<() => void> = [];
  const outputMap = new Map<string, string>();

  const firstError = results.find((r) => r.result[0] !== null);
  if (firstError) {
    // Clean up any successful bundles
    results
      .filter((r) => r.result[0] === null)
      .forEach((r) => {
        const bundle = r.result[1] as BundleResult;
        bundle.cleanup();
      });
    return [firstError.result[0] as Error, null];
  }

  results.forEach((r) => {
    const bundle = r.result[1] as BundleResult;
    // oxlint-disable-next-line immutable-data -- building output map
    outputMap.set(r.scriptPath, bundle.outputPath);
    // oxlint-disable-next-line immutable-data -- collecting cleanups
    cleanups.push(bundle.cleanup);
  });

  const cleanup = (): void => {
    cleanups.forEach((fn) => {
      fn();
    });
  };

  return [null, { outputs: outputMap, cleanup }];
}
