/**
 * Pre-process argv to detect `run <script> --help/-h` and strip the help flag
 * so Clerc's global helpPlugin does not intercept it.
 */

interface HelpRewriteResult {
  readonly argv: readonly string[];
  readonly scriptHelpRequested: boolean;
}

/**
 * Detect `run <script> ... --help/-h` patterns and strip the help flag.
 *
 * When matched, the returned argv has `--help`/`-h` removed and
 * `scriptHelpRequested` is set to `true` so the run handler can show
 * script-level help instead.
 *
 * @param argv - Argv slice after the binary (i.e. `process.argv.slice(2)`)
 * @returns Rewritten argv and whether script help was requested
 */
export function rewriteHelpArgv(argv: readonly string[]): HelpRewriteResult {
  if (argv[0] !== 'run') {
    return { argv, scriptHelpRequested: false };
  }

  const script = argv[1];
  if (script === undefined || script.startsWith('-')) {
    return { argv, scriptHelpRequested: false };
  }

  const passthroughIndex = argv.indexOf('--');

  let cliArgv: readonly string[];
  let passthroughArgv: readonly string[];
  if (passthroughIndex === -1) {
    cliArgv = argv;
    passthroughArgv = [];
  } else {
    cliArgv = argv.slice(0, passthroughIndex);
    passthroughArgv = argv.slice(passthroughIndex);
  }

  const hasHelpFlag = cliArgv.some((arg) => arg === '--help' || arg === '-h');
  if (!hasHelpFlag) {
    return { argv, scriptHelpRequested: false };
  }

  const filteredCliArgv = cliArgv.filter((arg) => arg !== '--help' && arg !== '-h');
  return { argv: [...filteredCliArgv, ...passthroughArgv], scriptHelpRequested: true };
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe('rewriteHelpArgv — passthrough', () => {
    it('passes through non-run commands unchanged', () => {
      const result = rewriteHelpArgv(['list', '--help']);
      expect(result).toEqual({ argv: ['list', '--help'], scriptHelpRequested: false });
    });

    it('passes through run without a script unchanged', () => {
      const result = rewriteHelpArgv(['run', '--help']);
      expect(result).toEqual({ argv: ['run', '--help'], scriptHelpRequested: false });
    });

    it('passes through run with a script but no help flag', () => {
      const result = rewriteHelpArgv(['run', 'clean', '--verbose']);
      expect(result).toEqual({ argv: ['run', 'clean', '--verbose'], scriptHelpRequested: false });
    });

    it('handles empty argv', () => {
      const result = rewriteHelpArgv([]);
      expect(result).toEqual({ argv: [], scriptHelpRequested: false });
    });

    it('treats flag-like second arg as not a script', () => {
      const result = rewriteHelpArgv(['run', '-h']);
      expect(result).toEqual({ argv: ['run', '-h'], scriptHelpRequested: false });
    });
  });

  describe('rewriteHelpArgv — rewriting', () => {
    it('strips --help when run <script> --help is detected', () => {
      const result = rewriteHelpArgv(['run', 'clean', '--help']);
      expect(result).toEqual({ argv: ['run', 'clean'], scriptHelpRequested: true });
    });

    it('strips -h when run <script> -h is detected', () => {
      const result = rewriteHelpArgv(['run', 'fetch-releases', '-h']);
      expect(result).toEqual({ argv: ['run', 'fetch-releases'], scriptHelpRequested: true });
    });

    it('strips help flag while preserving other flags', () => {
      const result = rewriteHelpArgv(['run', 'build', '--env', 'X=1', '--help']);
      expect(result).toEqual({
        argv: ['run', 'build', '--env', 'X=1'],
        scriptHelpRequested: true,
      });
    });

    it('does not rewrite help flags after -- passthrough delimiter', () => {
      const result = rewriteHelpArgv(['run', 'clean', '--', '--help']);
      expect(result).toEqual({
        argv: ['run', 'clean', '--', '--help'],
        scriptHelpRequested: false,
      });
    });

    it('strips help flag before -- but preserves args after --', () => {
      const result = rewriteHelpArgv(['run', 'clean', '--help', '--', '--verbose']);
      expect(result).toEqual({
        argv: ['run', 'clean', '--', '--verbose'],
        scriptHelpRequested: true,
      });
    });
  });
}
