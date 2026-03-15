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

vi.mock('../utils/fs.ts', () => ({
  safeMkdirSync: vi.fn(),
}));

vi.mock('../utils/cli.ts', () => ({
  readPackageJSON: vi.fn(() => [null, { name: 'my-pkg' }]),
  safeParseError: vi.fn(String),
}));

vi.mock('../templates/blueprint.ts', () => ({
  BLUEPRINTS: ['clean', 'copy'],
  isBlueprintName: vi.fn((v: string) => ['clean', 'copy'].includes(v)),
  getBlueprintTemplate: vi.fn(() => [null, 'template content']),
}));

import { safeLoadLaufConfigWithMeta } from '../lib/config.ts';
import { getBlueprintTemplate, isBlueprintName } from '../templates/blueprint.ts';
import { readPackageJSON } from '../utils/cli.ts';
import { safeMkdirSync } from '../utils/fs.ts';
import blueprintHandler from './blueprint.ts';

const mockLoadedConfig = {
  config: {
    scripts: ['scripts/*.lauf.ts'],
    logger: undefined,
    spinner: true,
    sandbox: true,
    env: {},
    packages: {},
    watch: undefined,
  },
  configFile: '/workspace/lauf.config.ts',
  configDir: '/workspace',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteFileSync.mockReset();
  // Reset mocks that can bleed between tests via mockReturnValue overrides
  vi.mocked(getBlueprintTemplate).mockReturnValue([null, 'template content']);
  vi.mocked(readPackageJSON).mockReturnValue([null, { name: 'my-pkg' }]);
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('blueprint handler', () => {
  describe('list mode (no name)', () => {
    it('lists available blueprints', async () => {
      await blueprintHandler({ parameters: {}, flags: {} });

      expect(p.log.message).toHaveBeenCalledWith(expect.stringContaining('clean'));
      expect(p.log.message).toHaveBeenCalledWith(expect.stringContaining('copy'));
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('does not write any files', async () => {
      await blueprintHandler({ parameters: {}, flags: {} });

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe('scaffold mode', () => {
    it('fails with unknown blueprint name', async () => {
      vi.mocked(isBlueprintName).mockReturnValue(false);

      await blueprintHandler({ parameters: { name: 'unknown' }, flags: {} });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('fails when config cannot be loaded', async () => {
      vi.mocked(isBlueprintName).mockReturnValue(true);
      vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([new Error('config error'), null]);

      await blueprintHandler({ parameters: { name: 'clean' }, flags: {} });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('fails when target dir escapes config root via absolute --dir', async () => {
      vi.mocked(isBlueprintName).mockReturnValue(true);
      vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);

      await blueprintHandler({
        parameters: { name: 'clean' },
        flags: { dir: '/outside/workspace' },
      });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('fails when relative --dir escapes config root via path traversal', async () => {
      vi.mocked(isBlueprintName).mockReturnValue(true);
      vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);

      await blueprintHandler({
        parameters: { name: 'clean' },
        flags: { dir: '../../etc' },
      });

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('fails when mkdir errors', async () => {
      vi.mocked(isBlueprintName).mockReturnValue(true);
      vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
      vi.mocked(safeMkdirSync).mockReturnValue([new Error('EACCES'), null]);

      await blueprintHandler({ parameters: { name: 'clean' }, flags: {} });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('fails when template load fails', async () => {
      vi.mocked(isBlueprintName).mockReturnValue(true);
      vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
      vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);
      vi.mocked(getBlueprintTemplate).mockReturnValue([new Error('ENOENT'), null]);

      await blueprintHandler({ parameters: { name: 'clean' }, flags: {} });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('fails when file already exists (EEXIST)', async () => {
      vi.mocked(isBlueprintName).mockReturnValue(true);
      vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
      vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);
      const eexistError = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
      mockWriteFileSync.mockImplementation(() => {
        // oxlint-disable-next-line functional/no-throw-statements
        throw eexistError;
      });

      await blueprintHandler({ parameters: { name: 'clean' }, flags: {} });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('fails when write errors with non-EEXIST error', async () => {
      vi.mocked(isBlueprintName).mockReturnValue(true);
      vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
      vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);
      mockWriteFileSync.mockImplementation(() => {
        // oxlint-disable-next-line functional/no-throw-statements
        throw new Error('EACCES');
      });

      await blueprintHandler({ parameters: { name: 'clean' }, flags: {} });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('creates blueprint file at resolved scripts/ path', async () => {
      vi.mocked(isBlueprintName).mockReturnValue(true);
      vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
      vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

      await blueprintHandler({ parameters: { name: 'clean' }, flags: {} });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/workspace/scripts/clean.lauf.ts',
        'template content',
        { encoding: 'utf-8', flag: 'wx' },
      );
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('falls back to scripts/ when config has empty scripts array', async () => {
      const emptyScriptsConfig = {
        ...mockLoadedConfig,
        config: { ...mockLoadedConfig.config, scripts: [] },
      };
      vi.mocked(isBlueprintName).mockReturnValue(true);
      vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, emptyScriptsConfig]);
      vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

      await blueprintHandler({ parameters: { name: 'clean' }, flags: {} });

      const writePath = mockWriteFileSync.mock.calls[0][0] as string;
      expect(writePath).toBe('/workspace/scripts/clean.lauf.ts');
    });

    it('falls back to scripts/ when scripts pattern has no static base', async () => {
      const globConfig = {
        ...mockLoadedConfig,
        config: { ...mockLoadedConfig.config, scripts: ['**/*.lauf.ts'] },
      };
      vi.mocked(isBlueprintName).mockReturnValue(true);
      vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, globConfig]);
      vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

      await blueprintHandler({ parameters: { name: 'clean' }, flags: {} });

      const writePath = mockWriteFileSync.mock.calls[0][0] as string;
      expect(writePath).toBe('/workspace/scripts/clean.lauf.ts');
    });

    it('resolves relative --dir from config dir', async () => {
      vi.mocked(isBlueprintName).mockReturnValue(true);
      vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
      vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

      await blueprintHandler({
        parameters: { name: 'clean' },
        flags: { dir: 'custom/scripts' },
      });

      const writePath = mockWriteFileSync.mock.calls[0][0] as string;
      expect(writePath).toBe('/workspace/custom/scripts/clean.lauf.ts');
    });

    it('shows success message with relative path and run command', async () => {
      vi.mocked(isBlueprintName).mockReturnValue(true);
      vi.mocked(safeLoadLaufConfigWithMeta).mockResolvedValue([null, mockLoadedConfig]);
      vi.mocked(safeMkdirSync).mockReturnValue([null, undefined]);

      await blueprintHandler({ parameters: { name: 'clean' }, flags: {} });

      expect(p.log.success).toHaveBeenCalledWith(expect.stringContaining('clean.lauf.ts'));
      expect(p.log.message).toHaveBeenCalledWith(expect.stringContaining('lauf run my-pkg/clean'));
    });
  });
});
