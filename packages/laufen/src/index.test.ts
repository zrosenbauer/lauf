import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockReadPackageJSON,
  mockSafeParseError,
  mockErrorHint,
  mockHandleCreate,
  mockHandleHelp,
  mockHandleInit,
  mockHandleList,
  mockHandleRun,
  mockParse,
  mockClercInstance,
  mockRewriteHelpArgv,
  mockMarkScriptHelpRequested,
} = vi.hoisted(() => {
  const _mockParse = vi.fn();

  const _mockClercInstance: Record<string, ReturnType<typeof vi.fn>> = {
    name: vi.fn(),
    scriptName: vi.fn(),
    description: vi.fn(),
    version: vi.fn(),
    use: vi.fn(),
    errorHandler: vi.fn(),
    command: vi.fn(),
    on: vi.fn(),
    parse: _mockParse,
  };

  // All chainable methods return the instance
  ['name', 'scriptName', 'description', 'version', 'use', 'errorHandler', 'command', 'on'].forEach(
    (method) => {
      _mockClercInstance[method].mockReturnValue(_mockClercInstance);
    },
  );

  return {
    mockReadPackageJSON: vi.fn(),
    mockSafeParseError: vi.fn<(err: unknown) => string>(String),
    mockErrorHint: vi.fn(),
    mockHandleCreate: vi.fn(),
    mockHandleHelp: vi.fn(),
    mockHandleInit: vi.fn(),
    mockHandleList: vi.fn(),
    mockHandleRun: vi.fn(),
    mockParse: _mockParse,
    mockClercInstance: _mockClercInstance,
    mockRewriteHelpArgv: vi.fn(),
    mockMarkScriptHelpRequested: vi.fn(),
  };
});

vi.mock('./handlers/create.ts', () => ({ default: mockHandleCreate }));
vi.mock('./handlers/info.ts', () => ({ default: mockHandleHelp }));
vi.mock('./handlers/init.ts', () => ({ default: mockHandleInit }));
vi.mock('./handlers/list.ts', () => ({ default: mockHandleList }));
vi.mock('./handlers/run.ts', () => ({ default: mockHandleRun }));

vi.mock('./state/script-help.ts', () => ({
  markScriptHelpRequested: mockMarkScriptHelpRequested,
}));

vi.mock('./utils/cli.ts', () => ({
  readPackageJSON: mockReadPackageJSON,
  safeParseError: mockSafeParseError,
  errorHint: mockErrorHint,
}));

vi.mock('./utils/help-rewrite.ts', () => ({
  rewriteHelpArgv: mockRewriteHelpArgv,
}));

vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('clerc', () => ({
  Clerc: {
    create: vi.fn(() => mockClercInstance),
  },
  completionsPlugin: vi.fn(() => 'completionsPlugin'),
  helpPlugin: vi.fn(() => 'helpPlugin'),
  versionPlugin: vi.fn(() => 'versionPlugin'),
}));

vi.mock('picocolors', () => ({
  default: {
    dim: vi.fn((s: string) => s),
  },
}));

const CHAINABLE_METHODS = [
  'name',
  'scriptName',
  'description',
  'version',
  'use',
  'errorHandler',
  'command',
  'on',
] as const;

const resetChainableReturns = (): void => {
  CHAINABLE_METHODS.forEach((method) => {
    mockClercInstance[method].mockReturnValue(mockClercInstance);
  });
};

/** Sentinel used to simulate process.exit halting execution */
const EXIT_SENTINEL = 'ProcessExitCalled';

/** Attempt to import index.ts, catching the sentinel thrown by our process.exit mock */
const importIndex = async (expectExit: boolean): Promise<void> => {
  vi.resetModules();
  resetChainableReturns();

  if (expectExit) {
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      // Record the call for assertions, then halt execution via sentinel
      (process.exit as unknown as { _lastCode: number | undefined })._lastCode = code;
      // oxlint-disable-next-line no-throw-literal
      throw EXIT_SENTINEL;
    }) as never);

    try {
      await import('./index.ts');
    } catch (e: unknown) {
      if (e !== EXIT_SENTINEL) {
        // oxlint-disable-next-line no-throw-literal
        throw e;
      }
    }
  } else {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await import('./index.ts');
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  resetChainableReturns();
  mockRewriteHelpArgv.mockReturnValue({ argv: [], scriptHelpRequested: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('index (CLI entrypoint)', () => {
  it('sets up CLI with correct commands when package.json is valid', async () => {
    mockReadPackageJSON.mockReturnValue([null, { name: 'lauf', version: '1.0.0' }]);

    await importIndex(false);

    expect(mockClercInstance.name).toHaveBeenCalledWith('lauf');
    expect(mockClercInstance.scriptName).toHaveBeenCalledWith('lauf');
    expect(mockClercInstance.description).toHaveBeenCalledWith('Typed script runner for monorepos');
    expect(mockClercInstance.version).toHaveBeenCalledWith('1.0.0');
    expect(mockClercInstance.command).toHaveBeenCalledWith(
      'init',
      'Initialize lauf in the current package',
    );
    expect(mockClercInstance.on).toHaveBeenCalledWith('init', mockHandleInit);
    expect(mockClercInstance.command).toHaveBeenCalledWith('list', 'List all available scripts', {
      flags: {
        all: {
          type: Boolean,
          description: 'Discover scripts from all nested configs',
          alias: 'a',
        },
        filter: {
          type: String,
          description: 'Filter packages by name glob (e.g. "@apps/*")',
          alias: 'f',
        },
      },
    });
    expect(mockClercInstance.on).toHaveBeenCalledWith('list', mockHandleList);
    expect(mockClercInstance.on).toHaveBeenCalledWith('info', mockHandleHelp);
    expect(mockClercInstance.on).toHaveBeenCalledWith('run', mockHandleRun);
    expect(mockClercInstance.on).toHaveBeenCalledWith('create', mockHandleCreate);
    expect(mockParse).toHaveBeenCalledWith([]);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('passes rewritten argv to .parse() and calls markScriptHelpRequested when help detected', async () => {
    mockReadPackageJSON.mockReturnValue([null, { name: 'lauf', version: '1.0.0' }]);
    mockRewriteHelpArgv.mockReturnValue({ argv: ['run', 'clean'], scriptHelpRequested: true });

    await importIndex(false);

    expect(mockMarkScriptHelpRequested).toHaveBeenCalled();
    expect(mockParse).toHaveBeenCalledWith(['run', 'clean']);
  });

  it('does not call markScriptHelpRequested when no help detected', async () => {
    mockReadPackageJSON.mockReturnValue([null, { name: 'lauf', version: '1.0.0' }]);
    mockRewriteHelpArgv.mockReturnValue({ argv: ['run', 'clean'], scriptHelpRequested: false });

    await importIndex(false);

    expect(mockMarkScriptHelpRequested).not.toHaveBeenCalled();
    expect(mockParse).toHaveBeenCalledWith(['run', 'clean']);
  });

  it('exits with error when readPackageJSON fails', async () => {
    mockReadPackageJSON.mockReturnValue([new Error('ENOENT'), null]);

    await importIndex(true);

    expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Fatal error'));
  });

  it('exits with error when package.json has no version', async () => {
    mockReadPackageJSON.mockReturnValue([null, { name: 'lauf' }]);

    await importIndex(true);

    expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Fatal error'));
  });

  it('registers error handler that calls process.exit(1)', async () => {
    mockReadPackageJSON.mockReturnValue([null, { name: 'lauf', version: '1.0.0' }]);
    mockSafeParseError.mockReturnValue('some error');
    mockErrorHint.mockReturnValue(undefined);

    await importIndex(false);

    const errorHandlerCall = mockClercInstance.errorHandler.mock.calls[0];
    const errorHandler = errorHandlerCall[0] as (err: unknown) => void;

    // Reset exit mock for error handler invocation
    vi.mocked(process.exit).mockImplementation(() => undefined as never);

    errorHandler(new Error('test error'));

    expect(mockSafeParseError).toHaveBeenCalledWith(expect.any(Error));
    expect(p.log.error).toHaveBeenCalledWith('some error');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('error handler displays hint when errorHint returns a value', async () => {
    mockReadPackageJSON.mockReturnValue([null, { name: 'lauf', version: '1.0.0' }]);
    mockSafeParseError.mockReturnValue('bad command');
    mockErrorHint.mockReturnValue('Run `lauf --help` to see available commands.');

    await importIndex(false);

    const errorHandlerCall = mockClercInstance.errorHandler.mock.calls[0];
    const errorHandler = errorHandlerCall[0] as (err: unknown) => void;

    // Reset exit mock for error handler invocation
    vi.mocked(process.exit).mockImplementation(() => undefined as never);

    errorHandler('unknown command');

    expect(p.log.error).toHaveBeenCalledWith('bad command');
    expect(p.log.message).toHaveBeenCalledWith(
      expect.stringContaining('Run `lauf --help` to see available commands.'),
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('exits when readPackageJSON returns null pkg', async () => {
    mockReadPackageJSON.mockReturnValue([null, null]);

    await importIndex(true);

    expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Fatal error'));
  });
});
