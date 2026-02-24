import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as p from '@clack/prompts';
import { attempt } from 'es-toolkit';

import { bundleScript } from './bundler.ts';
import type { RunResult, ScriptTarget } from './types.ts';
import { safeParseError } from './utils/cli.ts';

const ENGINE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EXECUTOR_DIST_PATH = path.join(ENGINE_ROOT, 'dist', 'executor.mjs');
const EXECUTOR_SRC_PATH = path.join(ENGINE_ROOT, 'src', 'executor.ts');

export interface RunScriptOptions {
  readonly help?: boolean;
  readonly workspaceRoot: string;
  readonly cliPackageRoot: string;
  readonly spinner?: boolean;
}

/**
 * Resolve the executor entry point, preferring the built dist version
 * and falling back to the source .ts path if dist is unavailable.
 *
 * Returns undefined if neither exists.
 */
function resolveExecutorPath(): string | undefined {
  const [distErr, distExists] = attempt(() => fs.existsSync(EXECUTOR_DIST_PATH));
  if (!distErr && distExists) {
    return EXECUTOR_DIST_PATH;
  }

  const [srcErr, srcExists] = attempt(() => fs.existsSync(EXECUTOR_SRC_PATH));
  if (!srcErr && srcExists) {
    return EXECUTOR_SRC_PATH;
  }

  return undefined;
}

/**
 * Build `NODE_PATH` so scripts can resolve laufen's dependencies (zod, etc.)
 * without requiring each package to declare them explicitly.
 *
 * Includes engine's node_modules, CLI package's node_modules,
 * workspace root's node_modules, and existing NODE_PATH.
 *
 * @returns Colon-delimited `NODE_PATH` string
 */
function buildNodePath(workspaceRoot: string, cliPackageRoot: string): string {
  const paths = [
    path.join(ENGINE_ROOT, 'node_modules'),
    path.join(cliPackageRoot, 'node_modules'),
    path.join(workspaceRoot, 'node_modules'),
  ];
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
  return {};
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
  const executorPath = resolveExecutorPath();
  if (!executorPath) {
    p.log.error('Executor entry point not found. Run `pnpm build` to generate it.');
    return { exitCode: 1, script };
  }

  const [bundleError, bundle] = await bundleScript(script.path);
  if (bundleError) {
    p.log.error(`Failed to bundle script: ${safeParseError(bundleError)}`);
    return { exitCode: 1, script };
  }

  const spinnerEnabled = resolveSpinner(options);
  const helpEnv = resolveHelpEnv(options);
  const spinnerValue = resolveSpinnerEnv(spinnerEnabled);

  // oxlint-disable-next-line max-lines-per-function
  return new Promise((resolve) => {
    const child = spawn('node', [executorPath], {
      cwd: script.packageDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_PATH: buildNodePath(options.workspaceRoot, options.cliPackageRoot),
        LAUF_SCRIPT_PATH: bundle.outputPath,
        LAUF_ORIGINAL_PATH: script.path,
        LAUF_ARGS: JSON.stringify(args),
        LAUF_WORKSPACE_ROOT: options.workspaceRoot,
        LAUF_PACKAGE_DIR: script.packageDir,
        LAUF_SCRIPT_NAME: script.name,
        LAUF_SPINNER: spinnerValue,
        ...helpEnv,
      },
    });

    const signalCleanup = registerSignalForwarding(child);

    // AbortController signals settlement so only the first event
    // (close or error) resolves the promise. The second event is a no-op.
    const ac = new AbortController();

    child.once('close', (code) => {
      if (ac.signal.aborted) {
        return;
      }
      ac.abort();
      signalCleanup();
      bundle.cleanup();
      resolve({
        exitCode: code ?? 1,
        script,
      });
    });

    child.once('error', (err) => {
      if (ac.signal.aborted) {
        return;
      }
      ac.abort();
      signalCleanup();
      bundle.cleanup();
      p.log.error(`Failed to spawn script executor: ${safeParseError(err)}`);
      resolve({
        exitCode: 1,
        script,
      });
    });
  });
}
