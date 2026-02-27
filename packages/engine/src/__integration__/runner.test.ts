import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runScript } from '../runner.ts';
import type { Logger, ScriptTarget } from '../types.ts';

const ENGINE_ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const FIXTURES_DIR = path.join(ENGINE_ROOT, 'src', '__integration__', 'fixtures');

const silentLogger: Logger = Object.freeze({
  info() {},
  warn() {},
  error() {},
  success() {},
  message() {},
});

const makeScript = (fixtureName: string): ScriptTarget => ({
  name: `test/${fixtureName}`,
  path: path.join(FIXTURES_DIR, `${fixtureName}.ts`),
  packageDir: ENGINE_ROOT,
});

const defaultOptions = {
  workspaceRoot: ENGINE_ROOT,
  cliPackageRoot: ENGINE_ROOT,
  spinner: false,
  logger: silentLogger,
};

describe('runner integration', () => {
  let tmpDir: string;

  beforeAll(() => {
    const executorPath = path.join(ENGINE_ROOT, 'dist', 'executor.mjs');
    if (!fs.existsSync(executorPath)) {
      throw new Error(
        'dist/executor.mjs not found. Run `pnpm build` before running integration tests.',
      );
    }
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lauf-integ-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('basic script runs and exits 0', async () => {
    const markerPath = path.join(tmpDir, 'marker.json');
    const result = await runScript(makeScript('success'), { markerPath }, defaultOptions);

    expect(result.exitCode).toBe(0);
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf-8'));
    expect(marker).toEqual({ ran: true, name: 'test/success' });
  }, 30_000);

  it('script receives correct parsed args', async () => {
    const markerPath = path.join(tmpDir, 'marker.json');
    const result = await runScript(
      makeScript('with-args'),
      { markerPath, name: 'Alice', count: 3 },
      defaultOptions,
    );

    expect(result.exitCode).toBe(0);
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf-8'));
    expect(marker).toEqual({ name: 'Alice', count: 3 });
  }, 30_000);

  it('non-zero exit code propagated', async () => {
    const result = await runScript(makeScript('non-zero-exit'), {}, defaultOptions);

    expect(result.exitCode).toBe(2);
  }, 30_000);

  it('script that throws returns exit 1', async () => {
    const result = await runScript(makeScript('throws'), {}, defaultOptions);

    expect(result.exitCode).toBe(1);
  }, 30_000);

  it('missing script path returns exit 1', async () => {
    const result = await runScript(makeScript('nonexistent'), {}, defaultOptions);

    expect(result.exitCode).toBe(1);
  }, 30_000);

  it('invalid export returns exit 1', async () => {
    const result = await runScript(makeScript('invalid-export'), {}, defaultOptions);

    expect(result.exitCode).toBe(1);
  }, 30_000);

  it('help mode exits 0', async () => {
    const result = await runScript(makeScript('help-check'), {}, { ...defaultOptions, help: true });

    expect(result.exitCode).toBe(0);
  }, 30_000);

  it('script with top-level await runs successfully', async () => {
    const markerPath = path.join(tmpDir, 'marker.json');
    const result = await runScript(makeScript('top-level-await'), { markerPath }, defaultOptions);

    expect(result.exitCode).toBe(0);
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf-8'));
    expect(marker).toEqual({ ran: true, delay: 42 });
  }, 30_000);
});
