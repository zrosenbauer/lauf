/**
 * Minimal set of environment variable keys preserved in isolated mode.
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
 * Build the base environment for a child process based on the given mode.
 *
 * - `'isolate'` (default): Only includes a minimal set of standard env vars
 *   plus any existing `LAUF_*` variables. This prevents secrets and ambient
 *   variables from leaking into scripts.
 * - `'inherit'`: Spreads the full `process.env`, matching pre-v1 behavior.
 *
 * @param mode - Environment mode: `'isolate'` or `'inherit'`
 * @returns Base environment record for the child process
 */
export function buildBaseEnv(mode: 'isolate' | 'inherit'): Record<string, string | undefined> {
  if (mode === 'inherit') {
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

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe('buildBaseEnv', () => {
    it('returns full process.env in inherit mode', () => {
      const env = buildBaseEnv('inherit');
      expect(env.PATH).toBe(process.env.PATH);
      expect(env.HOME).toBe(process.env.HOME);
    });

    it('includes minimal keys in isolate mode', () => {
      const env = buildBaseEnv('isolate');
      expect(env.PATH).toBe(process.env.PATH);
      expect(env.HOME).toBe(process.env.HOME);
      expect(env.TERM).toBe(process.env.TERM);
      expect(env.SHELL).toBe(process.env.SHELL);
      expect(env.USER).toBe(process.env.USER);
      expect(env.LANG).toBe(process.env.LANG);
      expect(env.TMPDIR).toBe(process.env.TMPDIR);
    });

    it('includes LAUF_ prefixed variables in isolate mode', () => {
      const saved = process.env.LAUF_TEST_ENV_VAR;
      // oxlint-disable-next-line immutable-data
      process.env.LAUF_TEST_ENV_VAR = 'env-test-value';
      const env = buildBaseEnv('isolate');
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

    it('does not include arbitrary env variables in isolate mode', () => {
      const saved = process.env.SOME_SECRET_ENV_VAR;
      // oxlint-disable-next-line immutable-data
      process.env.SOME_SECRET_ENV_VAR = 'secret';
      const env = buildBaseEnv('isolate');
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
}
