import * as p from '@clack/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockWriteFileSync } = vi.hoisted(() => ({
  mockWriteFileSync: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    writeFileSync: mockWriteFileSync,
  };
});

vi.mock('@clack/prompts', () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../lib/config.ts', () => ({
  safeLoadLaufConfigWithMeta: vi.fn(),
}));

vi.mock('../lib/paths.ts', () => ({
  getWorkspaceRoot: vi.fn(() => '/workspace'),
  LAUF_ROOT: '/lauf-root',
}));

vi.mock('../utils/fs.ts', () => ({
  safeMkdirSync: vi.fn(),
}));

vi.mock('../utils/prompt.ts', () => ({
  promptForText: vi.fn(),
}));

vi.mock('../templates/script.ts', () => ({
  scriptTemplate: vi.fn((name: string) => `template for ${name}`),
}));

import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { safeMkdirSync } from '../utils/fs.ts';
import { promptForText } from '../utils/prompt.ts';
import createHandler from './create.ts';

const mockLoadedConfig = {
  config: { scripts: ['scripts/*.ts'], logger: undefined, spinner: true },
  configFile: '/workspace/lauf.config.ts',
  configDir: '/workspace',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteFileSync.mockReset();
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  vi.spyOn(process, 'cwd').mockReturnValue('/workspace/packages/my-pkg');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('create handler', () => {
  it('creates script file successfully with provided name', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

    await createHandler({
      parameters: { name: 'my-script' },
      flags: {},
    });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('my-script.lauf.ts'),
      expect.any(String),
      { encoding: 'utf-8', flag: 'wx' },
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('resolves target dir relative to cwd when no --dir flag', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

    await createHandler({
      parameters: { name: 'my-script' },
      flags: {},
    });

    const writePath = mockWriteFileSync.mock.calls[0][0] as string;
    expect(writePath).toBe('/workspace/packages/my-pkg/scripts/my-script.lauf.ts');
  });

  it('prompts for name when not provided', async () => {
    vi.mocked(promptForText).mockResolvedValue([null, 'prompted-name']);
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

    await createHandler({
      parameters: {},
      flags: {},
    });

    expect(promptForText).toHaveBeenCalledWith('Enter a name for the new script', 'my-script');
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('prompted-name.lauf.ts'),
      expect.any(String),
      { encoding: 'utf-8', flag: 'wx' },
    );
  });

  it('fails when file already exists (EEXIST from wx flag)', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);
    const eexistError = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    mockWriteFileSync.mockImplementation(() => {
      // oxlint-disable-next-line no-throw-literal
      throw eexistError;
    });

    await createHandler({
      parameters: { name: 'existing' },
      flags: {},
    });

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('fails when mkdir errors', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(safeMkdirSync).mockReturnValue([new Error('EACCES'), null]);

    await createHandler({
      parameters: { name: 'new-script' },
      flags: {},
    });

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('fails when write errors with non-EEXIST error', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);
    mockWriteFileSync.mockImplementation(() => {
      // oxlint-disable-next-line no-throw-literal
      throw new Error('EACCES');
    });

    await createHandler({
      parameters: { name: 'new-script' },
      flags: {},
    });

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('fails when config cannot be loaded', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([new Error('err'), null]);

    await createHandler({
      parameters: { name: 'new-script' },
      flags: {},
    });

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('strips .ts extension from provided name', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

    await createHandler({
      parameters: { name: 'my-script.ts' },
      flags: {},
    });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('my-script.lauf.ts'),
      expect.any(String),
      { encoding: 'utf-8', flag: 'wx' },
    );
    // Should NOT contain my-script.ts.lauf.ts
    const writePath = mockWriteFileSync.mock.calls[0][0] as string;
    expect(writePath).not.toContain('.ts.lauf.ts');
  });

  it('strips .lauf.ts extension from provided name', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

    await createHandler({
      parameters: { name: 'my-script.lauf.ts' },
      flags: {},
    });

    const writePath = mockWriteFileSync.mock.calls[0][0] as string;
    expect(writePath).toContain('my-script.lauf.ts');
    expect(writePath).not.toContain('.lauf.lauf.ts');
  });

  it('fails when --dir flag escapes workspace root', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);

    await createHandler({
      parameters: { name: 'my-script' },
      flags: { dir: '/outside/workspace' },
    });

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('fails when --dir uses path traversal to escape workspace', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);

    await createHandler({
      parameters: { name: 'my-script' },
      flags: { dir: '../../etc' },
    });

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('resolves relative --dir from config dir', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

    await createHandler({
      parameters: { name: 'my-script' },
      flags: { dir: 'custom/scripts' },
    });

    const writePath = mockWriteFileSync.mock.calls[0][0] as string;
    expect(writePath).toBe('/workspace/custom/scripts/my-script.lauf.ts');
  });

  it('shows correct qualified name in success message', async () => {
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
    vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

    await createHandler({
      parameters: { name: 'my-script' },
      flags: {},
    });

    expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining('my-script.lauf.ts'));
    expect(p.log.message).toHaveBeenCalledWith(
      expect.stringContaining('lauf run workspace/my-script'),
    );
  });

  it('fails when prompt is cancelled', async () => {
    vi.mocked(promptForText).mockResolvedValue([{ message: 'Cancelled', exitCode: 0 }, null]);

    await createHandler({
      parameters: {},
      flags: {},
    });

    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('falls back to scripts/ directory when config has empty scripts array', async () => {
    const emptyScriptsConfig = {
      config: { scripts: [], logger: undefined, spinner: true },
      configFile: '/workspace/lauf.config.ts',
      configDir: '/workspace',
    };
    vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, emptyScriptsConfig]);
    vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

    await createHandler({
      parameters: { name: 'my-script' },
      flags: {},
    });

    const writePath = mockWriteFileSync.mock.calls[0][0] as string;
    expect(writePath).toBe('/workspace/packages/my-pkg/scripts/my-script.lauf.ts');
    expect(process.exit).not.toHaveBeenCalled();
  });
});
