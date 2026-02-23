import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as p from '@clack/prompts';
import { attempt } from 'es-toolkit';

import { LAUF_ROOT, getWorkspaceRoot, resolveTsx } from '../lib/paths.ts';
import type { DiscoveredScript, RunResult } from '../lib/types.ts';
import { safeParseError } from '../utils/cli.ts';

const EXECUTOR_DIST_PATH = path.join(LAUF_ROOT, 'dist', 'runtime', 'executor.mjs');
const EXECUTOR_SRC_PATH = path.join(LAUF_ROOT, 'src', 'runtime', 'executor.ts');

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
 * Execute a discovered script by spawning tsx with the executor entry point.
 *
 * The script runs in a child process with context passed via environment
 * variables. The promise resolves when the child process exits.
 *
 * NOTE: The full parent process environment is intentionally inherited by
 * child scripts so that user-authored scripts can access env vars they
 * depend on (e.g. API keys, database URLs, CI variables). Filtering the
 * environment would break legitimate use cases. The metadata extraction
 * path (in list.ts) should apply its own filtering if needed.
 *
 * @param script - The discovered script to run
 * @param args - Parsed arguments to pass to the script
 * @param options - Optional flags (help mode, config directory)
 * @returns Promise resolving to the run result with exit code
 */
interface RunScriptOptions {
  readonly help?: boolean;
  readonly configDir?: string;
}

// oxlint-disable-next-line max-lines-per-function
export function runScript(
  script: DiscoveredScript,
  args: Record<string, unknown>,
  options?: RunScriptOptions,
): Promise<RunResult> {
  const tsxResult = resolveTsx();
  if (tsxResult[0]) {
    p.log.error(tsxResult[0].message);
    return Promise.resolve({ exitCode: 1, script });
  }

  const executorPath = resolveExecutorPath();
  if (!executorPath) {
    p.log.error('Executor entry point not found. Run `pnpm build` to generate it.');
    return Promise.resolve({ exitCode: 1, script });
  }

  // TypeScript doesn't narrow tuple index [1] after checking [0]; safe cast after guard above
  const tsxPath = tsxResult[1] as string;
  const configDir = resolveConfigDir(options);
  const helpEnv = resolveHelpEnv(options);

  return new Promise((resolve) => {
    const child = spawn(tsxPath, [executorPath], {
      cwd: script.packageDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_PATH: buildNodePath(),
        LAUF_SCRIPT_PATH: script.path,
        LAUF_ARGS: JSON.stringify(args),
        LAUF_WORKSPACE_ROOT: getWorkspaceRoot(),
        LAUF_CONFIG_DIR: configDir,
        LAUF_PACKAGE_DIR: script.packageDir,
        LAUF_SCRIPT_NAME: script.name,
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
      p.log.error(`Failed to spawn script executor: ${safeParseError(err)}`);
      resolve({
        exitCode: 1,
        script,
      });
    });
  });
}

/**
 * Resolve the config directory from options, falling back to workspace root.
 */
function resolveConfigDir(options: RunScriptOptions | undefined): string {
  if (options && options.configDir) {
    return options.configDir;
  }
  return getWorkspaceRoot();
}

/**
 * Resolve help-mode environment variables from options.
 */
function resolveHelpEnv(options: RunScriptOptions | undefined): Record<string, string> {
  if (options && options.help) {
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
 * @private
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
 * Build `NODE_PATH` so scripts can resolve lauf's dependencies (zod, etc.)
 * without requiring each package to declare them explicitly.
 *
 * @returns Colon-delimited `NODE_PATH` string
 * @private
 */
function buildNodePath(): string {
  const paths = [
    path.join(LAUF_ROOT, 'node_modules'),
    path.join(getWorkspaceRoot(), 'node_modules'),
  ];
  const existing = process.env.NODE_PATH;
  if (existing) {
    return [...paths, existing].join(path.delimiter);
  }
  return paths.join(path.delimiter);
}
