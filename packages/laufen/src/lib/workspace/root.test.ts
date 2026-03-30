import * as fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

import { resolveRoot } from './root.ts';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveRoot', () => {
  it('returns config root when root: true found in lauf.config.ts', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/workspace/lauf.config.ts') {
        return true;
      }
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('export default { root: true, scripts: [] }');

    const result = resolveRoot('/workspace/packages/app');
    expect(result).toEqual({ dir: '/workspace', source: 'config' });
  });

  it('returns config root when root:true found (no space)', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/workspace/lauf.config.ts') {
        return true;
      }
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('export default { root:true }');

    const result = resolveRoot('/workspace/packages/app');
    expect(result).toEqual({ dir: '/workspace', source: 'config' });
  });

  it('prefers closest root: true config', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/workspace/packages/lauf.config.ts') {
        return true;
      }
      if (pathStr === '/workspace/lauf.config.ts') {
        return true;
      }
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/workspace/packages/lauf.config.ts') {
        return 'export default { root: true }';
      }
      return 'export default { root: true }';
    });

    const result = resolveRoot('/workspace/packages/app');
    expect(result).toEqual({ dir: '/workspace/packages', source: 'config' });
  });

  it('falls back to .git when no root: true found', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/workspace/.git') {
        return true;
      }
      return false;
    });

    const result = resolveRoot('/workspace/packages/app');
    expect(result).toEqual({ dir: '/workspace', source: 'git' });
  });

  it('skips config files without root: true', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/workspace/packages/app/lauf.config.ts') {
        return true;
      }
      if (pathStr === '/workspace/.git') {
        return true;
      }
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('export default { scripts: ["scripts/*.ts"] }');

    const result = resolveRoot('/workspace/packages/app');
    expect(result).toEqual({ dir: '/workspace', source: 'git' });
  });

  it('checks laufen.config.ts when lauf.config.ts not found', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr === '/workspace/laufen.config.ts') {
        return true;
      }
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('export default { root: true }');

    const result = resolveRoot('/workspace/packages/app');
    expect(result).toEqual({ dir: '/workspace', source: 'config' });
  });

  it('returns cap fallback when nothing found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = resolveRoot('/');
    expect(result).toEqual({ dir: '/', source: 'cap' });
  });
});
