// oxlint-disable-next-line security/detect-child-process
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { EnvContext, EnvFn } from '@laufen/engine';
import { attempt, attemptAsync } from 'es-toolkit';

const execFileAsync = promisify(execFile);
const EXEC_TIMEOUT_MS = 15_000;
const EXEC_OPTS = { timeout: EXEC_TIMEOUT_MS, maxBuffer: 1024 * 1024 } as const;

/**
 * Configuration for a single Infisical secret path.
 */
export interface InfisicalConfig {
  readonly path: string;
  readonly recursive?: boolean;
  readonly env?: string;
  readonly projectId?: string;
}

/**
 * Build CLI arguments for a single Infisical export invocation.
 */
function buildArgs(config: InfisicalConfig): readonly string[] {
  const base = ['export', '--format=json', `--path=${config.path}`];
  const optional = [
    config.recursive && '--recursive',
    config.env && `--env=${config.env}`,
    config.projectId && `--projectId=${config.projectId}`,
  ].filter((arg): arg is string => typeof arg === 'string');
  return [...base, ...optional];
}

/**
 * Parse Infisical JSON output (`[{ key, value }]`) into a flat record.
 *
 * Returns `[null, record]` on success or `[Error, null]` on parse failure.
 */
function parseInfisicalOutput(
  stdout: string,
): readonly [Error, null] | readonly [null, Record<string, string>] {
  const [parseError, entries] = attempt<
    readonly { readonly key: string; readonly value: string }[],
    Error
  >(() => JSON.parse(stdout) as readonly { readonly key: string; readonly value: string }[]);
  if (parseError) {
    return [new Error(`Failed to parse Infisical output: ${parseError.message}`), null];
  }
  if (entries === null) {
    return [new Error('Failed to parse Infisical output: unexpected null'), null];
  }
  return [null, Object.fromEntries(entries.map((entry) => [entry.key, entry.value]))];
}

/**
 * Fetch secrets for a single Infisical config.
 */
async function fetchSecrets(config: InfisicalConfig): Promise<Record<string, string>> {
  const args = buildArgs(config);
  const { stdout } = await execFileAsync('infisical', args as string[], EXEC_OPTS);
  const [parseError, result] = parseInfisicalOutput(stdout);
  if (parseError) {
    // oxlint-disable-next-line no-useless-promise-resolve-reject -- no-throw rule
    return Promise.reject(parseError);
  }
  return result;
}

/**
 * Load environment variables from Infisical using the Infisical CLI.
 *
 * Returns an {@link EnvFn} that, when called, fetches secrets from Infisical.
 * Requires the `infisical` CLI to be installed and authenticated.
 * When multiple configs are provided, later configs overwrite earlier ones.
 *
 * @param configs - One or more configs specifying paths and options
 * @returns An EnvFn that resolves the fetched secrets
 */
export function infisical(...configs: readonly InfisicalConfig[]): EnvFn {
  return async (_ctx: EnvContext): Promise<Record<string, string>> => {
    const [versionError] = await attemptAsync(() =>
      execFileAsync('infisical', ['--version'], EXEC_OPTS),
    );
    if (versionError) {
      // oxlint-disable-next-line no-useless-promise-resolve-reject -- no-throw rule
      return Promise.reject(
        new Error(
          'Infisical CLI not found. Install it from https://infisical.com/docs/cli/overview',
        ),
      );
    }

    const results = await Promise.all(configs.map((config) => fetchSecrets(config)));
    return Object.assign({}, ...results) as Record<string, string>;
  };
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe('buildArgs', () => {
    it('builds minimal args with path only', () => {
      const args = buildArgs({ path: '/secrets' });
      expect(args).toEqual(['export', '--format=json', '--path=/secrets']);
    });

    it('includes recursive flag', () => {
      const args = buildArgs({ path: '/', recursive: true });
      expect(args).toContain('--recursive');
    });

    it('includes env flag', () => {
      const args = buildArgs({ path: '/', env: 'dev' });
      expect(args).toContain('--env=dev');
    });

    it('includes projectId flag', () => {
      const args = buildArgs({ path: '/', projectId: 'abc123' });
      expect(args).toContain('--projectId=abc123');
    });

    it('includes all flags when all options provided', () => {
      const args = buildArgs({ path: '/app', recursive: true, env: 'staging', projectId: 'xyz' });
      expect(args).toEqual([
        'export',
        '--format=json',
        '--path=/app',
        '--recursive',
        '--env=staging',
        '--projectId=xyz',
      ]);
    });
  });

  describe('parseInfisicalOutput', () => {
    it('parses key-value array into record', () => {
      const output = JSON.stringify([
        { key: 'DB_HOST', value: 'localhost' },
        { key: 'DB_PORT', value: '5432' },
      ]);
      const [error, result] = parseInfisicalOutput(output);
      expect(error).toBeNull();
      expect(result).toEqual({ DB_HOST: 'localhost', DB_PORT: '5432' });
    });

    it('returns empty record for empty array', () => {
      const [error, result] = parseInfisicalOutput('[]');
      expect(error).toBeNull();
      expect(result).toEqual({});
    });

    it('returns error for malformed JSON', () => {
      const [error, result] = parseInfisicalOutput('not json');
      expect(error).toBeInstanceOf(Error);
      expect(result).toBeNull();
    });
  });

  describe('infisical', () => {
    it('returns an EnvFn', () => {
      const fn = infisical({ path: '/' });
      expect(typeof fn).toBe('function');
    });
  });
}
