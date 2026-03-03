import { attemptAsync } from 'es-toolkit';

import type { Result } from './result.ts';
import type { EnvContext, ScriptConfig } from './types.ts';

/**
 * Minimal set of environment variable keys preserved in sandbox mode.
 *
 * These are the minimum variables required for most scripts to function
 * correctly without inheriting the full parent environment.
 */
const MINIMAL_ENV_KEYS: readonly string[] = [
  'PATH',
  'HOME',
  'TERM',
  'SHELL',
  'USER',
  'LANG',
  'TMPDIR',
];

/**
 * Build the base environment for a child process based on the sandbox flag.
 *
 * - `sandbox: true` (default): Only includes a minimal set of standard env vars
 *   plus any existing `LAUF_*` variables. This prevents secrets and ambient
 *   variables from leaking into scripts.
 * - `sandbox: false`: Spreads the full `process.env`, matching pre-v1 behavior.
 *
 * @param sandbox - Whether to sandbox the environment
 * @returns Base environment record for the child process
 */
export function buildBaseEnv(sandbox: boolean): Record<string, string | undefined> {
  if (!sandbox) {
    return { ...process.env };
  }

  const laufEntries = Object.entries(process.env).filter(([key]) => key.startsWith('LAUF_'));
  const minimalEntries = MINIMAL_ENV_KEYS.map(
    (key) => [key, process.env[key]] as readonly [string, string | undefined],
  );

  return {
    ...Object.fromEntries(minimalEntries),
    ...Object.fromEntries(laufEntries),
  };
}

/**
 * Apply a set of environment variables to `process.env`.
 *
 * This is a controlled mutation intended for use at the system edge
 * (executor process only). Each entry is set on `process.env`.
 *
 * @param env - Key-value pairs to apply
 */
export function applyEnvToProcess(env: Record<string, string>): void {
  Object.entries(env).forEach(([key, value]) => {
    // oxlint-disable-next-line immutable-data
    process.env[key] = value;
  });
}

/**
 * Resolve a possibly-functional env value into a plain record.
 *
 * If `envValue` is a function, it is called with the provided {@link EnvContext}.
 * If it is a plain record (or undefined), it is returned as-is.
 *
 * @param envValue - The env field from a config or script
 * @param ctx - Context for function-style env resolvers
 * @returns A Result containing the resolved record
 */
export async function resolveEnvValue(
  envValue: ScriptConfig['env'],
  ctx: EnvContext,
): Promise<Result<Record<string, string>>> {
  if (envValue === undefined) {
    return [null, {}];
  }

  if (typeof envValue !== 'function') {
    return [null, envValue];
  }

  const [error, result] = await attemptAsync(() => Promise.resolve(envValue(ctx)));
  if (error) {
    if (error instanceof Error) {
      return [error, null];
    }
    return [new Error(String(error)), null];
  }

  /* v8 ignore next 3 -- TypeScript narrowing guard; attemptAsync types T | null even after error check */
  if (result === null) {
    return [new Error('Env function returned null unexpectedly'), null];
  }

  return [null, result];
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe('buildBaseEnv', () => {
    it('returns full process.env when sandbox is false', () => {
      const env = buildBaseEnv(false);
      expect(env.PATH).toBe(process.env.PATH);
      expect(env.HOME).toBe(process.env.HOME);
    });

    it('includes minimal keys when sandbox is true', () => {
      const env = buildBaseEnv(true);
      expect(env.PATH).toBe(process.env.PATH);
      expect(env.HOME).toBe(process.env.HOME);
      expect(env.TERM).toBe(process.env.TERM);
      expect(env.SHELL).toBe(process.env.SHELL);
      expect(env.USER).toBe(process.env.USER);
      expect(env.LANG).toBe(process.env.LANG);
      expect(env.TMPDIR).toBe(process.env.TMPDIR);
    });

    it('includes LAUF_ prefixed variables when sandbox is true', () => {
      const saved = process.env.LAUF_TEST_ENV_VAR;
      // oxlint-disable-next-line immutable-data
      process.env.LAUF_TEST_ENV_VAR = 'env-test-value';
      const env = buildBaseEnv(true);
      expect(env.LAUF_TEST_ENV_VAR).toBe('env-test-value');
      /* v8 ignore next 5 -- env-var restore */
      if (saved === undefined) {
        // oxlint-disable-next-line immutable-data
        delete process.env.LAUF_TEST_ENV_VAR;
      } else {
        // oxlint-disable-next-line immutable-data
        process.env.LAUF_TEST_ENV_VAR = saved;
      }
    });

    it('does not include arbitrary env variables when sandbox is true', () => {
      const saved = process.env.SOME_SECRET_ENV_VAR;
      // oxlint-disable-next-line immutable-data
      process.env.SOME_SECRET_ENV_VAR = 'secret';
      const env = buildBaseEnv(true);
      expect(env.SOME_SECRET_ENV_VAR).toBeUndefined();
      /* v8 ignore next 5 -- env-var restore */
      if (saved === undefined) {
        // oxlint-disable-next-line immutable-data
        delete process.env.SOME_SECRET_ENV_VAR;
      } else {
        // oxlint-disable-next-line immutable-data
        process.env.SOME_SECRET_ENV_VAR = saved;
      }
    });
  });

  describe('applyEnvToProcess', () => {
    it('sets entries on process.env', () => {
      const saved = process.env.APPLY_ENV_TEST;
      applyEnvToProcess({ APPLY_ENV_TEST: 'hello' });
      expect(process.env.APPLY_ENV_TEST).toBe('hello');
      /* v8 ignore next 5 -- env-var restore */
      if (saved === undefined) {
        // oxlint-disable-next-line immutable-data
        delete process.env.APPLY_ENV_TEST;
      } else {
        // oxlint-disable-next-line immutable-data
        process.env.APPLY_ENV_TEST = saved;
      }
    });
  });

  describe('resolveEnvValue', () => {
    const ctx: EnvContext = {
      script: { name: 'test', path: '/test.ts', packageDir: '/pkg' },
      workspace: '/workspace',
    };

    // oxlint-disable consistent-function-scoping -- test helpers intentionally defined inline
    const syncEnvFn = (c: EnvContext): Record<string, string> => ({
      NAME: c.script.name,
    });
    const asyncEnvFn = (c: EnvContext): Promise<Record<string, string>> =>
      Promise.resolve({ NAME: c.script.name });
    const throwingEnvFn = (): Record<string, string> => {
      // oxlint-disable-next-line no-throw-literal
      throw new Error('env fn failed');
    };
    // oxlint-enable consistent-function-scoping

    it('returns empty record for undefined', async () => {
      const [error, result] = await resolveEnvValue(undefined, ctx);
      expect(error).toBeNull();
      expect(result).toEqual({});
    });

    it('returns static record as-is', async () => {
      const env = { FOO: 'bar' };
      const [error, result] = await resolveEnvValue(env, ctx);
      expect(error).toBeNull();
      expect(result).toEqual({ FOO: 'bar' });
    });

    it('calls sync function with context', async () => {
      const [error, result] = await resolveEnvValue(syncEnvFn, ctx);
      expect(error).toBeNull();
      expect(result).toEqual({ NAME: 'test' });
    });

    it('calls async function with context', async () => {
      const [error, result] = await resolveEnvValue(asyncEnvFn, ctx);
      expect(error).toBeNull();
      expect(result).toEqual({ NAME: 'test' });
    });

    it('returns error when function throws', async () => {
      const [error, result] = await resolveEnvValue(throwingEnvFn, ctx);
      expect(error).toBeInstanceOf(Error);
      expect(result).toBeNull();
    });
  });
}
