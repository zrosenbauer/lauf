// oxlint-disable max-lines
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { attempt } from 'es-toolkit';

import { bundleScript } from './bundler.ts';
import { createLogger } from './context/logger.ts';
import { buildBaseEnv } from './env.ts';
import { extractAndPreparePackages } from './package-orchestrator.ts';
import type { Logger, RunResult, ScriptTarget } from './types.ts';

const ENGINE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EXECUTOR_DIST_PATH = path.join(ENGINE_ROOT, 'dist', 'executor.mjs');

export interface RunScriptOptions {
  readonly help?: boolean;
  readonly workspaceRoot: string;
  readonly cliPackageRoot: string;
  readonly spinner?: boolean;
  readonly logger?: Logger;
  readonly env?: Record<string, string>;
  readonly cliEnv?: Record<string, string>;
  readonly sandbox?: boolean;
  readonly workspacePackages?: Record<string, string>;
}

/**
 * Resolve the executor entry point.
 *
 * Only returns the built dist version — the executor is spawned with
 * plain `node` which cannot run TypeScript files on all Node 22.x versions.
 * Run `pnpm build` to generate the dist file.
 */
function resolveExecutorPath(): string | undefined {
  const [distErr, distExists] = attempt(() => fs.existsSync(EXECUTOR_DIST_PATH));
  if (!distErr && distExists) {
    return EXECUTOR_DIST_PATH;
  }

  return undefined;
}

/**
 * Build `NODE_PATH` so scripts can resolve laufen's dependencies (zod, etc.)
 * without requiring each package to declare them explicitly.
 *
 * Includes package cache node_modules (if provided), engine's node_modules,
 * CLI package's node_modules, workspace root's node_modules, and existing NODE_PATH.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param cliPackageRoot - Absolute path to CLI package root
 * @param packageCacheDir - Optional absolute path to package cache directory
 * @returns Colon-delimited `NODE_PATH` string
 */
function buildNodePath(
  workspaceRoot: string,
  cliPackageRoot: string,
  packageCacheDir: string | null,
): string {
  const basePaths = [
    path.join(ENGINE_ROOT, 'node_modules'),
    path.join(cliPackageRoot, 'node_modules'),
    path.join(workspaceRoot, 'node_modules'),
  ];

  const paths = (() => {
    if (packageCacheDir === null) {
      return basePaths;
    }
    return [path.join(packageCacheDir, 'node_modules'), ...basePaths];
  })();

  const existing = process.env.NODE_PATH;
  if (existing) {
    return [...paths, existing].join(path.delimiter);
  }
  return paths.join(path.delimiter);
}

/**
 * Resolve whether spinner is enabled, defaulting to true.
 */
function resolveSpinner(options: RunScriptOptions): boolean {
  if (options.spinner === undefined) {
    return true;
  }
  return options.spinner;
}

/**
 * Convert boolean spinner value to env var string.
 */
function resolveSpinnerEnv(enabled: boolean): string {
  if (enabled) {
    return '1';
  }
  return '0';
}

/**
 * Resolve help-mode environment variables from options.
 */
function resolveHelpEnv(options: RunScriptOptions): Record<string, string> {
  if (options.help) {
    return { LAUF_HELP: '1' };
  }
  return { LAUF_HELP: '0' };
}

/**
 * Flags that register Node.js module loaders / require hooks.
 * When present in `NODE_OPTIONS`, these cause external loaders (tsx, ts-node, etc.)
 * to transform the already-bundled ESM scripts, breaking top-level await.
 */
const LOADER_FLAGS: readonly string[] = [
  '--import',
  '--loader',
  '--experimental-loader',
  '--require',
];

/**
 * Strip loader-related flags from a `NODE_OPTIONS` string.
 *
 * Removes `--import`, `--loader`, `--experimental-loader`, and `--require`
 * in both `--flag value` (space-separated) and `--flag=value` (equals) forms.
 * All other options (memory limits, diagnostic flags, etc.) are preserved.
 *
 * @param nodeOptions - The raw `NODE_OPTIONS` env value (may be undefined)
 * @returns Cleaned string with loader flags removed
 */
function sanitizeNodeOptions(nodeOptions: string | undefined): string {
  if (!nodeOptions) {
    return '';
  }

  const tokens = nodeOptions.split(/\s+/).filter(Boolean);

  const { result } = tokens.reduce(
    (acc: { readonly result: readonly string[]; readonly skipNext: boolean }, token: string) => {
      if (acc.skipNext) {
        return { result: acc.result, skipNext: false };
      }

      // --flag=value form: drop the entire token
      if (LOADER_FLAGS.some((flag) => token.startsWith(`${flag}=`))) {
        return { result: acc.result, skipNext: false };
      }

      // --flag value form: drop this token and skip the next one
      if (LOADER_FLAGS.some((flag) => token === flag)) {
        return { result: acc.result, skipNext: true };
      }

      return { result: [...acc.result, token], skipNext: false };
    },
    { result: [] as readonly string[], skipNext: false },
  );

  return result.join(' ');
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe('buildNodePath', () => {
    it('includes engine, cli, and workspace node_modules', () => {
      const result = buildNodePath('/workspace', '/cli-root', null);
      expect(result).toContain(path.join(ENGINE_ROOT, 'node_modules'));
      expect(result).toContain('/cli-root/node_modules');
      expect(result).toContain('/workspace/node_modules');
    });

    it('prepends package cache node_modules when provided', () => {
      const result = buildNodePath('/workspace', '/cli-root', '/cache');
      expect(result.split(path.delimiter)[0]).toBe('/cache/node_modules');
    });

    it('excludes package cache when null', () => {
      const result = buildNodePath('/workspace', '/cli-root', null);
      expect(result).not.toContain('null');
    });

    it('appends existing NODE_PATH when set', () => {
      const saved = process.env.NODE_PATH;
      process.env.NODE_PATH = '/custom/modules';
      const result = buildNodePath('/workspace', '/cli-root', null);
      expect(result).toContain('/custom/modules');
      /* v8 ignore next 5 -- env-var restore; which branch runs depends on whether NODE_PATH was pre-set */
      if (saved === undefined) {
        delete process.env.NODE_PATH;
      } else {
        process.env.NODE_PATH = saved;
      }
    });

    it('returns only base paths when NODE_PATH is empty', () => {
      const saved = process.env.NODE_PATH;
      process.env.NODE_PATH = '';
      const result = buildNodePath('/workspace', '/cli-root', null);
      const parts = result.split(path.delimiter);
      expect(parts).toHaveLength(3);
      /* v8 ignore next 5 -- env-var restore; which branch runs depends on whether NODE_PATH was pre-set */
      if (saved === undefined) {
        delete process.env.NODE_PATH;
      } else {
        process.env.NODE_PATH = saved;
      }
    });
  });

  describe('resolveSpinner', () => {
    it('returns true when spinner is undefined', () => {
      const result = resolveSpinner({ workspaceRoot: '', cliPackageRoot: '' });
      expect(result).toBe(true);
    });

    it('returns true when spinner is true', () => {
      const result = resolveSpinner({ workspaceRoot: '', cliPackageRoot: '', spinner: true });
      expect(result).toBe(true);
    });

    it('returns false when spinner is false', () => {
      const result = resolveSpinner({ workspaceRoot: '', cliPackageRoot: '', spinner: false });
      expect(result).toBe(false);
    });
  });

  describe('resolveSpinnerEnv', () => {
    it('returns "1" for true', () => {
      expect(resolveSpinnerEnv(true)).toBe('1');
    });

    it('returns "0" for false', () => {
      expect(resolveSpinnerEnv(false)).toBe('0');
    });
  });

  describe('resolveHelpEnv', () => {
    it('returns LAUF_HELP: "1" when help is true', () => {
      const result = resolveHelpEnv({ help: true, workspaceRoot: '', cliPackageRoot: '' });
      expect(result).toEqual({ LAUF_HELP: '1' });
    });

    it('returns LAUF_HELP: "0" when help is falsy', () => {
      const result = resolveHelpEnv({ workspaceRoot: '', cliPackageRoot: '' });
      expect(result).toEqual({ LAUF_HELP: '0' });
    });
  });

  // oxlint-disable-next-line max-lines-per-function
  describe('sanitizeNodeOptions', () => {
    it('returns empty string for undefined input', () => {
      // oxlint-disable-next-line no-useless-undefined
      expect(sanitizeNodeOptions(undefined)).toBe('');
    });

    it('returns empty string for empty string input', () => {
      expect(sanitizeNodeOptions('')).toBe('');
    });

    it('strips --import with space-separated value', () => {
      expect(sanitizeNodeOptions('--import tsx/esm')).toBe('');
    });

    it('strips --import with equals form', () => {
      expect(sanitizeNodeOptions('--import=tsx/esm')).toBe('');
    });

    it('strips --require with space-separated value', () => {
      expect(sanitizeNodeOptions('--require tsx/cjs')).toBe('');
    });

    it('strips --require with equals form', () => {
      expect(sanitizeNodeOptions('--require=tsx/cjs')).toBe('');
    });

    it('strips --loader with space-separated value', () => {
      expect(sanitizeNodeOptions('--loader tsx/esm')).toBe('');
    });

    it('strips --experimental-loader with space-separated value', () => {
      expect(sanitizeNodeOptions('--experimental-loader tsx/esm')).toBe('');
    });

    it('preserves non-loader flags', () => {
      expect(sanitizeNodeOptions('--max-old-space-size=4096')).toBe('--max-old-space-size=4096');
    });

    it('handles mixed flags, preserving non-loader ones', () => {
      const input = '--max-old-space-size=4096 --import tsx/esm --inspect';
      expect(sanitizeNodeOptions(input)).toBe('--max-old-space-size=4096 --inspect');
    });

    it('strips multiple loader flags in one string', () => {
      const input = '--import tsx/esm --require tsx/cjs --loader ts-node/esm';
      expect(sanitizeNodeOptions(input)).toBe('');
    });

    it('strips multiple loader flags while preserving others', () => {
      const input = '--inspect --import tsx/esm --max-old-space-size=4096 --require=tsx/cjs';
      expect(sanitizeNodeOptions(input)).toBe('--inspect --max-old-space-size=4096');
    });
  });
}

/**
 * Register SIGINT and SIGTERM forwarding to the child process.
 * Returns a cleanup function that removes the signal handlers.
 *
 * @param child - The spawned child process
 * @returns Cleanup function to remove signal handlers
 */
function registerSignalForwarding(child: ChildProcess): () => void {
  const forwardSigint = (): void => {
    child.kill('SIGINT');
  };
  const forwardSigterm = (): void => {
    child.kill('SIGTERM');
  };

  process.on('SIGINT', forwardSigint);
  process.on('SIGTERM', forwardSigterm);

  return () => {
    process.removeListener('SIGINT', forwardSigint);
    process.removeListener('SIGTERM', forwardSigterm);
  };
}

/**
 * Execute a script by bundling it with esbuild and spawning Node
 * with the executor entry point.
 *
 * The script runs in a child process with context passed via environment
 * variables. The promise resolves when the child process exits.
 *
 * @param script - The script target to run
 * @param args - Parsed arguments to pass to the script
 * @param options - Execution options
 * @returns Promise resolving to the run result with exit code
 */
// oxlint-disable-next-line max-lines-per-function
export async function runScript(
  script: ScriptTarget,
  args: Record<string, unknown>,
  options: RunScriptOptions,
): Promise<RunResult> {
  const log = options.logger ?? createLogger();

  const executorPath = resolveExecutorPath();
  if (!executorPath) {
    log.error('Executor entry point not found. Run `pnpm build` to generate it.');
    return { exitCode: 1, script };
  }

  const workspacePackages = options.workspacePackages ?? {};
  const [packageError, packagePrep] = await extractAndPreparePackages(
    script.path,
    workspacePackages,
    options.workspaceRoot,
  );
  if (packageError) {
    log.error(`Failed to prepare packages: ${String(packageError)}`);
    return { exitCode: 1, script };
  }

  if (packagePrep === null) {
    const [bundleError, bundle] = await bundleScript(script.path);
    if (bundleError) {
      log.error(`Failed to bundle script: ${String(bundleError)}`);
      return { exitCode: 1, script };
    }

    bundle.warnings.forEach((w) => {
      log.warn(`Bundle warning: ${w}`);
    });

    return spawnScriptProcess(script, args, options, bundle, executorPath, null);
  }

  const [bundleError, bundle] = await bundleScript(script.path, {
    externals: packagePrep.packageNames,
  });
  if (bundleError) {
    log.error(`Failed to bundle script: ${String(bundleError)}`);
    return { exitCode: 1, script };
  }

  bundle.warnings.forEach((w) => {
    log.warn(`Bundle warning: ${w}`);
  });

  return spawnScriptProcess(script, args, options, bundle, executorPath, packagePrep.cacheDir);
}

/**
 * Build environment variables for script execution.
 */
function buildScriptEnv(
  script: ScriptTarget,
  args: Record<string, unknown>,
  options: RunScriptOptions,
  bundle: { readonly outputPath: string },
  packageCacheDir: string | null,
): Record<string, string> {
  const spinnerEnabled = resolveSpinner(options);
  const helpEnv = resolveHelpEnv(options);
  const spinnerValue = resolveSpinnerEnv(spinnerEnabled);
  const baseEnv = buildBaseEnv(options.sandbox ?? true);
  const userEnv = options.env ?? {};
  const cliEnv = options.cliEnv ?? {};

  return {
    ...baseEnv,
    ...userEnv,
    ...cliEnv,
    NODE_OPTIONS: sanitizeNodeOptions(process.env.NODE_OPTIONS),
    NODE_PATH: buildNodePath(options.workspaceRoot, options.cliPackageRoot, packageCacheDir),
    LAUF_SCRIPT_PATH: bundle.outputPath,
    LAUF_ORIGINAL_PATH: script.path,
    LAUF_ARGS: JSON.stringify(args),
    LAUF_WORKSPACE_ROOT: options.workspaceRoot,
    LAUF_PACKAGE_DIR: script.packageDir,
    LAUF_SCRIPT_NAME: script.name,
    LAUF_SPINNER: spinnerValue,
    LAUF_ENV: JSON.stringify(userEnv),
    LAUF_CLI_ENV: JSON.stringify(cliEnv),
    ...helpEnv,
  };
}

/**
 * Spawn the script executor process with the bundled script.
 */
function spawnScriptProcess(
  script: ScriptTarget,
  args: Record<string, unknown>,
  options: RunScriptOptions,
  bundle: { readonly outputPath: string; readonly cleanup: () => void },
  executorPath: string,
  packageCacheDir: string | null,
): Promise<RunResult> {
  const log = options.logger ?? createLogger();
  const env = buildScriptEnv(script, args, options, bundle, packageCacheDir);

  return new Promise((resolve) => {
    const child = spawn('node', [executorPath], {
      cwd: script.packageDir,
      stdio: 'inherit',
      env,
    });

    const signalCleanup = registerSignalForwarding(child);
    const ac = new AbortController();

    child.once('close', (code) => {
      if (ac.signal.aborted) {
        return;
      }
      ac.abort();
      signalCleanup();
      bundle.cleanup();
      resolve({ exitCode: code ?? 1, script });
    });

    child.once('error', (err) => {
      if (ac.signal.aborted) {
        return;
      }
      ac.abort();
      signalCleanup();
      bundle.cleanup();
      log.error(`Failed to spawn script executor: ${String(err)}`);
      resolve({ exitCode: 1, script });
    });
  });
}
