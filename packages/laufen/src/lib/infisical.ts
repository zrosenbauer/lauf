// oxlint-disable-next-line security/detect-child-process
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { EnvContext, EnvFn } from '@laufen/engine';
import { attemptAsync } from 'es-toolkit';

const execFileAsync = promisify(execFile);

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
  const args: string[] = ['export', '--format=json', `--path=${config.path}`];
  if (config.recursive) {
    // oxlint-disable-next-line immutable-data
    args.push('--recursive');
  }
  if (config.env) {
    // oxlint-disable-next-line immutable-data
    args.push(`--env=${config.env}`);
  }
  if (config.projectId) {
    // oxlint-disable-next-line immutable-data
    args.push(`--projectId=${config.projectId}`);
  }
  return args;
}

/**
 * Parse Infisical JSON output (`[{ key, value }]`) into a flat record.
 */
function parseInfisicalOutput(stdout: string): Record<string, string> {
  const entries = JSON.parse(stdout) as readonly { readonly key: string; readonly value: string }[];
  return Object.fromEntries(entries.map((entry) => [entry.key, entry.value]));
}

/**
 * Fetch secrets for a single Infisical config.
 */
async function fetchSecrets(config: InfisicalConfig): Promise<Record<string, string>> {
  const args = buildArgs(config);
  const { stdout } = await execFileAsync('infisical', args as string[]);
  return parseInfisicalOutput(stdout);
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
    const [versionError] = await attemptAsync(() => execFileAsync('infisical', ['--version']));
    if (versionError) {
      // oxlint-disable-next-line no-useless-promise-resolve-reject -- no-throw rule: return rejected promise instead
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
      const result = parseInfisicalOutput(output);
      expect(result).toEqual({ DB_HOST: 'localhost', DB_PORT: '5432' });
    });

    it('returns empty record for empty array', () => {
      const result = parseInfisicalOutput('[]');
      expect(result).toEqual({});
    });
  });

  describe('infisical', () => {
    it('returns an EnvFn', () => {
      const fn = infisical({ path: '/' });
      expect(typeof fn).toBe('function');
    });
  });
}
