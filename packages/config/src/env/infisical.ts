// oxlint-disable-next-line security/detect-child-process
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { EnvContext, EnvFn } from '@laufen/engine';
import type { Result } from 'massaman/control';
import { attempt, attemptAsync, err, isErr, ok } from 'massaman/control';

const NOT_INSTALLED = new Error(
  'Infisical CLI not found. Install it from https://infisical.com/docs/cli/overview',
);

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

interface InfisicalEntry {
  readonly key: string;
  readonly value: string;
}

function buildArgs(config: InfisicalConfig): readonly string[] {
  const base = ['export', '--format=json', `--path=${config.path}`];
  const optional = [
    config.recursive && '--recursive',
    config.env && `--env=${config.env}`,
    config.projectId && `--projectId=${config.projectId}`,
  ].filter((arg): arg is string => typeof arg === 'string');
  return [...base, ...optional];
}

function parseInfisicalOutput(stdout: string): Result<Record<string, string>> {
  const parsed = attempt(() => JSON.parse(stdout) as readonly InfisicalEntry[]);
  if (isErr(parsed)) {
    return err(new Error(`Failed to parse Infisical output: ${parsed.error.message}`));
  }
  return ok(Object.fromEntries(parsed.value.map((entry) => [entry.key, entry.value])));
}

async function fetchSecrets(config: InfisicalConfig): Promise<Record<string, string>> {
  const execResult = await attemptAsync(() =>
    execFileAsync('infisical', [...buildArgs(config)], EXEC_OPTS),
  );
  if (isErr(execResult)) {
    throw execResult.error;
  }
  const parsed = parseInfisicalOutput(execResult.value.stdout);
  if (isErr(parsed)) {
    throw parsed.error;
  }
  return parsed.value;
}

async function checkInfisicalAvailable(): Promise<Error | null> {
  const result = await attemptAsync(() => execFileAsync('infisical', ['--version'], EXEC_OPTS));
  if (isErr(result)) {
    return NOT_INSTALLED;
  }
  return null;
}

/**
 * Load environment variables from Infisical via the CLI.
 *
 * Returns an {@link EnvFn} that fetches secrets when called. Requires
 * the `infisical` CLI to be installed and authenticated. Later configs
 * overwrite earlier ones.
 *
 * @param configs - One or more configs specifying paths and options
 */
export function infisical(...configs: readonly InfisicalConfig[]): EnvFn {
  return async (_ctx: EnvContext): Promise<Record<string, string>> => {
    const unavailable = await checkInfisicalAvailable();
    if (unavailable) {
      throw unavailable;
    }

    const results = await Promise.all(configs.map((config) => fetchSecrets(config)));
    return Object.fromEntries(results.flatMap((record) => Object.entries(record)));
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
      const result = parseInfisicalOutput(output);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ DB_HOST: 'localhost', DB_PORT: '5432' });
      }
    });

    it('returns empty record for empty array', () => {
      const result = parseInfisicalOutput('[]');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({});
      }
    });

    it('returns error for malformed JSON', () => {
      const result = parseInfisicalOutput('not json');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });
  });

  describe('infisical', () => {
    it('returns an EnvFn', () => {
      const fn = infisical({ path: '/' });
      expect(typeof fn).toBe('function');
    });
  });
}
